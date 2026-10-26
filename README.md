# ZenFlow - Enterprise AI-Driven IT Service Management (ITSM) Ecosystem

ZenFlow is an enterprise-grade, multi-tier IT Service Management (ITSM) and automated ticket deflection platform. It integrates Retrieval-Augmented Generation (RAG) with a real-time event-driven architecture to instantly resolve user inquiries, deflect routine support tickets, and provide seamless agent collaboration.

---

## 🌟 System Architecture & Topology

ZenFlow operates as a decoupled, multi-service topology spanning four core layers:

```
[ Frontend Client Layer ] (HTML5 / Vanilla JS / CSS3)
       │ (Port 5500 / 5501 - Live Server)
       ▼
[ Gateway & Business Orchestrator ] (Node.js, Express, Socket.io)
       │ (Port 5000)
       ├──► [ Database ] (MongoDB / Embedded Resilient JSON Engine)
       │
       ▼ (HTTP REST Proxy)
[ AI RAG Microservice ] (Python, FastAPI, LangChain, ChromaDB, Gemini LLM)
       │ (Port 8000)
       ▼
[ Knowledge Vector DB ] (ChromaDB Persistent Store with Category Partitioning)
       ▲
       └── [ Ingestion Pipeline ] (ai-backend/scripts/ingest.py <- FAQ JSON & PDF)
```

| Layer | Service / Technology | Default Port / URL | Description |
|---|---|---|---|
| **1. Frontend Client** | HTML5, CSS3, Vanilla JS, Bootstrap 5, FontAwesome | `http://127.0.0.1:5500` | Multi-page responsive portal: Login, Dashboard, Create Ticket, History, AI Chat, Live Session Chat, Profile. |
| **2. Backend Gateway** | Node.js, Express.js, Socket.io, Mongoose | `http://127.0.0.1:5000` | API Gateway, ticket lifecycle orchestrator, AI proxy router, and WebSocket room collaboration server. |
| **3. AI RAG Microservice** | Python 3.10+, FastAPI, LangChain, ChromaDB, Gemini LLM | `http://127.0.0.1:8000` | Semantic retrieval, confidence scoring, automated deflection engine, and LLM answer generation. |
| **4. Database & Storage** | MongoDB & Resilient Embedded JSON Storage | `mongodb://127.0.0.1:27017/zenflow` | High-availability ticket storage with seamless fallback to internal persistent storage (`data/tickets_store.json`). |

---

## 🚀 Key Features

1. **Automated Ticket Deflection**:
   - Analyzes incoming incident inquiries against indexed ITSM knowledge bases (JSON & PDF).
   - Computes normalized semantic match confidence scores ($0.0 - 1.0$).
   - If confidence exceeds threshold ($\ge 0.60$), offers instant resolution and marks ticket as deflected.
   - If inquiry is out-of-domain or low-confidence, automatically routes and escalates to human specialists.

2. **Real-Time Collaboration & Room Partitioning**:
   - Full WebSocket bi-directional chat powered by Socket.io.
   - Dedicated rooms partitioned per ticket (`ticket_<id>`).
   - Chat history dynamically loaded from the database (`load_history`).
   - Real-time typing indicators (`user_typing`, `user_stopped_typing`).

3. **Enterprise ITSM Dashboard & Telemetry**:
   - Real-time KPI summary cards: Total Tickets, Open, Resolved, AI Deflected, and Deflection Rate percentage.
   - Live socket event listeners (`ticket_created`, `ticket_updated`) dynamically update metrics without manual refresh.

4. **Multi-Source Knowledge Base Pipeline**:
   - Ingests both structured JSON FAQs (`faq.json`) and PDF documentation (`faq.pdf`).
   - Chunked using `RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)`.
   - Vectorized and indexed in persistent ChromaDB collections with category metadata partitioning.

5. **Dual-Mode Resilient Database Engine**:
   - Automatically connects to standalone MongoDB or MongoDB Atlas if configured.
   - Transparently activates an embedded JSON storage engine (`data/tickets_store.json`) if local daemon is absent, ensuring 100% out-of-the-box development and testing reliability.

---

## 🛠️ Installation & Setup Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher (v25+ tested)
- **Python**: v3.10 or higher (v3.14 tested)
- **MongoDB** *(Optional)*: Standalone MongoDB on `mongodb://127.0.0.1:27017/zenflow` or MongoDB Atlas.

### 1. Clone & Install Gateway Dependencies
```bash
# Navigate to project root
cd zenflow-ai-main

# Install Node.js gateway dependencies
npm install
```

### 2. Set Up Python AI Microservice
```bash
# Install Python dependencies
pip install -r ai-backend/requirements.txt
```

### 3. Run Knowledge Base Ingestion Pipeline
```bash
# Ingests faq.json and faq.pdf into ChromaDB vectorstore
python ai-backend/scripts/ingest.py
# or via npm script:
npm run ai:ingest
```

