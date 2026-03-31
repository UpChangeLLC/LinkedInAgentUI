# Deprecated: use the Dockerfile at the repository root.
# Build:  docker build -t career-analyzer -f Dockerfile ..
# Or from repo root: docker build -t career-analyzer .

FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt
COPY . .
EXPOSE 8001
CMD ["python", "-m", "uvicorn", "mcp_http:app", "--host", "0.0.0.0", "--port", "8001"]
