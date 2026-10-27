// routes/knowledgeRoutes.js - Enterprise Knowledge Base Management APIs
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const FAQ_JSON_PATH = path.join(__dirname, '..', 'ai-backend', 'data', 'faqs', 'faq.json');

// Helper to read FAQs from disk
function readFaqs() {
  try {
    if (!fs.existsSync(FAQ_JSON_PATH)) return [];
    const content = fs.readFileSync(FAQ_JSON_PATH, 'utf-8');
    const faqs = JSON.parse(content);
    // Ensure all items have an id
    let modified = false;
    faqs.forEach((item, idx) => {
      if (!item.id) {
        item.id = 'kb_' + (idx + 1);
        modified = true;
      }
    });
    if (modified) {
      fs.writeFileSync(FAQ_JSON_PATH, JSON.stringify(faqs, null, 2), 'utf-8');
    }
    return faqs;
  } catch (err) {
    console.error('Error reading FAQ JSON:', err.message);
    return [];
  }
}

// Helper to save FAQs to disk
function saveFaqs(faqs) {
  try {
    fs.writeFileSync(FAQ_JSON_PATH, JSON.stringify(faqs, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving FAQ JSON:', err.message);
    return false;
  }
}

// Background re-indexing
function triggerReindex() {
  try {
    const ingestScript = path.join(__dirname, '..', 'ai-backend', 'scripts', 'ingest.py');
    const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
    const proc = spawn(pyCmd, [ingestScript], {
      cwd: path.join(__dirname, '..', 'ai-backend'),
      detached: true,
      stdio: 'ignore'
    });
    proc.unref();
    console.log('🔄 Triggered background knowledge vector re-indexing');
  } catch (err) {
    console.warn('Re-indexing notice:', err.message);
  }
}

// 1. GET /api/knowledge - Retrieve all knowledge base articles
router.get('/', (req, res) => {
  const faqs = readFaqs();
  const category = req.query.category;
  const search = req.query.q ? req.query.q.toLowerCase() : '';

  let filtered = faqs;
  if (category && category !== 'All') {
    filtered = filtered.filter(f => (f.category || '').toLowerCase() === category.toLowerCase());
  }
  if (search) {
    filtered = filtered.filter(f =>
      (f.title || '').toLowerCase().includes(search) ||
      (f.question || '').toLowerCase().includes(search) ||
      (f.answer || '').toLowerCase().includes(search)
    );
  }

  res.json({
    success: true,
    total: faqs.length,
    count: filtered.length,
    data: filtered
  });
});

// 2. GET /api/knowledge/categories - List available categories
router.get('/categories', (req, res) => {
  const faqs = readFaqs();
  const categories = [...new Set(faqs.map(f => f.category || 'General'))].sort();
  res.json({
    success: true,
    categories
  });
});

// 3. POST /api/knowledge - Add a new company knowledge article
router.post('/', (req, res) => {
  const { title, category, question, answer } = req.body;

  if (!title || !question || !answer) {
    return res.status(400).json({
      success: false,
      message: 'Title, question, and answer are required fields.'
    });
  }

  const faqs = readFaqs();
  const newArticle = {
    id: 'kb_' + Date.now(),
    title: title.trim(),
    category: (category || 'General').trim(),
    question: question.trim(),
    answer: answer.trim(),
    updatedAt: new Date().toISOString()
  };

  faqs.unshift(newArticle);
  const saved = saveFaqs(faqs);

  if (!saved) {
    return res.status(500).json({
      success: false,
      message: 'Failed to write knowledge article to disk.'
    });
  }

  // Trigger vector reindexing in background
  triggerReindex();

  res.status(201).json({
    success: true,
    message: 'Company knowledge article created and vector indexing triggered.',
    data: newArticle
  });
});

// 4. DELETE /api/knowledge/:id - Delete an article
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const faqs = readFaqs();
  const initialLength = faqs.length;

  const updated = faqs.filter(f => f.id !== id);

  if (updated.length === initialLength) {
    return res.status(404).json({
      success: false,
      message: `Knowledge article with ID ${id} not found.`
    });
  }

  saveFaqs(updated);
  triggerReindex();

  res.json({
    success: true,
    message: `Article ${id} deleted successfully.`
  });
});

// 5. POST /api/knowledge/reindex - Force vector re-index
router.post('/reindex', (req, res) => {
  triggerReindex();
  res.json({
    success: true,
    message: 'Knowledge re-indexing initiated.'
  });
});

module.exports = router;
