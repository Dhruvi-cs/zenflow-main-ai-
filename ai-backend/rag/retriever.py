# ai-backend/rag/retriever.py - Knowledge Base Document Retriever
import os
from typing import List, Tuple
from langchain_chroma import Chroma
from langchain_core.documents import Document

from rag.config import VECTOR_DB_PATH
from rag.embedder import get_embeddings, create_vector_db

_db_instance = None

def get_vector_db() -> Chroma:
    global _db_instance
    if _db_instance is not None:
        return _db_instance

    embeddings = get_embeddings()

    # If vector store directory doesn't exist or is empty, build it automatically
    if not os.path.exists(VECTOR_DB_PATH) or not os.listdir(VECTOR_DB_PATH):
        print("Vector database not found. Generating from knowledge base...")
        _db_instance = create_vector_db()
        return _db_instance

    try:
        _db_instance = Chroma(
            persist_directory=str(VECTOR_DB_PATH),
            embedding_function=embeddings
        )
    except Exception as e:
        print(f"Error opening existing vector store ({e}). Rebuilding...")
        _db_instance = create_vector_db()

    return _db_instance

def retrieve_documents(query: str, k: int = 3, category: str = None) -> List[Tuple[Document, float]]:
    db = get_vector_db()
    results = []

    # 1. Try category-filtered retrieval if specific category is supplied
    if category and category.lower() not in ["general", "all", "other", "support request"]:
        try:
            results = db.similarity_search_with_score(
                query,
                k=k,
                filter={"category": category}
            )
        except Exception as e:
            print(f"Category filter notice ({e}). Falling back to global search.")
            results = []

    # 2. If filtered search yielded no results, query across entire knowledge base
    if not results:
        results = db.similarity_search_with_score(
            query,
            k=k
        )

    print(f"\n🔍 Retrieved {len(results)} Documents for query: '{query}':")
    for i, (doc, score) in enumerate(results, start=1):
        title = doc.metadata.get("title", "Untitled")
        cat = doc.metadata.get("category", "General")
        print(f"  [{i}] Score: {score:.4f} | {title} ({cat})")
        print(f"      Snippet: {doc.page_content[:120]}...")

    return results

if __name__ == "__main__":
    test_q = "How do I reset my password?"
    retrieve_documents(test_q)
