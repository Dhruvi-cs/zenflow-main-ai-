FROM python:3.11-slim
WORKDIR /app
COPY ai-backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY ai-backend/ ./ai-backend/
EXPOSE 8000
CMD ["uvicorn", "ai-backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
