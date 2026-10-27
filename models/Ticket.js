// models/Ticket.js - Enterprise ITSM Ticket Schema & Resilient Storage
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Ensure local persistence directory exists for fallback
const LOCAL_DATA_DIR = path.join(__dirname, '..', 'data');
const LOCAL_STORAGE_FILE = path.join(LOCAL_DATA_DIR, 'tickets_store.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(LOCAL_STORAGE_FILE)) {
      fs.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('Notice: Local ticket store initialization:', err.message);
  }
}

function readLocalTickets() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(LOCAL_STORAGE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeLocalTickets(tickets) {
  ensureDataDir();
  try {
    fs.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify(tickets, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing local ticket store:', err.message);
  }
}

// 1. Define Mongoose Schema
const TicketSchema = new mongoose.Schema(
  {
    title: { type: String, default: 'Support Ticket' },
    description: { type: String, default: '' },
    query: { type: String, default: '' },
    customerName: { type: String, default: 'Customer' },
    customerEmail: { type: String, default: 'customer@zenflow.ai' },
    user_id: { type: String, default: 'guest' },
    category: { type: String, default: 'General' },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium'
    },
    urgency: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium'
    },
    status: {
      type: String,
      enum: ['Open', 'In-Progress', 'Pending', 'Resolved', 'Deflected', 'Closed'],
      default: 'Open'
    },
    sentiment: {
      type: String,
      enum: ['Neutral', 'Frustrated', 'Angry', 'Positive'],
      default: 'Neutral'
    },
    aiSummary: { type: String, default: '' },
    deflected: { type: Boolean, default: false },
    escalated: { type: Boolean, default: false },
    ai_response: { type: String, default: '' },
    confidence_score: { type: Number, default: 0.0 },
    retrieved_sources: { type: [String], default: [] },
    assignedAgent: { type: String, default: 'Unassigned' },
    messages: [
      {
        sender: { type: String, default: 'User' },
        message: { type: String, default: '' },
        timestamp: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Virtual properties for camelCase / snake_case compatibility
TicketSchema.virtual('aiResponse')
  .get(function () { return this.ai_response; })
  .set(function (val) { this.ai_response = val; });

TicketSchema.virtual('confidenceScore')
  .get(function () { return this.confidence_score; })
  .set(function (val) { this.confidence_score = val; });

TicketSchema.virtual('retrievedSources')
  .get(function () { return this.retrieved_sources; })
  .set(function (val) { this.retrieved_sources = val; });

let MongooseModel;
try {
  MongooseModel = mongoose.model('Ticket');
} catch {
  MongooseModel = mongoose.model('Ticket', TicketSchema);
}

// 2. Resilient Hybrid Model Wrapper
// Automatically routes to MongoDB if connected; otherwise transparently falls back
// to local JSON persistence so the application never crashes when MongoDB daemon is absent.
class TicketWrapper {
  constructor(data = {}) {
    this._id = data._id || 'tk_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    this.title = data.title || (data.query ? data.query.split(':')[0].trim() : 'Support Request');
    this.description = data.description || (data.query && data.query.includes(':') ? data.query.split(':').slice(1).join(':').trim() : (data.query || ''));
    this.query = data.query || `${this.title}: ${this.description}`;
    this.customerName = data.customerName || 'Demo Customer';
    this.customerEmail = data.customerEmail || 'customer@zenflow.ai';
    this.user_id = data.user_id || 'guest';
    this.category = data.category || 'General';
    this.priority = data.priority || 'Medium';
    this.urgency = data.urgency || data.priority || 'Medium';
    this.status = data.status || (data.deflected ? 'Deflected' : 'Open');
    this.sentiment = data.sentiment || 'Neutral';
    this.aiSummary = data.aiSummary || '';
    this.deflected = Boolean(data.deflected);
    this.escalated = Boolean(data.escalated);
    this.ai_response = data.ai_response || data.aiResponse || '';
    this.confidence_score = Number(data.confidence_score ?? data.confidenceScore ?? 0.0);
    this.retrieved_sources = Array.isArray(data.retrieved_sources) ? data.retrieved_sources : (Array.isArray(data.retrievedSources) ? data.retrievedSources : []);
    this.assignedAgent = data.assignedAgent || 'Unassigned';
    this.messages = Array.isArray(data.messages) ? data.messages : [];
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();

    if (mongoose.connection.readyState === 1) {
      this._mongooseDoc = new MongooseModel(data);
    }
  }

  async save() {
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await this._mongooseDoc.save();
        return doc;
      } catch (err) {
        console.warn('Mongoose save warning, persisting locally:', err.message);
      }
    }

    const tickets = readLocalTickets();
    const index = tickets.findIndex(t => t._id === this._id);
    const plainObj = {
      _id: this._id,
      title: this.title,
      description: this.description,
      query: this.query,
      customerName: this.customerName,
      customerEmail: this.customerEmail,
      user_id: this.user_id,
      category: this.category,
      priority: this.priority,
      urgency: this.urgency,
      status: this.status,
      sentiment: this.sentiment,
      aiSummary: this.aiSummary,
      deflected: this.deflected,
      escalated: this.escalated,
      ai_response: this.ai_response,
      confidence_score: this.confidence_score,
      retrieved_sources: this.retrieved_sources,
      assignedAgent: this.assignedAgent,
      messages: this.messages,
      createdAt: this.createdAt,
      updatedAt: new Date()
    };

    if (index >= 0) {
      tickets[index] = plainObj;
    } else {
      tickets.unshift(plainObj);
    }

    writeLocalTickets(tickets);
    return plainObj;
  }

  static async find(filter = {}) {
    if (mongoose.connection.readyState === 1) {
      try {
        return await MongooseModel.find(filter).sort({ createdAt: -1 });
      } catch (err) {
        console.warn('Mongoose find warning, using local store:', err.message);
      }
    }

    let tickets = readLocalTickets();
    if (filter && typeof filter === 'object' && Object.keys(filter).length > 0) {
      tickets = tickets.filter(t => {
        for (const [k, v] of Object.entries(filter)) {
          if (t[k] !== v) return false;
        }
        return true;
      });
    }

    tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return tickets;
  }

  static async findById(id) {
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
      try {
        const doc = await MongooseModel.findById(id);
        if (doc) return doc;
      } catch (err) {
        console.warn('Mongoose findById warning, fallback to local store:', err.message);
      }
    }

    const tickets = readLocalTickets();
    const found = tickets.find(t => String(t._id) === String(id));
    if (!found) return null;

    const wrapped = new TicketWrapper(found);
    wrapped.select = function () { return this; };
    return wrapped;
  }

  static async findByIdAndDelete(id) {
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
      try {
        return await MongooseModel.findByIdAndDelete(id);
      } catch (err) {
        console.warn('Mongoose findByIdAndDelete warning:', err.message);
      }
    }

    const tickets = readLocalTickets();
    const index = tickets.findIndex(t => String(t._id) === String(id));
    if (index === -1) return null;

    const [deleted] = tickets.splice(index, 1);
    writeLocalTickets(tickets);
    return deleted;
  }

  static async findByIdAndUpdate(id, updateObj, options = {}) {
    const rawUpdate = updateObj.$set || updateObj;
    const rawPush = updateObj.$push;

    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
      try {
        const doc = await MongooseModel.findByIdAndUpdate(id, updateObj, options);
        if (doc) return doc;
      } catch (err) {
        console.warn('Mongoose findByIdAndUpdate warning:', err.message);
      }
    }

    const tickets = readLocalTickets();
    const index = tickets.findIndex(t => String(t._id) === String(id));
    if (index === -1) return null;

    if (rawUpdate) {
      Object.assign(tickets[index], rawUpdate);
    }
    if (rawPush && rawPush.messages) {
      if (!Array.isArray(tickets[index].messages)) tickets[index].messages = [];
      tickets[index].messages.push(rawPush.messages);
    }
    tickets[index].updatedAt = new Date();

    writeLocalTickets(tickets);
    return tickets[index];
  }

  static async countDocuments(filter = {}) {
    if (mongoose.connection.readyState === 1) {
      try {
        return await MongooseModel.countDocuments(filter);
      } catch (err) {
        console.warn('Mongoose countDocuments warning:', err.message);
      }
    }

    const tickets = await this.find(filter);
    return tickets.length;
  }

  static async deleteOne(filter = {}) {
    if (mongoose.connection.readyState === 1) {
      try {
        return await MongooseModel.deleteOne(filter);
      } catch (err) {
        console.warn('Mongoose deleteOne warning:', err.message);
      }
    }

    let tickets = readLocalTickets();
    const initialLen = tickets.length;
    tickets = tickets.filter(t => {
      for (const [k, v] of Object.entries(filter)) {
        if (String(t[k]) === String(v)) return false;
      }
      return true;
    });
    writeLocalTickets(tickets);
    return { deletedCount: initialLen - tickets.length };
  }
}

module.exports = TicketWrapper;