### 4. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default configuration (`.env`):
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/zenflow
AI_SERVICE_URL=http://127.0.0.1:8000/api/v1/rag/query
GOOGLE_API_KEY=your_gemini_api_key_here
CONFIDENCE_THRESHOLD=0.60
```
> *Note: If `GOOGLE_API_KEY` is not configured, ZenFlow automatically operates with its internal deterministic semantic vectorizer and offline grounded answer engine.*

---

## 🏃 How to Run Locally (100% Free - Zero Server Setup)

ZenFlow can run **100% locally on your computer with $0.00 cloud or hosting costs**. It requires no paid cloud servers, no paid MongoDB Atlas cluster, and no paid API keys.

### Option 1: 1-Click Windows Launcher (Recommended)
Simply double-click:
```
start-zenflow.bat
```
This batch script will:
1. Start the Python AI RAG Microservice on port `8000`.
2. Start the Node.js Gateway & static web server on port `5000`.
3. Automatically launch your default browser to `http://localhost:5000`.

To stop all services cleanly anytime, double-click `stop-zenflow.bat`.

---

### Option 2: Unified Node Server (Single Port 5000)
`server.js` now serves both the REST/Socket API Gateway **and** the frontend client:
```bash
# Terminal 1: AI Microservice
npm run ai:start

# Terminal 2: Web Gateway & Portal
npm start
```
Then open: **`http://localhost:5000`** (or `index.html`, `dashboard.html`, etc.)  
*(Live Server on port 5500 is completely optional).*

---

### Option 3: Docker Compose (One-Command Deployment)
If you have Docker Desktop installed, run:
```bash
docker compose up --build
```
Both the Python microservice and the Node gateway will spin up in isolated containers. Access the app at `http://localhost:5000`.

---

### Option 4: 100% Free Cloud Deployment
If you want to host ZenFlow on the public internet without paying a single dollar:
1. **Frontend + Node Gateway**: Deploy to [Render.com](https://render.com) (Free Web Service tier) or [Railway.app](https://railway.app). Set build command to `npm install` and start command to `node server.js`.
2. **AI Microservice**: Deploy the `ai-backend/` directory to [Hugging Face Spaces](https://huggingface.co/spaces) (Free Docker space running FastAPI) or Render Free Web Service.
3. **Database**: Use [MongoDB Atlas M0 Free Tier](https://www.mongodb.com/atlas) (512MB free forever). Set `MONGO_URI` in your cloud environment variables.

---

## 🧪 Testing & Verification

### 1. Automated Integration & Contract Test Suite
Executes end-to-end CRUD, deflection status transitions, real-time message arrays, and triage heuristics:
```bash
npm test
# or: node test_api.js
```

### 2. RAG Question Answering & Escalation Verification
Verify high-confidence deflection vs out-of-domain human escalation:
```bash
# In-domain deflection test:
python ai-backend/scripts/test_rag.py "How do I reset my password?"

# Out-of-domain escalation test:
python ai-backend/scripts/test_rag.py "Can you order pizza for the conference room?"
```

---

## 📂 Project Structure

```
zenflow-ai-main/
├── ai-backend/
│   ├── data/
│   │   ├── faqs/
│   │   │   └── faq.json           # 20+ categorized ITSM FAQs
│   │   └── faq.pdf                # PDF knowledge documentation
│   ├── rag/
│   │   ├── chatbot.py             # Orchestrator & deflection calculator
│   │   ├── config.py              # Microservice environment configuration
│   │   ├── embedder.py            # LangChain & ChromaDB embedding engine
│   │   ├── generator.py           # Grounded response synthesis
│   │   ├── loader.py              # Multi-source JSON/PDF document loader
│   │   ├── main.py                # FastAPI microservice application
│   │   └── retriever.py           # ChromaDB category-filtered retriever
│   ├── scripts/
│   │   ├── ingest.py              # Vector database ingestion pipeline
│   │   └── test_rag.py            # CLI verification script
│   └── requirements.txt           # Python dependencies
├── assets/
│   ├── css/
│   │   ├── dashboard.css          # Portal UI styles
│   │   └── style.css              # Authentication card styles
│   └── js/
│       └── script.js              # Shared client utilities
├── controllers/
│   └── ticketController.js        # ITSM ticket logic & aggregations
├── data/
│   └── tickets_store.json         # Resilient embedded ticket database
├── models/
│   ├── db.js                      # MongoDB connection manager
│   └── Ticket.js                  # Enterprise ITSM Mongoose schema & wrapper
├── routes/
│   └── ticketRoutes.js            # REST API route declarations
├── sockets/
│   └── ticketSocket.js            # Real-time WebSocket room manager
├── utils/
│   └── aiEngine.js                # AI triage & auto-reply drafting engine
├── ai-chat.html                   # Dedicated 24/7 AI virtual assistant
├── chat.html                      # Real-time ticket room collaboration
├── create-ticket.html             # Ticket creation & deflection modal
├── dashboard.html                 # Operations center & deflection telemetry
├── history.html                   # Ticket search, filtering & details
├── index.html                     # Login & registration portal
├── profile.html                   # User profile settings
├── server.js                      # Express Gateway & Socket.io server
├── test_api.js                    # Automated integration test suite
├── .env.example                   # Environment variable template
└── package.json                   # Node.js project manifest & scripts
```

---

## 🛡️ License & Contributors
Developed by the ZenFlow Engineering Team. All rights reserved.
