# ai-backend/rag/embedder.py - Knowledge Base Embedder & Vector DB Engine
import math
import re
import hashlib
from typing import List
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_core.embeddings import Embeddings

from rag.config import (
    GOOGLE_API_KEY,
    EMBEDDING_MODEL,
    VECTOR_DB_PATH,
    is_gemini_active
)
from rag.loader import load_documents

class FastSemanticEmbeddings(Embeddings):
    """
    High-performance, deterministic 384-dimensional n-gram semantic vectorizer.
    Guarantees 100% offline functionality without external network dependencies.
    """
    dim = 384

    def _embed(self, text: str) -> List[float]:
        vec = [0.0] * self.dim
        tokens = re.findall(r'\b\w+\b', text.lower())
        if not tokens:
            return vec

        # Use 1-grams and 2-grams for semantic n-gram matching
        features = tokens.copy()
        for i in range(len(tokens) - 1):
            features.append(tokens[i] + '_' + tokens[i + 1])

        for feat in features:
            h = int(hashlib.md5(feat.encode('utf-8')).hexdigest(), 16)
            idx = h % self.dim
            sign = 1.0 if ((h >> 8) & 1) else -1.0
            vec[idx] += sign

        # Unit-norm normalization
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        return vec

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._embed(t) for t in texts]

    def embed_query(self, text: str) -> List[float]:
        return self._embed(text)

    def __call__(self, input: List[str]) -> List[List[float]]:
        return self.embed_documents(input)

def get_embeddings():
    if is_gemini_active():
        try:
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            return GoogleGenerativeAIEmbeddings(
                model=EMBEDDING_MODEL,
                google_api_key=GOOGLE_API_KEY
            )
        except Exception as e:
            print(f"Notice: Google GenAI Embeddings unavailable ({e}). Activating internal semantic embeddings.")
    return FastSemanticEmbeddings()

def create_chunks():
    documents = load_documents()
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    chunks = splitter.split_documents(documents)
    print(f"Created {len(chunks)} text chunks from knowledge documents.")
    return chunks

def create_vector_db():
    chunks = create_chunks()
    embeddings = get_embeddings()

    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=str(VECTOR_DB_PATH)
    )

    print(f"✅ Vector database created successfully at: {VECTOR_DB_PATH}")
    return vectorstore

if __name__ == "__main__":
    create_vector_db()
