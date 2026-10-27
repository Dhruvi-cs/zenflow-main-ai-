# testing/test_rag_pipeline.py - Comprehensive RAG, Embedder & Deflection Test Suite
import sys
import re
from pathlib import Path

# Add project root and ai-backend to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
AI_BACKEND = PROJECT_ROOT / "ai-backend"
sys.path.insert(0, str(AI_BACKEND))

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

from rag.config import (
    FAQ_JSON_PATH,
    FAQ_PDF_PATH,
    VECTOR_DB_PATH,
    CONFIDENCE_THRESHOLD,
    is_gemini_active,
    LLM_MODEL
)
from rag.loader import load_documents
from rag.embedder import FastSemanticEmbeddings, get_embeddings
from rag.retriever import get_vector_db, retrieve_documents
from rag.chatbot import ask_chatbot

def run_rag_tests():
    print("=" * 70)
    print("🧪 PHASE 4 & 5: AI MICROSERVICE, RAG PIPELINE & GROUNDING AUDIT")
    print("=" * 70)

    passed = 0
    failed = 0

    def test(test_id, name, fn):
        nonlocal passed, failed
        try:
            print(f"• [{test_id}] {name}...", end=" ")
            fn()
            print("✅ PASS")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ ERROR: {e}")
            failed += 1

    # 1. Knowledge Base Files Check
    def test_sources():
        assert FAQ_JSON_PATH.exists(), f"JSON FAQ file missing at {FAQ_JSON_PATH}"
        assert FAQ_PDF_PATH.exists(), f"PDF FAQ file missing at {FAQ_PDF_PATH}"
    test("TC-RAG-01", "Knowledge base source documents existence", test_sources)

    # 2. Document Loader Check
    def test_loader():
        docs = load_documents()
        assert len(docs) >= 20, f"Expected at least 20 raw documents, loaded {len(docs)}"
        json_docs = [d for d in docs if d.metadata.get("source") == "FAQ_JSON"]
        pdf_docs = [d for d in docs if d.metadata.get("source") == "FAQ_PDF"]
        assert len(json_docs) > 0, "No JSON FAQ documents loaded"
        assert len(pdf_docs) > 0, "No PDF documents loaded"
    test("TC-RAG-02", "Multi-source document loader (JSON + PDF)", test_loader)

    # 3. FastSemanticEmbeddings Determinism & Dimensionality
    def test_embedder():
        emb = FastSemanticEmbeddings()
        v1 = emb.embed_query("password reset")
        v2 = emb.embed_query("password reset")
        assert len(v1) == 384, f"Embedding dimensionality must be 384, got {len(v1)}"
        assert v1 == v2, "Embeddings must be 100% deterministic"
    test("TC-RAG-03", "Semantic embedding vectorizer dimensionality & determinism", test_embedder)

    # 4. ChromaDB Vector Store Persistence
    def test_chroma():
        db = get_vector_db()
        assert db is not None, "ChromaDB instance must be initialized"
        coll = db._collection
        count = coll.count()
        assert count > 0, f"ChromaDB collection must have indexed chunks, found {count}"
    test("TC-RAG-04", "ChromaDB persistent collection connectivity & chunk count", test_chroma)

    # 5. In-Domain RAG Retrieval
    def test_retrieval():
        results = retrieve_documents("How do I reset my password?", k=3)
        assert len(results) > 0, "Retrieval should return matching chunks"
        titles = [doc.metadata.get("title", "") for doc, _ in results]
        assert any("Password" in t for t in titles), f"Expected 'Password' in retrieved titles: {titles}"
    test("TC-RAG-05", "In-domain similarity retrieval and top-k ranking", test_retrieval)

    # 6. High-Confidence Deflection Answer Generation
    def test_deflection_flow():
        res = ask_chatbot("How do I reset my password?")
        assert res["deflected"] == True, "In-domain password query must be deflected"
        assert res["requires_human_agent"] == False, "Deflected query should not require human agent"
        assert "Forgot Password" in res["answer"], "Answer must provide actionable password reset guidance"
        assert len(res["retrieved_sources"]) > 0, "Response must include source citations"
    test("TC-RAG-06", "High-confidence ticket deflection and actionable answer delivery", test_deflection_flow)

    # 7. Greeting & Conversational Intent
    def test_greeting():
        res = ask_chatbot("hello what are u doing")
        assert res["deflected"] == True, "Greeting should be handled by virtual assistant"
        assert res["requires_human_agent"] == False, "Greeting should not escalate to human IT queue"
        assert "ZenFlow AI Support Assistant" in res["answer"], "Bot must identify itself warmly"
    test("TC-RAG-07", "Conversational greeting intent handling", test_greeting)

    # 8. Model Diagnostics & Self-Identity
    def test_identity():
        res = ask_chatbot("are u connected to gemini?")
        assert res["deflected"] == True, "Identity query should be handled"
        assert res["requires_human_agent"] == False, "Identity query should not escalate"
        assert "ZenFlow" in res["answer"] or "Gemini" in res["answer"], "Answer must disclose architecture"
    test("TC-RAG-08", "System architecture & model diagnostics inquiry", test_identity)

    # 9. Out-of-Scope Non-Work Refusal (Pizza / Social Requests)
    def test_out_of_scope():
        res1 = ask_chatbot("can u dance with me ?")
        assert res1["requires_human_agent"] == False, "Absurd/playful requests must not create human tickets"
        assert "dance" in res1["answer"].lower() or "enterprise it" in res1["answer"].lower()

        res2 = ask_chatbot("can I order pizza for the meeting?")
        assert res2["requires_human_agent"] == False, "Food orders must not create human IT tickets"
        assert "cannot assist" in res2["answer"].lower() or "personal" in res2["answer"].lower()
    test("TC-RAG-09", "Non-work domain filtering & junk ticket prevention", test_out_of_scope)

    # 10. Legitimate Unanswered IT Issue Escalation
    def test_it_escalation():
        res = ask_chatbot("The physical cooling fan inside server rack 4 is throwing sparking errors")
        assert res["requires_human_agent"] == True, "Unanswered complex technical issue must escalate"
        assert res["deflected"] == False, "Unanswered query must not be flagged as deflected"
    test("TC-RAG-10", "Unresolvable technical inquiry escalation to human queue", test_it_escalation)

    print("=" * 70)
    print(f"RAG AUDIT SUMMARY: {passed} PASSED | {failed} FAILED (Total: {passed + failed})")
    print("=" * 70)

    if failed > 0:
        sys.exit(1)
    sys.exit(0)

if __name__ == "__main__":
    run_rag_tests()
