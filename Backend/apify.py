"""Run Apify LinkedIn scraper without apify_client dependency."""

from __future__ import annotations

import os
from typing import Any, Dict, List

import requests


def _normalize_actor_ids(actor_id: str) -> List[str]:
    """Return possible API-safe actor id variants."""
    cleaned = actor_id.strip().strip("/")
    if not cleaned:
        return []
    variants = [cleaned]
    if "/" in cleaned:
        variants.append(cleaned.replace("/", "~", 1))
    if "~" in cleaned:
        variants.append(cleaned.replace("~", "/", 1))
    # Keep order and uniqueness
    deduped: List[str] = []
    for item in variants:
        if item not in deduped:
            deduped.append(item)
    return deduped


def run_actor(actor_id: str, token: str, run_input: Dict[str, Any]) -> Dict[str, Any]:
    """Start actor run and wait for completion."""
    params = {"token": token, "waitForFinish": 120}
    last_status = 0
    last_body = ""

    for candidate in _normalize_actor_ids(actor_id):
        url = f"https://api.apify.com/v2/acts/{candidate}/runs"
        response = requests.post(url, params=params, json=run_input, timeout=180)
        if response.ok:
            return response.json().get("data", {})
        last_status = response.status_code
        last_body = response.text[:300]
        if response.status_code not in {404, 400}:
            response.raise_for_status()

    raise RuntimeError(
        f"Actor run failed for id '{actor_id}'. "
        f"Tried variants: {_normalize_actor_ids(actor_id)} | "
        f"last_status={last_status} | response={last_body}"
    )


def get_dataset_items(dataset_id: str, token: str) -> List[Dict[str, Any]]:
    """Fetch dataset items produced by actor run."""
    url = f"https://api.apify.com/v2/datasets/{dataset_id}/items"
    params = {"token": token, "clean": "true"}
    response = requests.get(url, params=params, timeout=120)
    response.raise_for_status()
    data = response.json()
    return data if isinstance(data, list) else []


def main() -> None:
    token = (os.getenv("APIFY_API_TOKEN") or "").strip()
    if not token:
        raise RuntimeError("APIFY_API_TOKEN is not set")

    actor_id = "supreme_coder/linkedin-profile-scraper"
    run_input = {
        "urls": [{"url": "https://www.linkedin.com/in/yogesh-yadav-203216154"}],
        "findContacts.contactCompassToken": "",
    }
    run = run_actor(actor_id=actor_id, token=token, run_input=run_input)
    dataset_id = run.get("defaultDatasetId", "")
    if not dataset_id:
        raise RuntimeError("Actor run did not return a dataset id")

    print(f"Dataset: https://console.apify.com/storage/datasets/{dataset_id}")
    for item in get_dataset_items(dataset_id=dataset_id, token=token):
        print(item)


if __name__ == "__main__":
    main()
