# ai-backend/rag/chatbot.py - End-to-End ITSM Chatbot & Deflection Engine
from typing import Dict, Any, List, Optional
from rag.retriever import retrieve_documents
from rag.generator import generate_response
from rag.config import CONFIDENCE_THRESHOLD

def ask_chatbot(
    question: str,
    category: Optional[str] = None,
    chat_history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    if not question or not question.strip():
        return {
            "requires_human_agent": True,
            "deflected": False,
            "can_deflect": False,
            "confidence_score": 0.0,
            "retrieval_distance": None,
            "retrieved_sources": [],
            "sources": [],
            "response": "Please enter a valid question or issue description.",
            "answer": "Please enter a valid question or issue description.",
            "ai_response": "Please enter a valid question or issue description.",
            "status": "error"
        }

    if chat_history is None:
        chat_history = []

    # Keep only the last 5 messages for prompt context window
    chat_history = chat_history[-5:]
    history_text = ""
    for msg in chat_history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        history_text += f"{role}: {content}\n"

    # 1. Retrieve relevant knowledge documents
    results = retrieve_documents(question, k=3, category=category)

    # If no relevant documents found
    if not results:
        fallback_msg = "Your ticket has been logged into the support queue. A human specialist will review your request shortly."
        return {
            "requires_human_agent": True,
            "deflected": False,
            "can_deflect": False,
            "confidence_score": 0.20,
            "retrieval_distance": 2.0,
            "retrieved_sources": [],
            "sources": [],
            "response": fallback_msg,
            "answer": fallback_msg,
            "ai_response": fallback_msg,
            "status": "success"
        }

    docs = []
    scores = []
    sources = []

    for doc, score in results:
        docs.append(doc)
        scores.append(score)
        src_title = doc.metadata.get("title") or doc.metadata.get("source") or "ZenFlow Knowledge Base"
        if src_title not in sources:
            sources.append(src_title)

    best_distance = min(scores)

    # Normalized confidence score: distance <= 1.0 -> 0.70+, distance >= 1.5 -> 0.0
    similarity_score = round(max(0.0, min(1.0, 1.0 - (best_distance - 0.7) / 1.0)), 2)

    # 2. Build retrieved context string
    context = "\n\n".join(doc.page_content for doc in docs)

    # 3. Generate grounded response
    response_text = generate_response(
        question=question,
        context=context,
        chat_history=history_text
    )

    # 4. Evaluate deflection threshold
    if response_text == "CANNOT_ANSWER_ESCALATE_TO_HUMAN" or similarity_score < CONFIDENCE_THRESHOLD:
        escalate_msg = "Ticket logged in support queue. An IT support specialist will assist you with this specialized inquiry."
        return {
            "requires_human_agent": True,
            "deflected": False,
            "can_deflect": False,
            "confidence_score": similarity_score,
            "retrieval_distance": best_distance,
            "retrieved_sources": sources,
            "sources": sources,
            "response": escalate_msg,
            "answer": escalate_msg,
            "ai_response": escalate_msg,
            "status": "success"
        }

    return {
        "requires_human_agent": False,
        "deflected": True,
        "can_deflect": True,
        "confidence_score": similarity_score,
        "retrieval_distance": best_distance,
        "retrieved_sources": sources,
        "sources": sources,
        "response": response_text,
        "answer": response_text,
        "ai_response": response_text,
        "status": "success"
    }

def get_rag_response(question: str, category: Optional[str] = None) -> str:
    result = ask_chatbot(question, category=category)
    return result.get("answer", "")
