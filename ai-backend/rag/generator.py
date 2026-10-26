# ai-backend/rag/generator.py - Grounded Response Generator
import re
from langchain_core.prompts import ChatPromptTemplate
from rag.config import (
    GOOGLE_API_KEY,
    LLM_MODEL,
    is_gemini_active
)

SYSTEM_PROMPT = """You are ZenFlow's AI Support Assistant.

Use ONLY the provided context to answer the user's question.

You may use the conversation history to understand what the user is referring to,
but you must NEVER use information from the conversation history as factual
knowledge unless it is supported by the provided context.

If the context does not contain enough information to answer the question, reply with exactly:

CANNOT_ANSWER_ESCALATE_TO_HUMAN

Do not invent or assume any information. Provide clear, empathetic, and actionable step-by-step guidance.

Conversation History:
{chat_history}

Context:
{context}

Current Question:
{question}
"""

prompt = ChatPromptTemplate.from_template(SYSTEM_PROMPT)

def generate_response(question: str, context: str, chat_history: str = "") -> str:
    # 1. If live Gemini API key is configured, invoke LangChain ChatGoogleGenerativeAI
    if is_gemini_active():
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            llm = ChatGoogleGenerativeAI(
                model=LLM_MODEL,
                google_api_key=GOOGLE_API_KEY,
                temperature=0.2
            )
            messages = prompt.format_messages(
                chat_history=chat_history,
                context=context,
                question=question
            )
            response = llm.invoke(messages)
            content = response.content

            if isinstance(content, list):
                result = "".join(item.get("text", "") for item in content if isinstance(item, dict)).strip()
            else:
                result = str(content).strip()

            if result:
                return result
        except Exception as e:
            print(f"Notice: Google GenAI generation notice ({e}). Using grounded fallback synthesizer.")

    # 2. Resilient Context-Grounded Synthesizer (Offline & Mock mode)
    if not context or not context.strip():
        return "CANNOT_ANSWER_ESCALATE_TO_HUMAN"

    # Verify semantic keyword overlap between question and context
    q_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', question.lower()))
    ctx_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', context.lower()))
    stopwords = {"the", "and", "for", "with", "that", "this", "what", "how", "why", "who", "when", "where", "can", "does", "are"}
    meaningful_q = q_words - stopwords

    overlap = meaningful_q.intersection(ctx_words)
    if not overlap:
        # No semantic overlap between user question and knowledge base chunks
        return "CANNOT_ANSWER_ESCALATE_TO_HUMAN"

    # Search for matching Answer blocks in context chunks
    # Find chunk with highest keyword overlap
    chunks = context.split("\n\n")
    best_chunk = ""
    best_score = 0
    for ch in chunks:
        ch_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', ch.lower()))
        score = len(meaningful_q.intersection(ch_words))
        if score > best_score:
            best_score = score
            best_chunk = ch

    if best_chunk:
        ans_match = re.search(r"Answer:\s*(.+?)(?=\nTitle:|\nCategory:|\Z)", best_chunk, re.DOTALL | re.IGNORECASE)
        if ans_match:
            return ans_match.group(1).strip()
        return best_chunk.strip()

    return "CANNOT_ANSWER_ESCALATE_TO_HUMAN"
