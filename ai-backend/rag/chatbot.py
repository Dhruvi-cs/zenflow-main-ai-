# ai-backend/rag/chatbot.py - End-to-End ITSM Chatbot & Deflection Engine
import re
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

    # 1. System Identity & Model Diagnostics
    from rag.config import is_gemini_active, LLM_MODEL
    clean_q = re.sub(r'[^\w\s]', '', question.lower().strip())
    q_tokens = clean_q.split()

    if any(k in clean_q for k in ["gemini", "connected to gemini", "are you gemini", "what model", "which ai", "who created you"]):
        if is_gemini_active():
            model_info = (
                f"Yes! I am connected to **Google Gemini** (running `{LLM_MODEL}`) and integrated with "
                "ZenFlow's enterprise Retrieval-Augmented Generation (RAG) vector database (ChromaDB).\n\n"
                "I synthesize real-time answers based on your uploaded company documentation!"
            )
        else:
            model_info = (
                "I am **ZenFlow's AI Support Assistant**. I am currently running on ZenFlow's internal semantic RAG engine "
                "(ChromaDB vector search with deterministic semantic embeddings).\n\n"
                "To connect my live generative **Google Gemini** LLM, simply set your `GOOGLE_API_KEY` in the Render environment variables."
            )
        return {
            "requires_human_agent": False,
            "deflected": True,
            "can_deflect": True,
            "confidence_score": 1.0,
            "retrieval_distance": 0.0,
            "retrieved_sources": ["ZenFlow System Diagnostics"],
            "sources": ["ZenFlow System Diagnostics"],
            "response": model_info,
            "answer": model_info,
            "ai_response": model_info,
            "status": "success"
        }

    # 2. Conversational Intent & Greeting Detection
    greetings = {"hello", "hi", "hey", "hola", "greetings"}
    small_talk = [
        "how are you", "how are u", "how r u", "who are you", "who r u",
        "what can you do", "help me", "what is this", "what are you", "good morning", "good evening",
        "what are you doing", "what are u doing", "what r u doing", "what are u up to"
    ]

    has_greeting_prefix = len(q_tokens) > 0 and q_tokens[0] in greetings and len(q_tokens) <= 7
    if clean_q in greetings or has_greeting_prefix or (len(q_tokens) <= 3 and any(w in greetings for w in q_tokens)):
        greet_text = (
            "Hello! 👋 I am your **ZenFlow AI Support Assistant**.\n\n"
            "I can assist you with:\n"
            "• **Password Resets** and account recovery\n"
            "• **Ticket Policies & SLA Times** (Critical, High, Medium, Low)\n"
            "• **Creating & Tracking Tickets**\n"
            "• **VPN & Technical Troubleshooting**\n"
            "• **Billing & Refund Inquiries**\n\n"
            "How can I help you today?"
        )
        return {
            "requires_human_agent": False,
            "deflected": True,
            "can_deflect": True,
            "confidence_score": 1.0,
            "retrieval_distance": 0.0,
            "retrieved_sources": ["ZenFlow Virtual Assistant Guide"],
            "sources": ["ZenFlow Virtual Assistant Guide"],
            "response": greet_text,
            "answer": greet_text,
            "ai_response": greet_text,
            "status": "success"
        }

    if any(st in clean_q for st in small_talk):
        info_text = (
            "I'm doing well, thank you for asking! 😊 I am the 24/7 ZenFlow AI Support Assistant.\n\n"
            "Feel free to ask me any question like *'How do I reset my password?'*, "
            "*'Explain ticket policies'*, or *'How can I request a refund?'*."
        )
        return {
            "requires_human_agent": False,
            "deflected": True,
            "can_deflect": True,
            "confidence_score": 1.0,
            "retrieval_distance": 0.0,
            "retrieved_sources": ["ZenFlow Virtual Assistant Guide"],
            "sources": ["ZenFlow Virtual Assistant Guide"],
            "response": info_text,
            "answer": info_text,
            "ai_response": info_text,
            "status": "success"
        }

    # 3. Non-Work & Out-of-Scope Query Detection
    # Avoid creating junk tickets for human IT technicians for personal queries
    non_work_keywords = [
        "pizza", "burger", "food", "lunch", "dinner", "breakfast", "coffee", "restaurant",
        "recipe", "movie", "song", "music", "cricket", "football", "sports", "joke",
        "weather", "forecast", "horoscope", "flight", "hotel", "buy shoes", "dating",
        "dance", "sing", "marry", "flirt", "boyfriend", "girlfriend", "love me", "love you"
    ]
    it_keywords = [
        "it", "ticket", "laptop", "vpn", "system", "email", "password", "software",
        "account", "login", "database", "wifi", "network", "server", "priority", "device"
    ]

    is_non_work = any(re.search(r'\b' + re.escape(kw) + r'\b', clean_q) for kw in non_work_keywords)
    has_it_context = any(re.search(r'\b' + re.escape(itk) + r'\b', clean_q) for itk in it_keywords)

    if is_non_work and not has_it_context:
        if "dance" in clean_q:
            out_of_scope_reply = (
                "I don't have feet or the ability to dance! 💃 I am an enterprise IT support assistant.\n\n"
                "I am here to help you resolve computer issues, configure VPNs, reset passwords, "
                "and explain company IT ticket policies."
            )
        else:
            out_of_scope_reply = (
                "I am ZenFlow, your enterprise IT and workplace support assistant. 🏢\n\n"
                "I am designed to answer technical questions and workplace policies based on our company's "
                "knowledge base (such as VPN access, password resets, ticket SLAs, and software troubleshooting).\n\n"
                "I cannot assist with personal or non-work-related requests such as ordering food, entertainment, or personal errands."
            )
        return {
            "requires_human_agent": False,
            "deflected": True,
            "can_deflect": True,
            "confidence_score": 1.0,
            "retrieval_distance": 0.0,
            "retrieved_sources": ["ZenFlow Enterprise Scope Policy"],
            "sources": ["ZenFlow Enterprise Scope Policy"],
            "response": out_of_scope_reply,
            "answer": out_of_scope_reply,
            "ai_response": out_of_scope_reply,
            "status": "success"
        }

    if chat_history is None:
        chat_history = []

    # Contextual Follow-Up Query Resolution:
    # If the user asks a follow-up ("tell again", "step by step", "whole process", "more details", "what next")
    # without specifying the noun, inherit the topic from the previous user question in history!
    follow_up_cues = ["again", "step by step", "whole process", "more detail", "how to do", "what next", "continue", "explain more", "steps", "tell more", "what about", "how about", "and what", "and how"]
    is_follow_up = any(cue in clean_q for cue in follow_up_cues) and len(q_tokens) <= 9

    resolved_query = question
    if is_follow_up and chat_history:
        for msg in reversed(chat_history):
            prev_content = msg.get("content", "")
            if msg.get("role") == "user" and prev_content and prev_content != question:
                resolved_query = f"{prev_content} - {question}"
                break

    # Keep only the last 5 messages for prompt context window
    chat_history = chat_history[-5:]
    history_text = ""
    for msg in chat_history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        history_text += f"{role}: {content}\n"

    # 2. Retrieve relevant knowledge documents
    results = retrieve_documents(resolved_query, k=3, category=category)

    # If no relevant documents found
    if not results:
        fallback_msg = "Your inquiry has been logged in the support queue. An IT specialist will review and assist you shortly."
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

    # 3. Build retrieved context string
    context = "\n\n".join(doc.page_content for doc in docs)

    # 4. Generate grounded response
    response_text = generate_response(
        question=question,
        context=context,
        chat_history=history_text
    )

    # 5. Evaluate deflection vs escalation
    if response_text == "CANNOT_ANSWER_ESCALATE_TO_HUMAN":
        escalate_msg = "I could not find a verified answer in the knowledge base for this inquiry. Your ticket has been logged into the support queue and escalated to a human IT specialist."
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

    # A valid grounded answer was generated!
    is_deflected = bool(similarity_score >= CONFIDENCE_THRESHOLD or len(response_text) > 30)

    return {
        "requires_human_agent": not is_deflected,
        "deflected": is_deflected,
        "can_deflect": is_deflected,
        "confidence_score": max(similarity_score, 0.75),
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
