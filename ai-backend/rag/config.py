# ai-backend/rag/config.py - AI Microservice Configuration
import os
from pathlib import Path
from dotenv import load_dotenv

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
FAQ_JSON_PATH = DATA_DIR / "faqs" / "faq.json"
FAQ_PDF_PATH = DATA_DIR / "faq.pdf"
VECTOR_DB_PATH = BASE_DIR / "vectordb"

# Load .env from ai-backend or project root
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.60"))
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "models/text-embedding-004")
raw_model = os.getenv("LLM_MODEL", "gemini-1.5-flash").strip()
LLM_MODEL = "gemini-1.5-flash" if ("2.5" in raw_model or not raw_model) else raw_model

def is_gemini_active() -> bool:
    if not GOOGLE_API_KEY:
        return False
    k = GOOGLE_API_KEY
    if k.startswith("mock_") or "your_" in k or "<your" in k or k == "":
        return False
    return len(k) >= 20

def is_groq_active() -> bool:
    if not GROQ_API_KEY:
        return False
    k = GROQ_API_KEY
    if k.startswith("mock_") or "your_" in k or "<your" in k or k == "":
        return False
    return len(k) >= 20 and k.startswith("gsk_")

def get_active_provider() -> str:
    if is_groq_active():
        return "Groq (Llama 3.3 70B)"
    if is_gemini_active():
        return f"Google Gemini ({LLM_MODEL})"
    return "Internal Semantic Vector RAG"
