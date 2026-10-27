// controllers/ticketController.js - Enterprise ITSM Ticket Controller
const Ticket = require('../models/Ticket');
const axios = require('axios');

// POST /api/tickets - Create ticket and process through AI RAG microservice
exports.createTicket = async (req, res) => {
  try {
    let {
      title,
      description,
      query,
      category,
      priority,
      customerName,
      customerEmail,
      user_id
    } = req.body;

    // Handle query string if passed from create-ticket form
    if (!title && query) {
      const parts = query.split(':');
      title = parts[0].trim();
      description = parts.slice(1).join(':').trim() || title;
    } else if (title && !query) {
      query = description ? `${title}: ${description}` : title;
    }

    const ticketTitle = (title || 'Support Request').trim();
    const ticketDescription = (description || query || '').trim();
    const fullQuery = (query || `${ticketTitle}: ${ticketDescription}`).trim();
    const selectedCategory = category || 'General';
    const selectedPriority = priority || 'Medium';

    let aiData = {
      ticket_id: null,
      deflected: false,
      can_deflect: false,
      ai_response: 'Ticket logged successfully. An agent will review it shortly.',
      confidence_score: 0.5,
      retrieved_sources: [],
      error: null
    };

    // Forward to FastAPI RAG microservice
    try {
      const aiEndpoint = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000/api/v1/rag/query';
      const aiResponse = await axios.post(
        aiEndpoint,
        {
          query: fullQuery,
          category: selectedCategory
        },
        { timeout: 12000 }
      );

      if (aiResponse.data) {
        const raw = aiResponse.data;
        const answerText = raw.answer || raw.ai_response || raw.reply || raw.response || '';
        const isDeflected = Boolean(raw.deflected || raw.can_deflect || (!raw.requires_human_agent && raw.confidence_score >= 0.60));
        const confidence = typeof raw.confidence_score === 'number' ? raw.confidence_score : 0.85;
        const sources = Array.isArray(raw.retrieved_sources) ? raw.retrieved_sources : (Array.isArray(raw.sources) ? raw.sources : []);

        aiData = {
          ticket_id: null,
          deflected: isDeflected,
          can_deflect: isDeflected,
          ai_response: answerText || aiData.ai_response,
          confidence_score: confidence,
          retrieved_sources: sources,
          error: null
        };
      }
    } catch (aiErr) {
      console.warn('AI microservice notice (falling back gracefully):', aiErr.message);
      aiData.error = aiErr.message;
    }

    const isDeflected = Boolean(aiData.deflected);
    const initialStatus = isDeflected ? 'Deflected' : 'Open';

    const newTicket = new Ticket({
      title: ticketTitle,
      description: ticketDescription,
      query: fullQuery,
      customerName: customerName || 'Demo Customer',
      customerEmail: customerEmail || 'customer@zenflow.ai',
      user_id: user_id || 'guest',
      category: selectedCategory,
      priority: selectedPriority,
      urgency: selectedPriority,
      status: initialStatus,
      deflected: isDeflected,
      escalated: false,
      ai_response: aiData.ai_response,
      confidence_score: aiData.confidence_score,
      retrieved_sources: aiData.retrieved_sources,
      assignedAgent: isDeflected ? 'AI Auto-Deflector' : 'Unassigned',
      messages: []
    });

    const savedTicket = await newTicket.save();
    aiData.ticket_id = savedTicket._id;

    // Real-time broadcast to dashboard via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('ticket_created', savedTicket);
    }

    return res.status(201).json({
      success: true,
      message: isDeflected ? 'Ticket deflected by AI knowledge base.' : 'Ticket created successfully.',
      ticket: savedTicket,
      data: savedTicket,
      aiData,
      deflected: savedTicket.deflected,
      ai_response: savedTicket.ai_response,
      retrieved_sources: savedTicket.retrieved_sources
    });
  } catch (error) {
    console.error('Error in createTicket controller:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// GET /api/tickets - Fetch all tickets with optional filtering & search
exports.getAllTickets = async (req, res) => {
  try {
    let tickets = await Ticket.find();

    const { status, category, search } = req.query;

    if (status && status !== 'ALL') {
      tickets = tickets.filter(t => (t.status || '').toLowerCase() === status.toLowerCase());
    }

    if (category && category !== 'ALL') {
      tickets = tickets.filter(t => (t.category || '').toLowerCase() === category.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      tickets = tickets.filter(t =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.query || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q) ||
        String(t._id || '').toLowerCase().includes(q)
      );
    }

    return res.status(200).json({
      success: true,
      count: tickets.length,
      data: tickets,
      tickets: tickets
    });
  } catch (error) {
    console.error('Error in getAllTickets:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// GET /api/tickets/dashboard - Real-time ITSM dashboard aggregations
exports.getDashboardMetrics = async (req, res) => {
  try {
    const all = await Ticket.find();

    const total = all.length;
    const open = all.filter(t => t.status === 'Open').length;
    const inProgress = all.filter(t => t.status === 'In-Progress').length;
    const pending = all.filter(t => t.status === 'Pending').length;
    const resolved = all.filter(t => t.status === 'Resolved').length;
    const deflected = all.filter(t => t.status === 'Deflected' || t.deflected === true).length;
    const escalated = all.filter(t => t.escalated === true).length;

    const deflectionPct = total > 0 ? Math.round((deflected / total) * 100) : 0;
    const deflectionRate = `${deflectionPct}%`;

    const stats = {
      total,
      open,
      inProgress,
      pending,
      resolved,
      deflected,
      escalated,
      deflectionRate
    };

    return res.status(200).json({
      success: true,
      stats,
      totalTickets: total,
      openTickets: open,
      resolvedTickets: resolved,
      deflectedTickets: deflected,
      pendingTickets: pending,
      deflectionRate
    });
  } catch (error) {
    console.error('Error in getDashboardMetrics:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// GET /api/tickets/:id - Single ticket details
exports.getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    return res.status(200).json({
      success: true,
      data: ticket,
      ticket: ticket
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// PUT /api/tickets/:id - Update ticket status / details
exports.updateTicket = async (req, res) => {
  try {
    const { status, priority, isDeflected, deflected, escalated, assignedAgent, ai_response } = req.body;
    const updateFields = {};

    if (status !== undefined) updateFields.status = status;
    if (priority !== undefined) {
      updateFields.priority = priority;
      updateFields.urgency = priority;
    }
    if (isDeflected !== undefined) updateFields.deflected = Boolean(isDeflected);
    if (deflected !== undefined) updateFields.deflected = Boolean(deflected);
    if (escalated !== undefined) updateFields.escalated = Boolean(escalated);
    if (assignedAgent !== undefined) updateFields.assignedAgent = assignedAgent;
    if (ai_response !== undefined) updateFields.ai_response = ai_response;

    const updatedTicket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    );

    if (!updatedTicket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    // Broadcast update via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('ticket_updated', updatedTicket);
    }

    return res.status(200).json({
      success: true,
      message: 'Ticket updated successfully',
      data: updatedTicket,
      ticket: updatedTicket
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// DELETE /api/tickets/:id - Delete ticket
exports.deleteTicket = async (req, res) => {
  try {
    const result = await Ticket.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    return res.status(200).json({ success: true, message: 'Ticket deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
