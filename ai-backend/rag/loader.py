# ai-backend/rag/loader.py - Multi-Source Knowledge Base Loader
import json
import os
from typing import List
from langchain_core.documents import Document
from rag.config import FAQ_JSON_PATH, FAQ_PDF_PATH

def load_documents() -> List[Document]:
    documents = []

    # 1. Load JSON FAQs
    if os.path.exists(FAQ_JSON_PATH):
        try:
            with open(FAQ_JSON_PATH, "r", encoding="utf-8") as f:
                faqs = json.load(f)

            for item in faqs:
                title = item.get("title", "FAQ")
                category = item.get("category", "General")
                question = item.get("question", "")
                answer = item.get("answer", "")

                text = f"Title: {title}\nCategory: {category}\nQuestion: {question}\nAnswer: {answer}"
                doc = Document(
                    page_content=text.strip(),
                    metadata={
                        "title": title,
                        "category": category,
                        "question": question,
                        "answer": answer,
                        "source": "FAQ_JSON"
                    }
                )
                documents.append(doc)
            print(f"Loaded {len(faqs)} FAQ documents from JSON.")
        except Exception as e:
            print(f"Error loading JSON FAQs: {e}")

    # 2. Load PDF FAQ / Knowledge document
    if os.path.exists(FAQ_PDF_PATH):
        try:
            import pypdf
            reader = pypdf.PdfReader(str(FAQ_PDF_PATH))
            pdf_text = ""
            for i, page in enumerate(reader.pages):
                extracted = page.extract_text()
                if extracted:
                    pdf_text += extracted + "\n"

            if pdf_text.strip():
                # Split PDF into paragraphs / questions
                sections = pdf_text.strip().split("\n\n")
                for s_idx, sec in enumerate(sections):
                    clean_sec = sec.strip()
                    if clean_sec:
                        doc = Document(
                            page_content=clean_sec,
                            metadata={
                                "title": f"ZenFlow Knowledge Guide (Section {s_idx + 1})",
                                "category": "General",
                                "source": "FAQ_PDF"
                            }
                        )
                        documents.append(doc)
                print(f"Loaded {len(reader.pages)} PDF pages from {FAQ_PDF_PATH}.")
        except Exception as e:
            print(f"Error loading PDF FAQ: {e}")

    return documents

if __name__ == "__main__":
    docs = load_documents()
    print("Total documents loaded:", len(docs))
    if docs:
        print("Sample:", docs[0].page_content[:200])
