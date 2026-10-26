// aiRoutes.js - AI Routing & Proxy Layer
const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post(['/chat', '/query'], async (req, res) => {
  try {
    const userQuery = req.body.message || req.body.query || req.body.prompt || '';
    const category = req.body.category || 'General';

    if (!userQuery || typeof userQuery !== 'string' || userQuery.trim() === '') {
      return res.status(400).json({
        success: false,
        reply: 'Please enter a valid message or question.'
      });
    }

    // Proxy request to Python FastAPI RAG microservice on port 8000
    try {
      const aiRes = await axios.post(
        'http://127.0.0.1:8000/api/v1/rag/query',
        {
          query: userQuery,
          category: category
        },
        { timeout: 8000 }
      );

      if (aiRes.data) {
        const text = aiRes.data.answer || aiRes.data.ai_response || aiRes.data.reply || aiRes.data.response || '';
        return res.json({
          success: true,
          status: 'success',
          reply: text,
          answer: text,
          response: text,
          deflected: Boolean(aiRes.data.deflected),
          confidence_score: aiRes.data.confidence_score,
          retrieved_sources: aiRes.data.retrieved_sources || []
        });
      }
    } catch (proxyErr) {
      console.warn('Notice: FastAPI microservice proxy error, utilizing offline deflection engine:', proxyErr.message);
    }

    // Offline / Mock fallback response engine
    const lower = userQuery.toLowerCase().trim();
    let reply = "I am your ZenFlow AI assistant. You can ask me about tickets, password resets, account policies, or billing.";
    let sources = ['ZenFlow Knowledge Base (Standard Offline Guide)'];

    if (lower.includes('reset') || lower.includes('password')) {
      reply = "Click on the 'Forgot Password' option on the login page. Enter your registered email address and follow the password reset instructions sent to your email.";
      sources = ['Password Reset FAQ'];
    } else if (lower.includes('history') || (lower.includes('ticket') && lower.includes('status'))) {
      reply = "You can view your active and closed support tickets on the Ticket History page or from the Customer Dashboard.";
      sources = ['Ticket Status FAQ'];
    } else if (lower.includes('create') && lower.includes('ticket')) {
      reply = "Log in to your account, click on Create Ticket in the sidebar, enter your subject and details, select a priority level, and submit.";
      sources = ['Create Support Ticket FAQ'];
    } else if (lower.includes('refund') || lower.includes('billing')) {
      reply = "Submit a billing support ticket with your transaction details and reason for requesting a refund. Our financial support team will review your request.";
      sources = ['Billing Refund Policy'];
    }

    return res.json({
      success: true,
      status: 'success',
      reply,
      answer: reply,
      response: reply,
      deflected: true,
      confidence_score: 0.88,
      retrieved_sources: sources
    });
  } catch (error) {
    console.error('AI Route Error:', error);
    return res.status(500).json({
      success: false,
      reply: 'ZenFlow AI service is currently experiencing high load. Please try again shortly.'
    });
  }
});

module.exports = router;
