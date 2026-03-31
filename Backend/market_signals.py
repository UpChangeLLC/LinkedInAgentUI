"""Market signals ingestion and retrieval for role-based job recommendations.

Features:
- Build discoverable sources per role (link-only; no API keys required)
- Optional HTTP fetch and basic extraction (guarded by MARKET_FETCH_ENABLE)
- Chunking, embedding, and JSONL-based vector store
- Retrieval of fresh, role-filtered signals for UI enrichment
"""

from __future__ import annotations

import asyncio
import dataclasses
import hashlib
import json
import math
import os
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

import httpx

# Embeddings: use OpenAI if available via environment (same as project setup)
try:
    from openai import AsyncOpenAI
except Exception:  # pragma: no cover
    AsyncOpenAI = None  # type: ignore


# ---------- Data Models ----------

@dataclass
class MarketSource:
    title: str
    url: str
    role: str


@dataclass
class MarketDocument:
    id: str
    role: str
    url: str
    title: str
    published_at: Optional[str]
    fetched_at: float
    content: str


@dataclass
class MarketChunk:
    id: str
    role: str
    url: str
    title: str
    content: str
    chunk_index: int
    published_at: Optional[str]
    fetched_at: float


# ---------- Utilities ----------

def _env_bool(name: str, default: bool = False) -> bool:
    raw = (os.getenv(name, "") or "").strip().lower()
    if raw in ("1", "true", "yes", "on"):
        return True
    if raw in ("0", "false", "no", "off"):
        return False
    return bool(default)


def _hash_id(*parts: str) -> str:
    h = hashlib.sha1()
    for p in parts:
        h.update((p or "").encode("utf-8"))
        h.update(b"\x00")
    return h.hexdigest()


def _now() -> float:
    return time.time()


def _clean_text(html: str) -> str:
    # naive extraction: strip scripts/styles/tags; keep text
    txt = re.sub(r"(?is)<script.*?>.*?</script>", " ", html)
    txt = re.sub(r"(?is)<style.*?>.*?</style>", " ", txt)
    txt = re.sub(r"(?is)<[^>]+>", " ", txt)
    txt = re.sub(r"[ \t\r\f\v]+", " ", txt)
    txt = re.sub(r"\n\s*\n+", "\n", txt)
    return txt.strip()


def _chunk_text(text: str, max_tokens: int = 350, overlap: int = 50) -> List[str]:
    # token-approx via words; simple splitter
    words = text.split()
    if not words:
        return []
    step = max(1, max_tokens - overlap)
    chunks: List[str] = []
    for i in range(0, len(words), step):
        chunk_words = words[i : i + max_tokens]
        if not chunk_words:
            continue
        chunks.append(" ".join(chunk_words))
    return chunks


