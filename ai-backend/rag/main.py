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
