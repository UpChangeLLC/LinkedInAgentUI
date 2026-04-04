"""Shared test fixtures for the Backend test suite."""

from __future__ import annotations

import os
import sys
from unittest.mock import AsyncMock, patch

import pytest
import httpx

# Ensure Backend directory is on sys.path so imports resolve
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Set minimal env vars BEFORE importing app modules so dotenv/config doesn't blow up
os.environ.setdefault("DATABASE_URL", "")
os.environ.setdefault("REDIS_URL", "")
os.environ.setdefault("MCP_API_KEY", "")
os.environ.setdefault("OPENAI_API_KEY", "test-key-not-real")
os.environ.setdefault("AI_CLIENT", "openai")


@pytest.fixture(scope="session")
def app():
    """Create the FastAPI application (session-scoped to avoid repeated imports)."""
    from mcp_http import app as fastapi_app
    return fastapi_app


@pytest.fixture()
async def client(app):
    """Async httpx test client that talks to the FastAPI app via ASGI transport.

    This does NOT start a real server or require a database connection.
    """
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest.fixture()
def mock_db_session():
    """A mock async session factory that can be patched into routes needing DB.

    Usage in tests:
        with patch("db._session_factory", mock_db_session):
            ...
    """
    session = AsyncMock()
    session.__aenter__ = AsyncMock(return_value=session)
    session.__aexit__ = AsyncMock(return_value=False)
    return session
