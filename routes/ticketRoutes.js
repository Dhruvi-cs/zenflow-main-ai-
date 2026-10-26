// routes/ticketRoutes.js - Enterprise ITSM Ticket Routing
const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');

// 1. Dashboard metrics endpoint (must precede /:id)
router.get('/dashboard', ticketController.getDashboardMetrics);

// 2. Ticket collection routes
router.post('/', ticketController.createTicket);
router.get('/', ticketController.getAllTickets);

// 3. Single ticket routes
router.get('/:id', ticketController.getTicketById);
router.put('/:id', ticketController.updateTicket);
router.delete('/:id', ticketController.deleteTicket);

module.exports = router;
