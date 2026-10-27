// server.js - ZenFlow Backend Gateway & Real-Time Business Orchestrator
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');
const axios = require('axios');
const connectDB = require('./models/db');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// 1. Middlewares
app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json());

// 2. Static File Serving (Runs frontend and backend together under a single unified local host)
app.use(express.static(path.join(__dirname)));

// 3. Socket.io Setup (Supports browser clients, Live Server, and unified hosting)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Store io instance on app for use in routes & controllers
app.set('io', io);

// Initialize real-time socket event handlers
try {
  const initTicketSocket = require('./sockets/ticketSocket');
  if (typeof initTicketSocket === 'function') {
    initTicketSocket(io);
  }
} catch (socketErr) {
  console.log('Socket handler loading notice:', socketErr.message);
}

// 4. Database Connection
connectDB();

// 5. Root & Health Check Endpoints
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api', (req, res) => {
  res.json({
    name: 'ZenFlow Enterprise ITSM Gateway',
    status: 'online',
    version: '1.0.0',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', async (req, res) => {
  let aiHealth = 'unreachable';
  try {
    const rawAiUrl = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
    const aiBase = rawAiUrl.replace(/\/api\/v1\/rag\/query\/?$/, '').replace(/\/+$/, '');
    const aiRes = await axios.get(aiBase + '/', { timeout: 3000 });
    if (aiRes.status === 200) aiHealth = 'online';
  } catch {
    aiHealth = 'offline';
  }

  res.json({
    status: 'healthy',
    gateway: 'online',
    database: 'connected',
    ai_microservice: aiHealth,
    timestamp: new Date().toISOString()
  });
});

// 5. AI Chat & Query Proxy Routes
const aiRoutes = require('./aiRoutes');
app.use(['/api/ai', '/api/chat'], aiRoutes);

// 6. Ticket Routes
const ticketRoutes = require('./routes/ticketRoutes');
app.use('/api/tickets', ticketRoutes);

// 7. User Profile Routes
let inMemoryProfile = {
  name: 'Dhruvi Shri',
  email: 'dhruvi@zenflow.ai',
  role: 'IT Support Specialist',
  department: 'Cloud Operations',
  phone: '+91 9876543210',
  address: 'Kanpur, Uttar Pradesh',
  status: 'Active'
};

app.get('/api/profile', (req, res) => {
  res.status(200).json({
    success: true,
    user: inMemoryProfile
  });
});

app.put('/api/profile', (req, res) => {
  const { name, email, phone, address, department, role } = req.body;
  if (name) inMemoryProfile.name = name;
  if (email) inMemoryProfile.email = email;
  if (phone) inMemoryProfile.phone = phone;
  if (address) inMemoryProfile.address = address;
  if (department) inMemoryProfile.department = department;
  if (role) inMemoryProfile.role = role;

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    user: inMemoryProfile
  });
});

// 8. Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
});

// 9. Start Server Listener (Runs Express + Socket.IO together)
server.listen(PORT, () => {
  console.log(`🚀 ZenFlow Gateway running on port ${PORT}`);
  console.log(`🌐 API endpoints accessible at http://127.0.0.1:${PORT}`);
});
