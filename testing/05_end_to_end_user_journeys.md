# ZenFlow — End-to-End User Journeys Report
**Document ID:** `05_end_to_end_user_journeys.md`  
**Audit Date:** October 27, 2026  
**Auditor:** Principal Full-Stack QA Architect  

---

## 1. Overview of Evaluated Journeys

Five primary real-world user workflows were tested across the client and backend layers:

---

### Journey A: Authentication & User Profile Persistence
1. **User Login**: User enters credentials on `index.html`. Session stored in browser `localStorage` (`zenflow_user`, `zenflow_email`).
2. **Profile Inspection**: Navigates to `profile.html`. Form auto-populates with cached user data and synchronizes via `GET /api/profile`.
3. **Profile Modification**: User updates department to *"Cloud Security"* and clicks Save. State updates via `PUT /api/profile` and propagates to chat headers.
4. **Logout**: Clicking Logout revokes active session state and redirects safely to `index.html`.
- **Verdict:** **PASS**

---

### Journey B: IT Support Ticket Lifecycle & Escalation
1. **Ticket Creation**: Employee logs a ticket titled *"Database desynchronization on worker node 2"*.
2. **AI Triage**: Triage engine assigns category `Technical Issue` and urgency `High`. Ticket created with status `Open`.
3. **Agent Assignment**: IT technician changes status to `In-Progress` and assigns `Senior Ops Engineer`.
4. **Resolution**: Issue resolved. Status transitioned to `Resolved`.
5. **Dashboard Reflection**: Telemetry dashboard immediately updates open vs. resolved ticket counts.
- **Verdict:** **PASS**

---

### Journey C: AI Ticket Deflection & Knowledge Search
1. **Inquiry Input**: User opens `create-ticket.html` and types *"How do I reset my password?"*.
2. **RAG Vector Search**: Frontend dispatches query to `/api/tickets`. Node gateway queries the Python FastAPI microservice at `/api/v1/rag/query`.
3. **Retrieval**: ChromaDB retrieves chunk from `faq.json` (Category: Account, Score: 1.02).
4. **Deflection Offer**: Frontend renders deflection modal with match confidence (75%) and verified solution.
5. **Acceptance**: User clicks *"Accept Solution & Mark Resolved"*. Ticket transitioned to `Deflected` and saved without human intervention.
- **Verdict:** **PASS**

---

### Journey D: Knowledge Ingestion Pipeline
1. **Source Documents**: `faq.json` (20 items) and `faq.pdf` (ITSM FAQ document) processed by `rag/loader.py`.
2. **Text Chunking**: Document split via `RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)`.
3. **Vectorization**: 23 chunks transformed into 384-dimensional vectors and written to persistent ChromaDB collection.
4. **Verification**: Querying *"What are the ticket priority levels?"* immediately returns the 4 tiers (Critical, High, Medium, Low).
- **Verdict:** **PASS**

---

### Journey E: Real-Time Ticket Room Collaboration
1. **Session Initialization**: User opens `chat.html?ticketId=tk_test123`.
2. **Room Partitioning**: Socket.io connects and emits `join_ticket(tk_test123)`.
3. **History Hydration**: Server emits `load_history` and renders past conversation.
4. **Live Messaging**: Technician sends updates. Messages append to UI and persist to database.
5. **Typing Indicators**: Typing fires `user_typing` and `user_stopped_typing` without causing UI jitter.
- **Verdict:** **PASS**
