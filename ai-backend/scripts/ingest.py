# ai-backend/scripts/ingest.py - Ingestion & Knowledge Base Vectorization Pipeline
import sys
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Set up project path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from rag.config import FAQ_JSON_PATH, FAQ_PDF_PATH, VECTOR_DB_PATH
from rag.loader import load_documents
from rag.embedder import create_chunks, get_embeddings
from langchain_chroma import Chroma

def ingest():
    print("=" * 60)
    print("[ZenFlow] Knowledge Base Ingestion Pipeline Starting")
    print(f"JSON Source : {FAQ_JSON_PATH}")
    print(f"PDF Source  : {FAQ_PDF_PATH}")
    print(f"Vector DB   : {VECTOR_DB_PATH}")
    print("=" * 60)

    # 1. Load documents
    raw_documents = load_documents()
    print(f"Total raw documents loaded: {len(raw_documents)}")

    if not raw_documents:
        print("[ERROR] No documents found to ingest.")
        return

    # 2. Chunking
    chunks = create_chunks()
    print(f"Generated {len(chunks)} chunks for semantic vectorization.")

    # 3. Vectorization with ChromaDB
    embeddings = get_embeddings()
    print("[INIT] Initializing embeddings and generating Chroma collection...")

    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=str(VECTOR_DB_PATH)
    )

    count = vectorstore._collection.count()
    print(f"[SUCCESS] Ingestion complete! {count} chunks embedded and indexed in ChromaDB.")
    print("=" * 60)

if __name__ == "__main__":
    ingest()
