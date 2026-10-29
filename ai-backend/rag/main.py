# ai-backend/rag/main.py - FastAPI RAG Microservice
import os
import sys
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure root of ai-backend is on python sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from rag.chatbot import ask_chatbot
from rag.retriever import get_vector_db

app = FastAPI(
    title="ZenFlow AI RAG Microservice",
    description="Enterprise Knowledge Retrieval, Ticket Deflection, and Generative Assistance API",
    version="1.0.0"
)

# 1. Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Schemas
class QueryRequest(BaseModel):
    query: str = Field(..., description="The user question or support query")
    category: str = Field(default="General", description="Ticket category")
    chat_history: Optional[List[Dict[str, str]]] = Field(default=None, description="Recent conversation turns")

class QueryResponse(BaseModel):
    answer: str
    ai_response: str
    response: str
    deflected: bool
    can_deflect: bool
    requires_human_agent: bool
    confidence_score: float
    category: str
    retrieved_sources: List[str]
    sources: List[str]
    status: str

# 3. Endpoints
@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "ZenFlow AI RAG Microservice",
        "version": "1.0.0",
        "architecture": "FastAPI + ChromaDB + LangChain + Gemini RAG"
    }

@app.get("/api/v1/health")
def health_check():
    try:
        db = get_vector_db()
        count = db._collection.count() if hasattr(db, "_collection") else "ready"
        vectordb_status = f"ready ({count} documents)"
    except Exception as e:
        vectordb_status = f"initialized ({e})"

    return {
        "status": "healthy",
        "service": "ZenFlow RAG Engine",
        "port": 8000,
        "vectordb": vectordb_status
    }

@app.get("/api/v1/debug-gemini")
def debug_gemini():
    from rag.config import GOOGLE_API_KEY, LLM_MODEL, is_gemini_active
    import urllib.request
    import urllib.error
    import json

    key_masked = ""
    if GOOGLE_API_KEY:
        k = GOOGLE_API_KEY.strip()
        key_masked = f"{k[:7]}...{k[-4:]} (length: {len(k)})"

    diagnostics = {
        "is_gemini_active": is_gemini_active(),
        "key_masked": key_masked,
        "model": LLM_MODEL,
        "tests": {}
    }

    if not GOOGLE_API_KEY:
        diagnostics["error"] = "GOOGLE_API_KEY is empty in environment"
        return diagnostics

    # Test 1: Direct urllib REST call with x-goog-api-key
    clean_key = GOOGLE_API_KEY.strip()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{LLM_MODEL}:generateContent?key={clean_key}"
    payload = json.dumps({"contents": [{"parts": [{"text": "Hello, reply with only the word ONLINE."}]}]}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json", "x-goog-api-key": clean_key})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            diagnostics["tests"]["urllib_rest"] = {"status": resp.status, "data": data}
    except urllib.error.HTTPError as he:
        diagnostics["tests"]["urllib_rest"] = {"status": he.code, "error": he.read().decode("utf-8", errors="ignore")}
    except Exception as e:
        diagnostics["tests"]["urllib_rest"] = {"error": str(e)}

    # Test 2: LangChain ChatGoogleGenerativeAI
    try:
        import os
        os.environ["GEMINI_API_KEY"] = clean_key
        os.environ["GOOGLE_API_KEY"] = clean_key
        from langchain_google_genai import ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(model=LLM_MODEL, google_api_key=clean_key, temperature=0.1)
        res = llm.invoke("Hello, reply with ONLINE.")
        diagnostics["tests"]["langchain"] = {"status": "success", "content": str(res.content)}
    except Exception as le:
        diagnostics["tests"]["langchain"] = {"error": str(le)}

    return diagnostics

@app.get("/api/v1/diagnostics")
@app.get("/api/v1/debug-groq")
def debug_groq_and_all():
    from rag.config import GOOGLE_API_KEY, GROQ_API_KEY, LLM_MODEL, is_gemini_active, is_groq_active, get_active_provider
    import urllib.request
    import urllib.error
    import json

    groq_masked = ""
    if GROQ_API_KEY:
        k = GROQ_API_KEY.strip()
        groq_masked = f"{k[:7]}...{k[-4:]} (length: {len(k)})"

    gemini_masked = ""
    if GOOGLE_API_KEY:
        k = GOOGLE_API_KEY.strip()
        gemini_masked = f"{k[:7]}...{k[-4:]} (length: {len(k)})"

    diag = {
        "active_provider": get_active_provider(),
        "groq": {
            "key_configured": bool(GROQ_API_KEY),
            "key_masked": groq_masked,
            "is_active": is_groq_active(),
            "live_test": {}
        },
        "gemini": {
            "key_configured": bool(GOOGLE_API_KEY),
            "key_masked": gemini_masked,
            "is_active": is_gemini_active(),
            "model": LLM_MODEL
        }
    }

    # Live test Groq
    if GROQ_API_KEY:
        try:
            g_url = "https://api.groq.com/openai/v1/chat/completions"
            g_payload = json.dumps({
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": "Reply with only ONLINE."}],
                "max_tokens": 10
            }).encode("utf-8")
            g_req = urllib.request.Request(
                g_url,
                data=g_payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {GROQ_API_KEY.strip()}",
                    "User-Agent": "ZenFlow-ITSM/1.0"
                }
            )
            with urllib.request.urlopen(g_req, timeout=10) as r:
                data = json.loads(r.read().decode("utf-8"))
                diag["groq"]["live_test"] = {
                    "status": "connected_200",
                    "reply": data["choices"][0]["message"]["content"].strip()
                }
        except urllib.error.HTTPError as he:
            diag["groq"]["live_test"] = {
                "http_status": he.code,
                "error": he.read().decode("utf-8", errors="ignore")
            }
        except Exception as e:
            diag["groq"]["live_test"] = {"error": str(e)}

    return diag

@app.post("/api/v1/rag/query", response_model=QueryResponse)
@app.post("/api/v1/rag/chat", response_model=QueryResponse)
async def query_rag(payload: QueryRequest):
    if not payload.query or not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query string cannot be empty.")

    try:
        result = ask_chatbot(
            question=payload.query.strip(),
            category=payload.category,
            chat_history=payload.chat_history
        )

        return QueryResponse(
            answer=result.get("answer", ""),
            ai_response=result.get("ai_response", ""),
            response=result.get("response", ""),
            deflected=result.get("deflected", False),
            can_deflect=result.get("can_deflect", False),
            requires_human_agent=result.get("requires_human_agent", False),
            confidence_score=result.get("confidence_score", 0.0),
            category=payload.category,
            retrieved_sources=result.get("retrieved_sources", []),
            sources=result.get("sources", []),
            status=result.get("status", "success")
        )
    except Exception as e:
        print(f"Error processing RAG query: {e}")
        fallback_msg = "ZenFlow AI encountered an error while processing your request. Your ticket has been forwarded to human support."
        return QueryResponse(
            answer=fallback_msg,
            ai_response=fallback_msg,
            response=fallback_msg,
            deflected=False,
            can_deflect=False,
            requires_human_agent=True,
            confidence_score=0.2,
            category=payload.category,
            retrieved_sources=[],
            sources=[],
            status="error"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("rag.main:app", host="127.0.0.1", port=8000, reload=True)
