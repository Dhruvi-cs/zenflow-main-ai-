# ZenFlow — Repository & Architecture Audit Report
**Document ID:** `01_repository_and_architecture_audit.md`  
**Audit Date:** October 27, 2026  
**Auditor:** Principal Full-Stack QA Architect & Lead AI Systems Engineer  
**Status:** Complete & Verified  

---

## 1. Executive Summary

A comprehensive architectural and repository audit of the **ZenFlow** platform was conducted on the production and staging codebase (`C:\Users\HP\.gemini\antigravity\scratch\zenflow-ai-main`). 

ZenFlow operates as a decoupled, multi-tier enterprise platform delivering:
1. **Automated Ticket Deflection** using Retrieval-Augmented Generation (RAG) over ChromaDB.
2. **IT Service Management (ITSM) Orchestration** with full lifecycle ticket state transitions.
3. **Bi-Directional Real-Time Collaboration** via room-partitioned WebSockets (Socket.io).
4. **Dual-Mode Persistence** with dynamic failover between MongoDB Atlas and an embedded resilient JSON store.

---

## 2. Multi-Service Topology & Port Mapping

```
[ Frontend Client Layer ] (HTML5 / Vanilla JS / CSS3)
       │ (Port 5000 - Unified Hosting via Express Static)
       ▼
[ Gateway & Business Orchestrator ] (Node.js, Express, Socket.io)
       │ (Port 5000)
       ├──► [ Database ] (MongoDB Atlas / Embedded Resilient JSON Engine)
       │
       ▼ (HTTP REST Proxy / timeout: 12000ms)
[ AI RAG Microservice ] (Python, FastAPI, LangChain, ChromaDB, Gemini LLM)
       │ (Port 8000 / Render: $PORT)
       ▼
[ Knowledge Vector DB ] (ChromaDB 384-dim FastSemanticEmbeddings)
       ▲
       └── [ Ingestion Pipeline ] (ai-backend/scripts/ingest.py <- FAQ JSON & PDF)
```

### Layer Inventory & Technical Specifications

| Layer | Component | Runtime / Framework | Local Port | Cloud Deployed URL |
|---|---|---|---|---|
| **Layer 1** | Frontend Client | HTML5, CSS3, Vanilla JS, Bootstrap 5 | 5000 (Unified) | `https://zenflow-web.onrender.com` |
| **Layer 2** | Gateway & Orchestrator | Node.js v25.9, Express, Socket.io | 5000 | `https://zenflow-web.onrender.com` |
| **Layer 3** | AI RAG Microservice | Python 3.11/3.14, FastAPI, LangChain | 8000 | `https://zenflow-service.onrender.com` |
| **Layer 4** | Ingestion & Vector DB | ChromaDB, PyPDF, FastSemanticEmbeddings | Local Disk | Embedded in container |

---

## 3. Detailed Component Inventory

### 3.1 Frontend Web Applications
- `index.html`: Enterprise Authentication portal, login/registration toggle, deflection preview modal.
- `dashboard.html`: Live telemetry operations center, KPI metric aggregation cards, recent ticket streams.
- `create-ticket.html`: Ticket submission interface with immediate AI RAG deflection suggestion and escalation triggers.
- `history.html`: Searchable ticket audit table, category/status multi-filters, and ticket detail inspection modal.
- `ai-chat.html`: Dedicated 24/7 Virtual Support Assistant with real-time markdown rendering and source citations.
- `chat.html`: Bi-directional ticket room collaboration interface with live typing telemetry.
- `profile.html`: User profile settings and cached local state synchronizer.

### 3.2 Backend Gateway & Orchestrator (`server.js`)
- Express gateway mounting static assets, CORS handlers, and JSON body parsers.
- Socket.io room server partitioning connections by `ticket_<id>`.
- Reverse-proxy routing for AI requests (`/api/ai/chat`, `/api/ai/query`) with automatic fallback.
- Ticket REST APIs (`/api/tickets`) backed by `ticketController.js`.
- Health check endpoints (`/api/health`, `/api`).

### 3.3 AI RAG Microservice (`ai-backend/`)
- `rag/main.py` & `main.py`: FastAPI entrypoints exposing `/api/v1/rag/query`, health probes, and schema validation.
- `rag/chatbot.py`: Orchestrator handling conversational intent, non-work domain rejection, and deflection evaluation.
- `rag/generator.py`: Grounded answer synthesizer with Google Gemini LLM integration (`gemini-1.5-flash`) and offline keyword fallback.
- `rag/retriever.py`: Category-partitioned similarity retriever over ChromaDB.
- `rag/embedder.py`: Deterministic 384-dimensional `FastSemanticEmbeddings` vectorizer.
- `rag/loader.py`: Dual-source loader for `faq.json` and `faq.pdf`.

---

## 4. Architectural Strengths & Resiliency Patterns

1. **Zero-Dependency Local Fallback**: When MongoDB or external internet is unavailable, the backend seamlessly writes to `data/tickets_store.json` without failing any user requests.
2. **Dimension Consistency**: By fixing `FastSemanticEmbeddings` as the vectorizer, the system completely avoids ChromaDB dimensionality mismatch crashes during offline/online transitions.
3. **Conversational Guardrails**: Non-work requests (pizza, food, dancing) are cleanly deflected at the AI layer rather than creating garbage tickets in human technician queues.
