"""Run local LLM analysis using saved Apify output from data.json (no Apify call)."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, Dict, List

import sys

# Ensure project root is on path so `ai_backend` can be imported when running from Data/
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ai_backend import analyze_profile, extract_profile_structured


def _load_apify_json(data_file: Path) -> Dict[str, Any]:
    """Load Apify output JSON and return one profile object."""
    payload = json.loads(data_file.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        if not payload:
            raise ValueError("data.json list is empty")
        first = payload[0]
        if not isinstance(first, dict):
            raise ValueError("First item in data.json is not an object")
        return first
    if isinstance(payload, dict):
        return payload
    raise ValueError("Unsupported data.json format. Expected object or list of objects.")


async def main() -> None:
    """Load local Apify JSON and run extraction + analysis through LLM."""
    data_path = Path("Data/data1.json")
    output_path = Path("Data/local_llm_output2.json")
    if not data_path.exists():
        raise FileNotFoundError(f"Missing file: {data_path.resolve()}")

    apify_item = _load_apify_json(data_path)
    raw_text = json.dumps(apify_item, ensure_ascii=True)

    profile = await extract_profile_structured("apify_local_json", raw_text)
    result = await analyze_profile(profile, data_source="apify_local_json")

    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=True), encoding="utf-8")
    print(json.dumps(result, indent=2, ensure_ascii=True))
    print(f"\nSaved output to: {output_path.resolve()}")


if __name__ == "__main__":
    asyncio.run(main())