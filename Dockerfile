# syntax=docker/dockerfile:1
# Build from repo root: docker build -t career-analyzer .
# Serves Vite static files + FastAPI (mcp_http) on port 8001

# Node is only used to build static assets; final runtime image is Python.
# Pin Node patch version to pick up upstream security fixes deterministically.
FROM node:22.20.0-bookworm-slim AS frontend
ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /frontend
RUN apt-get update \
  && apt-get full-upgrade -y \
  && apt-get autoremove -y --purge \
  && rm -rf /var/lib/apt/lists/*
COPY Frontend/package.json Frontend/package-lock.json ./
RUN npm install
COPY Frontend/ ./
# Same-origin API in container (browser calls /mcp/run on this host)
ARG VITE_MCP_BASE_URL=
ENV VITE_MCP_BASE_URL=${VITE_MCP_BASE_URL}
RUN npm run build

# Use rolling patch tag so rebuilds pick up Debian/Python security updates.
# `full-upgrade` applies security fixes in the base OS (common source of "high" CVEs in scans).
FROM python:3.12-slim-bookworm
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY Backend/requirements.txt .
RUN apt-get update \
  && apt-get full-upgrade -y \
  && apt-get install -y --no-install-recommends libpq-dev \
  && apt-get autoremove -y --purge \
  && rm -rf /var/lib/apt/lists/* \
  && pip install --upgrade pip setuptools wheel \
  && pip install --no-cache-dir -r requirements.txt

# Create non-root user
RUN adduser --disabled-password --no-create-home --gecos "" appuser

COPY Backend/ .
COPY --from=frontend /frontend/dist ./dist
ENV FRONTEND_DIST=/app/dist
EXPOSE 8001

# Switch to non-root user
USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')" || exit 1

CMD ["sh", "-c", "python -m alembic upgrade head && python -m uvicorn mcp_http:app --host 0.0.0.0 --port 8001"]
