"""FastMCP-based MCP server exposing backend tools over stdio.

Prereq:
  pip install fastmcp

Start (stdio):
  python fast_mcp.py

Client (Cursor/IDE MCP):
  - Transport: stdio
  - Command: python
  - Args: fast_mcp.py
  - CWD: project root
"""

from __future__ import annotations

import asyncio
import os
from typing import Any, Dict, Optional

try:
    # FastMCP public API (lightweight)
    from fastmcp import Server, stdio, tool  # type: ignore
except Exception as exc:  # pragma: no cover
    raise RuntimeError(
        "fastmcp is not installed. Install with: pip install fastmcp"
    ) from exc

from ai_backend import run_pipeline_with_trace


server = Server(name="ai-backend-fastmcp", version="0.1.0")


@tool(server, "run_pipeline", description="Run the career analysis pipeline. Provide linkedin_url and/or resume_text.")
async def run_pipeline_tool(
    linkedin_url: Optional[str] = None,
    resume_text: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute the backend pipeline and return analyzed JSON."""
    result, _ = await run_pipeline_with_trace(linkedin_url=linkedin_url or "", resume_text=resume_text or "")
    return result


async def main() -> None:
    # Optional debug logging toggle for FastMCP internals
    if os.getenv("MCP_DEBUG", "").strip().lower() in {"1", "true", "yes"}:
        os.environ.setdefault("FASTMCP_DEBUG", "1")
    await server.run(stdio())


if __name__ == "__main__":
    asyncio.run(main())

