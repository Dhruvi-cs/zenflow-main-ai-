# ai-backend/rag/generator.py - Grounded Response Generator
import re
from langchain_core.prompts import ChatPromptTemplate
from rag.config import (
    GOOGLE_API_KEY,
    LLM_MODEL,
    is_gemini_active
)

SYSTEM_PROMPT = """You are ZenFlow, an intelligent enterprise IT Service Management (ITSM) and technical support assistant.

Your role is to assist company employees and customers using the provided company documentation context.

Guidelines:
1. Grounding: Answer clearly, accurately, and step-by-step using the provided company context.
2. Tone: Professional, helpful, empathetic, and concise.
3. Chit-Chat / Greetings: If the user says hello or asks how you are, respond warmly and let them know what IT topics you can assist with.
4. Non-Work Requests: If the user asks for food, personal travel, movies, or non-work topics, politely explain that you are an enterprise IT assistant and cannot assist with personal errands.
5. Incomplete Context: If the context does not contain enough specific details to resolve an IT issue, explain what is known and advise that the ticket can be escalated to an IT support specialist.

Conversation History:
{chat_history}

Company Documentation Context:
{context}

User Question:
{question}
"""

prompt = ChatPromptTemplate.from_template(SYSTEM_PROMPT)

def stem_word(w: str) -> str:
    w = w.lower()
    if w.endswith('ies') and len(w) > 4: return w[:-3] + 'y'
    if w.endswith('ing') and len(w) > 4: return w[:-3]
    if w.endswith('ed') and len(w) > 3: return w[:-2]
    if w.endswith('es') and len(w) > 3: return w[:-2]
    if w.endswith('s') and not w.endswith('ss') and len(w) > 3: return w[:-1]
    return w

