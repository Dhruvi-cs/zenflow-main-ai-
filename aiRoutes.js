// aiRoutes.js - AI Routing & Proxy Layer with Cloud Auto-Resolution & Enterprise Knowledge Fallback
const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Pre-load 50 enterprise knowledge FAQs for instant, rich local deflection fallback
let enterpriseFAQs = [];
try {
  const faqPath = path.join(__dirname, 'ai-backend', 'data', 'faqs', 'faq.json');
  if (fs.existsSync(faqPath)) {
    enterpriseFAQs = JSON.parse(fs.readFileSync(faqPath, 'utf8'));
  }
} catch (e) {
  console.warn('Could not load enterprise FAQs for local fallback:', e.message);
}

function getAiEndpoints() {
  const endpoints = [];
  const envUrl = process.env.AI_SERVICE_URL;

  // 1. If explicit env variable is provided and is not localhost, prioritize it
  if (envUrl && !envUrl.includes('127.0.0.1') && !envUrl.includes('localhost')) {
    endpoints.push(envUrl);
  }

  // 2. Production Render cloud microservice
  endpoints.push('https://zenflow-service.onrender.com/api/v1/rag/query');

  // 3. Localhost development microservice (if running locally)
  if (envUrl && (envUrl.includes('127.0.0.1') || envUrl.includes('localhost'))) {
    endpoints.push(envUrl);
  } else {
    endpoints.push('http://127.0.0.1:8000/api/v1/rag/query');
  }

  return endpoints;
}

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

    const chatHistory = Array.isArray(req.body.chat_history) ? req.body.chat_history : [];
    const endpoints = getAiEndpoints();

    // Attempt connecting to the FastAPI RAG microservice
    for (const endpoint of endpoints) {
      try {
        const aiRes = await axios.post(
          endpoint,
          {
            query: userQuery,
            category: category,
            chat_history: chatHistory
          },
          { timeout: 18000 }
        );

        if (aiRes.data) {
          const text = aiRes.data.answer || aiRes.data.ai_response || aiRes.data.reply || aiRes.data.response || '';
          if (text) {
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
        }
      } catch (proxyErr) {
        console.warn(`[AI Proxy Notice] Endpoint ${endpoint} unreachable:`, proxyErr.message);
      }
    }

    // High-Precision Knowledge Fallback Engine using 50 Enterprise Policies
    const lower = userQuery.toLowerCase().trim();
    const queryTokens = lower.split(/\W+/).filter(w => w.length > 2);

    let bestFaq = null;
    let highestScore = 0;

    for (const faq of enterpriseFAQs) {
      let score = 0;
      const targetText = `${faq.title} ${faq.question} ${faq.category}`.toLowerCase();
      for (const tok of queryTokens) {
        if (targetText.includes(tok)) score += 2;
      }
      if (score > highestScore) {
        highestScore = score;
        bestFaq = faq;
      }
    }

    let reply = "";
    let sources = [];

    if (bestFaq && highestScore >= 2) {
      reply = bestFaq.answer;
      sources = [`${bestFaq.title} (${bestFaq.category})`];
    } else if (lower.includes('reset') || lower.includes('password')) {
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
    } else {
      reply = "I am your ZenFlow AI assistant. You can ask me about password resets, corporate VPN, MFA setup, Wi-Fi access, software licenses, laptop replacements, expense claims, or ticket management.";
      sources = ['ZenFlow Enterprise Knowledge Base'];
    }

    return res.json({
      success: true,
      status: 'success',
      reply,
      answer: reply,
      response: reply,
      deflected: true,
      confidence_score: bestFaq ? 0.85 : 0.60,
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
