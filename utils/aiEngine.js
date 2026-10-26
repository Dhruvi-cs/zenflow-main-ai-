// utils/aiEngine.js - AI Triage & Response Drafting Engine
require('dotenv').config();

let openai = null;
const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
if (apiKey && !apiKey.startsWith('mock_') && !apiKey.includes('your_')) {
  try {
    const OpenAI = require('openai');
    openai = new OpenAI({
      apiKey: apiKey,
      baseURL: process.env.GROQ_API_KEY ? 'https://api.groq.com/openai/v1' : undefined
    });
  } catch (e) {
    console.warn('Notice: OpenAI/Groq client initialization:', e.message);
  }
}

/**
 * Triages customer ticket queries, extracts metadata, and generates summaries.
 * @param {string} customerQuery - The raw query submitted by the user.
 * @returns {Promise<Object>} Formatted JSON containing category, urgency, sentiment, and aiSummary.
 */
async function triageTicket(customerQuery) {
  if (!customerQuery || typeof customerQuery !== 'string') {
    return {
      category: 'General',
      urgency: 'Medium',
      sentiment: 'Neutral',
      aiSummary: 'General support inquiry.'
    };
  }

  const queryLower = customerQuery.toLowerCase();

  // If live LLM client is available, invoke it
  if (openai) {
    try {
      const systemPrompt = `
You are an expert AI triage engine for a customer support platform.
Analyze the customer query and respond ONLY with a valid JSON object matching this schema:
{
  "category": "Billing" | "Technical Issue" | "Account Issue" | "General",
  "urgency": "Low" | "Medium" | "High" | "Critical",
  "sentiment": "Neutral" | "Frustrated" | "Angry" | "Positive",
  "aiSummary": "One concise sentence summarizing the issue under 15 words"
}
Do NOT output markdown formatting. Return pure JSON string only.
`;
      const response = await openai.chat.completions.create({
        model: process.env.GROQ_API_KEY ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: customerQuery }
        ],
        temperature: 0.2
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.warn('LLM Triage API call notice, applying heuristic triage:', error.message);
    }
  }

  // Heuristic rule-based triage engine (100% deterministic & offline-safe)
  let category = 'General';
  let urgency = 'Medium';
  let sentiment = 'Neutral';

  if (queryLower.includes('password') || queryLower.includes('login') || queryLower.includes('account') || queryLower.includes('2fa') || queryLower.includes('auth')) {
    category = 'Account Issue';
    urgency = 'Medium';
  } else if (queryLower.includes('billing') || queryLower.includes('refund') || queryLower.includes('invoice') || queryLower.includes('charge') || queryLower.includes('payment') || queryLower.includes('subscription')) {
    category = 'Billing';
    urgency = 'High';
  } else if (queryLower.includes('vpn') || queryLower.includes('error') || queryLower.includes('fail') || queryLower.includes('bug') || queryLower.includes('crash') || queryLower.includes('api') || queryLower.includes('429')) {
    category = 'Technical Issue';
    urgency = 'High';
  }

  if (queryLower.includes('urgent') || queryLower.includes('critical') || queryLower.includes('down') || queryLower.includes('blocked') || queryLower.includes('immediately')) {
    urgency = 'Critical';
  }

  if (queryLower.includes('angry') || queryLower.includes('terrible') || queryLower.includes('unacceptable') || queryLower.includes('worst') || queryLower.includes('ridiculous')) {
    sentiment = 'Angry';
  } else if (queryLower.includes('frustrated') || queryLower.includes('unable') || queryLower.includes('fail') || queryLower.includes('issue') || queryLower.includes('problem')) {
    sentiment = 'Frustrated';
  } else if (queryLower.includes('thank') || queryLower.includes('great') || queryLower.includes('good') || queryLower.includes('pleased')) {
    sentiment = 'Positive';
  }

  const cleanText = customerQuery.replace(/[\r\n]+/g, ' ').trim();
  const words = cleanText.split(' ').slice(0, 12).join(' ');
  const aiSummary = words.length > 0 ? `${words}...` : 'Support issue reported by customer.';

  return {
    category,
    urgency,
    sentiment,
    aiSummary
  };
}

/**
 * Generates an initial response draft for support agents based on ticket query, category, and sentiment.
 * @param {string} customerQuery - The user's issue text.
 * @param {string} category - Category determined by triage.
 * @param {string} sentiment - Sentiment determined by triage.
 * @returns {Promise<string>} Editable response draft for the agent.
 */
async function generateAutoReplyDraft(customerQuery, category = 'General', sentiment = 'Neutral') {
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.GROQ_API_KEY ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert customer support agent for ZenFlow AI. Draft a polite, professional, and empathetic initial response (< 3 sentences) addressing the customer's query under the ${category} department. The customer's detected emotional state is: ${sentiment}. Assure them their issue is being actively investigated.`
          },
          { role: 'user', content: customerQuery }
        ],
        temperature: 0.5
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.warn('LLM Draft API call notice:', error.message);
    }
  }

  let empathyIntro = 'Thank you for reaching out to ZenFlow Support.';
  if (sentiment === 'Frustrated' || sentiment === 'Angry') {
    empathyIntro = 'We sincerely apologize for the inconvenience and frustration this issue has caused.';
  }

  return `${empathyIntro} Our team has logged your ${category} request and our support specialists are actively investigating a resolution. We will follow up with you shortly.`;
}

module.exports = {
  triageTicket,
  generateAutoReplyDraft
};
