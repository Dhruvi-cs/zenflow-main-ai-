# ZenFlow — Bug Fix & Regression Report
**Document ID:** `08_bug_fix_and_regression_report.md`  
**Audit Date:** October 27, 2026  
**Auditor:** Senior Software Test Engineer & Lead AI Systems Engineer  

---

## 1. Defect Classification & Resolution Matrix

During testing and live user trials, the following defects were diagnosed, reproduced, remediated, and verified through automated regression suites:

---

### Defect 1: Docker Build Context Failure on Render
- **Defect ID:** `DEF-01`
- **Severity:** P0 (Critical - Build Blocking)
- **Component:** `ai-backend/Dockerfile`
- **Reproduction:** Setting Render service Root Directory to `ai-backend` caused `COPY ai-backend/requirements.txt ./` to fail with `failed to calculate checksum ... "/ai-backend": not found`.
- **Root Cause:** Redundant path prefix in Dockerfile when build context is set to the subfolder.
- **Fix:** Refactored Dockerfile to copy from `./requirements.txt` and `./`, added entrypoint forwarder `ai-backend/main.py`.
- **Status:** **VERIFIED & CLOSED** (Commit `31f1dce`).

---

### Defect 2: Hardcoded Localhost URLs in Gateway & Controllers
- **Defect ID:** `DEF-02`
- **Severity:** P1 (High - Cloud Integration Failure)
- **Component:** `server.js`, `aiRoutes.js`, `controllers/ticketController.js`
- **Reproduction:** Node gateway failed to call live AI microservice in production because endpoints were hardcoded to `http://127.0.0.1:8000`.
- **Root Cause:** Missing `process.env.AI_SERVICE_URL` environment variable interpolation.
- **Fix:** Updated all proxy calls to inspect `process.env.AI_SERVICE_URL` with dynamic path handling.
- **Status:** **VERIFIED & CLOSED** (Commit `1afd6c4`).

---

### Defect 3: Navigation Sidebar Overlapping Chat Window
- **Defect ID:** `DEF-03`
- **Severity:** P2 (Medium - UI Layout Defect)
- **Component:** `chat.html`
- **Reproduction:** Navigating to `chat.html?ticketId=...` showed the dark sidebar obscuring the first 250px of the chat header and message input field.
- **Root Cause:** Container used `.chat-wrapper` which lacked `margin-left: 250px`.
- **Fix:** Added `margin-left: 250px; width: calc(100% - 250px);` and mobile responsive media queries.
- **Status:** **VERIFIED & CLOSED** (Commit `6b432ba`).

---

### Defect 4: Premature Escalation Overwriting Knowledge Base Answers
- **Defect ID:** `DEF-04`
- **Severity:** P1 (High - Chatbot Functional Defect)
- **Component:** `ai-backend/rag/chatbot.py`, `ai-backend/rag/generator.py`
- **Reproduction:** Questions like *"explain ticket policies"* returned *"Ticket logged in support queue..."* instead of the answer.
- **Root Cause:** `similarity_score < 0.60` check unconditionally replaced valid answers with the generic queue escalation message.
- **Fix:** Modified engine to deliver grounded answers whenever found, added plural/singular keyword stemming.
- **Status:** **VERIFIED & CLOSED** (Commit `6b432ba`).

---

### Defect 5: Absurd / Non-Work Personal Inquiries Escalating to Human IT Queue
- **Defect ID:** `DEF-05`
- **Severity:** P2 (Medium - Workflow Logic Defect)
- **Component:** `ai-backend/rag/chatbot.py`
- **Reproduction:** Queries like *"can u dance with me ?"* and *"can I order pizza?"* logged support tickets for human IT specialists.
- **Root Cause:** Missing enterprise domain scope filter.
- **Fix:** Implemented non-work intent classifier. Returns polite workplace boundary without escalating to human queue.
- **Status:** **VERIFIED & CLOSED** (Commit `0d7ac0b`).

---

### Defect 6: Missing Model Diagnostics / Identity Handling
- **Defect ID:** `DEF-06`
- **Severity:** P3 (Low - Diagnostic Defect)
- **Component:** `ai-backend/rag/chatbot.py`
- **Reproduction:** Asking *"are u connected to gemini?"* resulted in a failed ticket escalation message.
- **Root Cause:** System lacked self-identity heuristics.
- **Fix:** Added diagnostic query interceptor that returns active LLM status, ChromaDB info, and instructions for setting `GOOGLE_API_KEY`.
- **Status:** **VERIFIED & CLOSED** (Commit `0d7ac0b`).

---

### Defect 7: Resilient Store `findById` Instance Methods & `findByIdAndDelete`
- **Defect ID:** `DEF-07`
- **Severity:** P2 (Medium - Model Contract Defect)
- **Component:** `models/Ticket.js`
- **Reproduction:** Calling `ticket.save()` on a fetched document or `Ticket.findByIdAndDelete()` failed when operating in local JSON fallback mode.
- **Root Cause:** Plain object was returned without wrapping in `TicketWrapper`, and `findByIdAndDelete` was missing.
- **Fix:** Implemented `findByIdAndDelete` and wrapped return objects in `TicketWrapper`.
- **Status:** **VERIFIED & CLOSED** (Commit `0d7ac0b`).