def _cosine(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


# ---------- Source Discovery ----------

def build_discovery_sources_for_role(role: str) -> List[MarketSource]:
    q_role = (role or "AI role").replace(" ", "+")
    base: List[Tuple[str, str]] = [
        ("Google News", f"https://news.google.com/search?q={q_role}+hiring+2026"),
        ("Google Search", f"https://www.google.com/search?q={q_role}+market+trends+2026"),
        ("LinkedIn Jobs", f"https://www.linkedin.com/jobs/search/?keywords={q_role}"),
        ("GitHub Trending AI", "https://github.com/trending?since=monthly"),
    ]
    return [MarketSource(title=t, url=u, role=role) for (t, u) in base]


# ---------- Fetch / Parse ----------

async def _fetch_url(client: httpx.AsyncClient, url: str, timeout: float = 12.0) -> Optional[str]:
    try:
        resp = await client.get(url, follow_redirects=True, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code >= 200 and resp.status_code < 300:
            ct = (resp.headers.get("content-type") or "").lower()
            if "text/html" in ct or "text/plain" in ct:
                return resp.text
    except Exception:
        return None
    return None


async def fetch_documents_for_role(role: str, allow_fetch: bool = False) -> List[MarketDocument]:
    sources = build_discovery_sources_for_role(role)
    docs: List[MarketDocument] = []
    fetched_at = _now()
    if not allow_fetch:
        # Return stub docs with no content; useful for link rendering only
        for s in sources:
            docs.append(
                MarketDocument(
                    id=_hash_id(s.url, role),
                    role=role,
                    url=s.url,
                    title=s.title,
                    published_at=None,
                    fetched_at=fetched_at,
                    content="",
                )
            )
        return docs

    async with httpx.AsyncClient() as client:
        tasks = [asyncio.create_task(_fetch_url(client, s.url)) for s in sources]
        pages = await asyncio.gather(*tasks, return_exceptions=True)
    for s, page in zip(sources, pages):
        html = page if isinstance(page, str) else None
        content = _clean_text(html or "")
        docs.append(
            MarketDocument(
                id=_hash_id(s.url, role),
                role=role,
                url=s.url,
                title=s.title,
                published_at=None,
                fetched_at=fetched_at,
                content=content,
            )
        )
    return docs


def build_chunks(docs: List[MarketDocument]) -> List[MarketChunk]:
    chunks: List[MarketChunk] = []
    for d in docs:
        parts = _chunk_text(d.content) if d.content else [""]
        for idx, part in enumerate(parts):
            chunks.append(
                MarketChunk(
                    id=_hash_id(d.id, str(idx)),
                    role=d.role,
                    url=d.url,
                    title=d.title,
                    content=part,
                    chunk_index=idx,
                    published_at=d.published_at,
                    fetched_at=d.fetched_at,
                )
            )
    return chunks


# ---------- Embeddings ----------

async def embed_texts(texts: List[str], model: str) -> List[List[float]]:
    if not texts:
        return []
    if AsyncOpenAI is None:
        raise RuntimeError("openai package not available for embeddings")
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"), base_url=os.getenv("OPENAI_BASE_URL") or None)
    # Batch to avoid token limits
    batch_size = 64
    out: List[List[float]] = []
    for i in range(0, len(texts), batch_size):
        chunk = texts[i : i + batch_size]
        resp = await client.embeddings.create(model=model, input=chunk)
        out.extend([item.embedding for item in resp.data])
    return out


# ---------- Vector Store (JSONL) ----------

class JsonlVectorStore:
    def __init__(self, path: str) -> None:
        self.path = path
        self._records: Dict[str, Dict[str, Any]] = {}
        self._loaded = False

    def load(self) -> None:
        if self._loaded:
            return
        self._records = {}
        if os.path.exists(self.path):
            with open(self.path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                        self._records[obj["id"]] = obj
                    except Exception:
                        continue
        self._loaded = True

    def save(self) -> None:
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            for obj in self._records.values():
                f.write(json.dumps(obj, ensure_ascii=False) + "\n")
        os.replace(tmp, self.path)

    def upsert_many(self, rows: List[Dict[str, Any]]) -> None:
        for r in rows:
            self._records[r["id"]] = r
        self.save()

    def query(
        self,
        query_embedding: List[float],
        role: Optional[str] = None,
        top_k: int = 8,
        min_score: float = 0.0,
        time_decay_sec: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        items = list(self._records.values())
        if role:
            items = [x for x in items if (x.get("role") or "").lower() == role.lower()]
        scored: List[Tuple[float, Dict[str, Any]]] = []
        now_ts = _now()
        for it in items:
            emb = it.get("embedding") or []
            score = _cosine(query_embedding, emb)
            # Optional mild time decay to prioritize recent content
            if time_decay_sec and (it.get("fetched_at")):
                age = max(0.0, now_ts - float(it["fetched_at"]))
                decay = math.exp(-age / float(time_decay_sec))
                score *= (0.6 + 0.4 * decay)
            if score >= min_score:
                scored.append((score, it))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [it for _, it in scored[: max(1, top_k)]]


# ---------- Pipeline ----------

async def ingest_roles(roles: List[str]) -> int:
    """Fetch (optional), chunk, embed, and upsert into the JSONL store. Returns upserted chunk count."""
    store_path = os.getenv("MARKET_VECTOR_STORE_PATH", "Data/market_vectors.jsonl")
    allow_fetch = _env_bool("MARKET_FETCH_ENABLE", False)
    embed_model = os.getenv("MARKET_EMBED_MODEL", "text-embedding-3-small")

    store = JsonlVectorStore(store_path)
    store.load()
    total = 0
    for role in roles:
        docs = await fetch_documents_for_role(role, allow_fetch=allow_fetch)
        chunks = build_chunks(docs)
        # Build embedding inputs; even empty content chunks get a minimal string to avoid empty vectors
        texts = [c.content or f"{c.title} {c.url}" for c in chunks]
        vectors = await embed_texts(texts, embed_model)
        rows: List[Dict[str, Any]] = []
        for c, emb in zip(chunks, vectors):
            rows.append(
                {
                    "id": c.id,
                    "role": c.role,
                    "url": c.url,
                    "title": c.title,
                    "content": c.content,
                    "chunk_index": c.chunk_index,
                    "published_at": c.published_at,
                    "fetched_at": c.fetched_at,
                    "embedding": emb,
                }
            )
        store.upsert_many(rows)
        total += len(rows)
    return total


async def retrieve_trend_signals_for_role(role: str, top_k: int = 6) -> Dict[str, Any]:
    """Query the vector store and summarize into trend signals and sources."""
    store_path = os.getenv("MARKET_VECTOR_STORE_PATH", "Data/market_vectors.jsonl")
    embed_model = os.getenv("MARKET_EMBED_MODEL", "text-embedding-3-small")
    store = JsonlVectorStore(store_path)
    store.load()
    # Build a role query embedding
    qtext = f"Recent market demand, hiring trends, skills in demand, and industry adoption for role: {role}"
    qvecs = await embed_texts([qtext], embed_model)
    if not qvecs:
        return {"trend_signals": [], "sources": []}
    qv = qvecs[0]
    hits = store.query(qv, role=role, top_k=top_k, time_decay_sec=60 * 60 * 24 * 14)  # 14-day decay horizon
    signals: List[str] = []
    sources: List[Dict[str, Any]] = []
    for h in hits:
        snippet = (h.get("content") or "").strip()
        if snippet:
            snippet_short = (snippet[:220] + "…") if len(snippet) > 240 else snippet
            signals.append(snippet_short)
        sources.append({"title": h.get("title") or h.get("url") or "source", "url": h.get("url") or ""})
    return {"trend_signals": signals[:6], "sources": sources[:6]}


# ---------- CLI Helper ----------

if __name__ == "__main__":  # pragma: no cover
    import argparse

    parser = argparse.ArgumentParser(description="Ingest and query market signals")
    sub = parser.add_subparsers(dest="cmd")

    p_ingest = sub.add_parser("ingest", help="Ingest roles")
    p_ingest.add_argument("--roles", nargs="+", required=True, help="Roles to ingest, e.g., 'AI PM' 'MLE'")

    p_query = sub.add_parser("query", help="Query trend signals for a role")
    p_query.add_argument("--role", required=True)
    p_query.add_argument("--top_k", type=int, default=6)

    args = parser.parse_args()

    if args.cmd == "ingest":
        count = asyncio.run(ingest_roles(args.roles))
        print(json.dumps({"upserted": count}, indent=2))
    elif args.cmd == "query":
        out = asyncio.run(retrieve_trend_signals_for_role(args.role, top_k=args.top_k))
        print(json.dumps(out, indent=2, ensure_ascii=False))
    else:
        parser.print_help()

