# ai-backend/scripts/test_rag.py - RAG Verification Script
import sys
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from rag.chatbot import ask_chatbot

def test(question: str):
    print("=" * 60)
    print(f"Testing Question: {question}")
    print("=" * 60)

    result = ask_chatbot(question)

    print(f"Confidence Score  : {result.get('confidence_score')}")
    print(f"Deflected         : {result.get('deflected')}")
    print(f"Requires Human    : {result.get('requires_human_agent')}")
    print(f"Retrieved Sources : {result.get('retrieved_sources')}")
    print("-" * 60)
    print(f"AI Answer:\n{result.get('answer')}")
    print("=" * 60)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        q = " ".join(sys.argv[1:])
    else:
        q = "How do I reset my password?"
    test(q)