def generate_response(question: str, context: str, chat_history: str = "") -> str:
    import os

    # 1. Attempt Groq API (Ultra-fast enterprise Llama 3.3 70B generative completion)
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    if groq_key and not groq_key.startswith("mock_") and len(groq_key) >= 20:
        try:
            import urllib.request
            import urllib.error
            import json
            g_url = "https://api.groq.com/openai/v1/chat/completions"
            prompt_full = f"{SYSTEM_PROMPT}\n\nConversation History:\n{chat_history}\n\nCompany Documentation Context:\n{context}\n\nUser Question:\n{question}"
            g_payload = json.dumps({
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "user", "content": prompt_full}
                ],
                "temperature": 0.2,
                "max_tokens": 800
            }).encode("utf-8")
            g_req = urllib.request.Request(
                g_url,
                data=g_payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {groq_key}",
                    "User-Agent": "ZenFlow-ITSM/1.0"
                }
            )
            with urllib.request.urlopen(g_req, timeout=12) as g_resp:
                g_data = json.loads(g_resp.read().decode("utf-8"))
                g_txt = g_data["choices"][0]["message"]["content"].strip()
                if g_txt:
                    print("[GROQ] Successfully generated response with llama-3.3-70b-versatile")
                    return g_txt
        except urllib.error.HTTPError as ghe:
            err_b = ghe.read().decode("utf-8", errors="ignore")
            print(f"[GROQ HTTP ERROR] Code {ghe.code}: {err_b}")
        except Exception as ge:
            print(f"[GROQ NOTICE] {ge}")

    # 2. Attempt Google Gemini API (Direct REST + LangChain)
    if is_gemini_active():
        # Attempt 2A: Native REST API via urllib (Zero external dependencies, 100% reliable across environments)
        try:
            import urllib.request
            import urllib.error
            import json
            prompt_str = f"{SYSTEM_PROMPT}\n\nConversation History:\n{chat_history}\n\nCompany Documentation Context:\n{context}\n\nUser Question:\n{question}"
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{LLM_MODEL}:generateContent?key={GOOGLE_API_KEY}"
            payload = json.dumps({
                "contents": [{"parts": [{"text": prompt_str}]}],
                "generationConfig": {"temperature": 0.2, "maxOutputTokens": 800}
            }).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": GOOGLE_API_KEY
                }
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    txt = "".join(p.get("text", "") for p in parts).strip()
                    if txt:
                        print(f"[GEMINI] Successfully generated response with {LLM_MODEL}")
                        return txt
        except urllib.error.HTTPError as http_err:
            err_body = http_err.read().decode("utf-8", errors="ignore")
            print(f"[GEMINI HTTP ERROR] Code {http_err.code}: {err_body}")
        except Exception as rest_e:
            print(f"[GEMINI REST NOTICE] {type(rest_e).__name__}: {rest_e}")

        # Attempt 2B: LangChain ChatGoogleGenerativeAI
        try:
            os.environ["GEMINI_API_KEY"] = GOOGLE_API_KEY
            os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY
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
            print(f"[GEMINI LANGCHAIN NOTICE] {e}")

    # 3. Resilient Context-Grounded Synthesizer (Offline & Fallback mode)
    if not context or not context.strip():
        return "CANNOT_ANSWER_ESCALATE_TO_HUMAN"

    # Extract clean chunks
    chunks = [c.strip() for c in context.split("\n\n") if c.strip()]
    if not chunks:
        return "CANNOT_ANSWER_ESCALATE_TO_HUMAN"

    # Tokenize and stem query keywords
    stopwords = {"the", "and", "for", "with", "that", "this", "what", "how", "why", "who", "when", "where", "can", "does", "are", "you", "your", "explain", "tell", "about", "please"}
    raw_q_words = [w.lower() for w in re.findall(r'\b[a-zA-Z]{3,}\b', question)]
    meaningful_q = [w for w in raw_q_words if w not in stopwords]
    stemmed_q = set(stem_word(w) for w in meaningful_q)

    # Score each chunk
    scored_chunks = []
    for ch in chunks:
        ch_lower = ch.lower()
        ch_tokens = [w.lower() for w in re.findall(r'\b[a-zA-Z]{3,}\b', ch_lower)]
        ch_stemmed = set(stem_word(w) for w in ch_tokens)

        # Calculate exact and stemmed matches
        exact_matches = sum(1 for w in meaningful_q if w in ch_tokens)
        stem_matches = len(stemmed_q.intersection(ch_stemmed))
        matches_count = exact_matches + stem_matches

        # Title relevance boost
        title_line = next((l for l in ch.splitlines() if l.startswith("Title:")), "").lower()
        title_matches = sum(3 for w in meaningful_q if w in title_line)

        # Only give phrase boost if at least one query word actually matched
        phrase_boost = 2 if (matches_count > 0 and any(ph in ch_lower for ph in ["ticket policy", "priority", "password reset", "refund", "resolution"])) else 0

        total_score = exact_matches * 2 + stem_matches + title_matches + phrase_boost if (matches_count > 0 or title_matches > 0) else 0
        scored_chunks.append((total_score, ch))

    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    best_score, best_chunk = scored_chunks[0]

    # If the user asked specifically about policies or rules and multiple relevant chunks exist:
    if "polic" in question.lower() or "rule" in question.lower():
        policy_answers = []
        for _, ch in scored_chunks[:2]:
            ans_m = re.search(r"Answer:\s*(.+?)(?=\nTitle:|\nCategory:|\Z)", ch, re.DOTALL | re.IGNORECASE)
            title_m = re.search(r"Title:\s*(.+?)(?=\nCategory:|\nQuestion:|\Z)", ch, re.IGNORECASE)
            if ans_m:
                t = title_m.group(1).strip() if title_m else "Policy"
                policy_answers.append(f"• **{t}**: {ans_m.group(1).strip()}")
        if policy_answers:
            return "Here are the relevant ZenFlow support policies:\n\n" + "\n\n".join(policy_answers)

    # If we have any matched chunk, extract its clean Answer
    if best_score > 0:
        for _, ch in scored_chunks:
            ans_match = re.search(r"Answer:\s*(.+?)(?=\nTitle:|\nCategory:|\Z)", ch, re.DOTALL | re.IGNORECASE)
            if ans_match:
                return ans_match.group(1).strip()
        clean_lines = [l for l in best_chunk.splitlines() if not l.startswith("Source:") and not l.startswith("Category:")]
        return "\n".join(clean_lines).strip()

    # Out of domain query
    return "CANNOT_ANSWER_ESCALATE_TO_HUMAN"
