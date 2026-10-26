FROM python:3.11-slim
WORKDIR /app

# 1. Install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 2. Copy all microservice source files
COPY . .

# 3. Run knowledge base ingestion
RUN python scripts/ingest.py

# 4. Microservice port
EXPOSE 8000

# 5. Start uvicorn with support for Render dynamic $PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
