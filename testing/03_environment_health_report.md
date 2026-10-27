# ZenFlow — Environment & Service Health Report
**Document ID:** `03_environment_health_report.md`  
**Audit Date:** October 27, 2026  
**Auditor:** Cloud Reliability Engineer & QA Architect  

---

## 1. Environment Topology Verification

Health and readiness probes were executed against both the local development environment and the cloud deployment infrastructure on Render.

| Environment | Service | Host / URL | Port | Health Status | Readiness Status |
|---|---|---|---|:---:|:---:|
| **Local Staging** | Web Gateway & Frontend | `http://127.0.0.1` | `5000` | **HEALTHY** (HTTP 200) | **READY** |
| **Local Staging** | AI RAG Microservice | `http://127.0.0.1` | `8000` | **HEALTHY** (HTTP 200) | **READY** |
| **Cloud Production**| Web Portal (`zenflow-web`) | `https://zenflow-web.onrender.com` | `443` | **HEALTHY** (HTTP 200) | **READY** |
| **Cloud Production**| AI RAG (`zenflow-service`) | `https://zenflow-service.onrender.com` | `443` | **HEALTHY** (HTTP 200) | **READY** |

---

## 2. Service-by-Service Health Telemetry

### 2.1 Backend Gateway (`/api/health`)
```json
{
  "status": "healthy",
  "gateway": "online",
  "database": "connected",
  "ai_microservice": "online",
  "timestamp": "2026-10-27T18:45:00.000Z"
}
```
- **Gateway Process**: Running Node.js v25.9.0 with event-driven Socket.io listener.
- **Database Subsystem**: Mongoose connection configured; local resilient JSON engine (`data/tickets_store.json`) active as high-availability fallback.
- **AI Proxy Route**: Dynamic proxy to `AI_SERVICE_URL` with 12000ms timeout budget.

### 2.2 AI Microservice (`/`)
```json
{
  "status": "online",
  "service": "ZenFlow AI RAG Microservice",
  "version": "1.0.0",
  "architecture": "FastAPI + ChromaDB + LangChain + Gemini RAG"
}
```
- **Vector Database**: ChromaDB initialized with persistent collection at `ai-backend/vectordb`.
- **Ingestion Pipeline**: 23 total chunks embedded and indexed (20 from `faq.json`, 3 from `faq.pdf`).
- **Embedding Subsystem**: `FastSemanticEmbeddings` operating at 384 dimensions with zero network latency.

---

## 3. Cloud Deployment Observations (Render Free Tier)

1. **Cold Starts**: When inactive for > 15 minutes, the free containers sleep. First request after dormancy requires 30–45s to wake up.
2. **Ephemeral Disk vs. Atlas**: In-container file modifications do not persist across restarts. Cloud persistence requires connecting the free MongoDB Atlas cluster via `MONGO_URI`.
3. **Dynamic Port Binding**: Services successfully bind to `${PORT:-5000}` and `${PORT:-8000}` according to cloud environment injection.
