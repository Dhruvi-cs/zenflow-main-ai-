// sockets/ticketSocket.js - Real-Time Collaboration Engine
const Ticket = require('../models/Ticket');

module.exports = function initTicketSocket(io) {
  io.on('connection', (socket) => {
    console.log(`⚡ Real-time client connected: ${socket.id}`);

    // Send initial handshake confirmation
    socket.emit('welcome', {
      message: 'Connected to ZenFlow Real-Time Server',
      socketId: socket.id
    });

    // Room partitioning by ticketId & auto-loading past chat history
    socket.on('join_ticket', async (ticketId) => {
      if (!ticketId) return;

      socket.join(ticketId);
      console.log(`Socket ${socket.id} joined ticket room: ${ticketId}`);

      const rawId = typeof ticketId === 'string' ? ticketId.replace('ticket_', '') : ticketId;

      try {
        const ticket = await Ticket.findById(rawId);
        if (ticket && Array.isArray(ticket.messages) && ticket.messages.length > 0) {
          socket.emit('load_history', ticket.messages);
        } else {
          // Provide an immediate onboarding greeting if this is a fresh room
          const shortId = rawId.length > 8 ? rawId.slice(-4).toUpperCase() : rawId;
          const initialWelcome = {
            sender: 'ZenFlow AI Bot',
            message: `👋 Welcome to your live support room for **Ticket #${shortId}**!\n\n• **Subject**: ${ticket ? ticket.title : 'Support Request'}\n• **Status**: ${ticket ? ticket.status : 'Open'} (Priority: ${ticket ? ticket.priority : 'Medium'})\n• **Assigned Team**: ${ticket ? ticket.assignedAgent : 'IT Support Queue'}\n\nZenFlow Virtual Assistant is active in this session. You can ask for status updates, request step-by-step instructions, or wait for an IT engineer.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: new Date()
          };
          try {
            await Ticket.findByIdAndUpdate(rawId, { $push: { messages: initialWelcome } });
          } catch {}
          socket.emit('load_history', [initialWelcome]);
        }
      } catch (err) {
        console.error('Error loading chat history:', err.message);
        socket.emit('load_history', []);
      }
    });

    // Bidirectional chat messaging & persistent storage in database
    socket.on('send_message', async (data) => {
      if (!data || !data.ticketId || !data.message) return;

      console.log(`💬 Chat message in ${data.ticketId} from ${data.sender}: ${data.message}`);

      const rawId = typeof data.ticketId === 'string' ? data.ticketId.replace('ticket_', '') : data.ticketId;
      const messageDoc = {
        sender: data.sender || 'User',
        message: data.message,
        timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date()
      };

      try {
        await Ticket.findByIdAndUpdate(rawId, {
          $push: { messages: messageDoc }
        });
      } catch (err) {
        console.error('Error persisting chat message:', err.message);
      }

      // Broadcast to all participants in this ticket's room
      io.to(data.ticketId).emit('receive_message', {
        ...data,
        timestamp: messageDoc.timestamp
      });

      // Automated ZenFlow AI Assistant in Ticket Rooms
      if (data.sender !== 'ZenFlow AI Bot' && !data.sender.includes('Support Agent')) {
        setTimeout(async () => {
          try {
            io.to(data.ticketId).emit('user_typing', { username: 'ZenFlow AI Assistant' });

            const ticket = await Ticket.findById(rawId);
            const msgLower = (data.message || '').toLowerCase().trim();
            const shortId = rawId.length > 8 ? rawId.slice(-4).toUpperCase() : rawId;
            const title = ticket ? ticket.title : 'Support Inquiry';
            const status = ticket ? ticket.status : 'Open';
            const priority = ticket ? ticket.priority : 'Medium';
            const agent = ticket ? ticket.assignedAgent : 'IT Support Queue';

            let botReply = '';

            if (msgLower.includes('update') || msgLower.includes('status') || msgLower.includes('tell') || msgLower === 'what is the update?' || msgLower === 'tell') {
              botReply = `📋 **Ticket #${shortId} Status Update**\n• **Title**: ${title}\n• **Current Status**: ${status}\n• **Priority**: ${priority}\n• **Assigned Engineer**: ${agent}\n\nOur team has logged your inquiry. If you have error logs or details to share, type them here!`;
            } else if (msgLower.includes('step by step') || msgLower.includes('process') || msgLower.includes('how to') || msgLower.includes('password') || msgLower.includes('vpn')) {
              botReply = `Here is the step-by-step resolution process for **${title}**:\n\n1. Go to the login page and click on **'Forgot Password'**.\n2. Enter your registered company email address.\n3. Open the password recovery email and click the secure reset link.\n4. Create a new strong password (minimum 8 characters with numbers and symbols).\n5. Log back in and re-authenticate your VPN / IT session.\n\nLet me know if you encounter any error codes during this process!`;
            } else {
              botReply = `Thank you for your update regarding **Ticket #${shortId}**. I have recorded this in your ticket history. A support specialist has been alerted and will assist you if further action is needed.`;
            }

            const botMsgDoc = {
              sender: 'ZenFlow AI Bot',
              message: botReply,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              createdAt: new Date()
            };

            await Ticket.findByIdAndUpdate(rawId, {
              $push: { messages: botMsgDoc }
            });

            io.to(data.ticketId).emit('user_stopped_typing');
            io.to(data.ticketId).emit('receive_message', {
              sender: 'ZenFlow AI Bot',
              message: botReply,
              ticketId: data.ticketId,
              timestamp: botMsgDoc.timestamp
            });
          } catch (botErr) {
            console.error('Error in AI bot chat response:', botErr.message);
          }
        }, 1000);
      }
    });

    // Live typing indicators
    socket.on('typing', (data) => {
      if (!data || !data.ticketId) return;
      socket.to(data.ticketId).emit('user_typing', {
        username: data.username || 'Support Agent'
      });
    });

    socket.on('stop_typing', (data) => {
      if (!data || !data.ticketId) return;
      socket.to(data.ticketId).emit('user_stopped_typing');
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });
};
