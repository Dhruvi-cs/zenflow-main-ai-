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
          socket.emit('load_history', []);
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
