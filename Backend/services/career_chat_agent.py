"""Career Analyst / Mentor chat agent with optional tool-use loop (OpenAI-compatible APIs)."""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

CAREER_MENTOR_SYSTEM = """You are an expert Career Analyst and Career Mentor specializing in AI-era employability,
role evolution, and evidence-based career decisions. You combine analytical rigor with supportive coaching.

Guidelines:
- Ground advice in the user's stated context and any assessment summary provided; never invent employers or credentials.
- Be concise but actionable: prefer concrete next steps over generic encouragement.
- When the user asks for frameworks, rubrics, or structured guidance, call the career_framework_lookup tool before answering.
- If a question is outside career/professional development, politely redirect to career topics.
- Do not claim to browse the live web unless a tool explicitly returned external data.
"""


# Short internal reference snippets (tool-grounded "agentic" step).
_FRAMEWORK_KB: Dict[str, str] = {
    "skill_pivot": (
        "Skill pivot (AI era): (1) Map tasks in your role to automation exposure. "
        "(2) Pick 1–2 adjacent high-demand skills tied to revenue or risk. "
        "(3) Prove proficiency with a small public artifact (doc, repo, case write-up)."
    ),
    "visibility": (
        "Professional visibility: articulate outcomes (metrics, scope, constraints) not only responsibilities. "
        "Align public narrative (profile, talks, writing) with the role you want next, not only the role you have."
    ),
    "risk_hedging": (
        "Career risk hedging: diversify proof (skills + network + reputation), maintain an employability runway "
        "(liquidity + learning cadence), and revisit role-market fit quarterly as tooling shifts."
    ),
    "learning_agenda": (
        "Learning agenda: 70% practice on realistic deliverables, 20% feedback from peers or mentors, "
        "10% theory. Tie each block to a hiring-manager-observable output."
    ),
    "interview_story": (
        "Interview stories (STAR+): Situation/Task with business stakes, your Actions with tradeoffs, "
        "Results quantified where possible, plus Reflection on what you'd change—shows mature judgment."
    ),
}


TOOLS_OPENAI: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "career_framework_lookup",
            "description": (
                "Fetch a concise, reusable career framework snippet for the requested topic. "
                "Call this when the user asks for structure, how-to, rubrics, or interview prep patterns."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "enum": list(_FRAMEWORK_KB.keys()),
                        "description": "Career topic to retrieve guidance for.",
                    }
                },
                "required": ["topic"],
            },
        },
    }
]


def _run_tool(name: str, arguments: Dict[str, Any]) -> str:
    if name == "career_framework_lookup":
        topic = (arguments.get("topic") or "").strip()
        return _FRAMEWORK_KB.get(topic, _FRAMEWORK_KB["skill_pivot"])
    return json.dumps({"error": f"unknown_tool:{name}"})


def _build_system_prompt(assessment_block: str) -> str:
    if assessment_block.strip():
        return (
            f"{CAREER_MENTOR_SYSTEM}\n\n"
            "### User assessment context (use when relevant; do not contradict without explaining uncertainty)\n"
            f"{assessment_block.strip()[:12000]}"
        )
    return CAREER_MENTOR_SYSTEM


async def run_career_chat_openai_compatible(
    client: Any,
    model: str,
    system_prompt: str,
    history_messages: List[Dict[str, str]],
    user_message: str,
    *,
    max_tool_rounds: int = 5,
) -> Tuple[str, List[Dict[str, Any]]]:
    """Run chat with tool loop for OpenAI / Azure / Groq compatible clients."""
    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": system_prompt},
        *[{"role": m["role"], "content": m["content"]} for m in history_messages if m.get("role") in {"user", "assistant"}],
        {"role": "user", "content": user_message},
    ]

    async def _complete(use_tools: bool) -> Any:
        kwargs: Dict[str, Any] = {
            "model": model,
            "temperature": 0.35,
            "messages": messages,
        }
        if use_tools:
            kwargs["tools"] = TOOLS_OPENAI
            kwargs["tool_choice"] = "auto"
        return await client.chat.completions.create(**kwargs)

    try:
        response = await _complete(True)
    except Exception as exc:
        logger.warning("Tool-enabled career chat failed (%s); retrying without tools.", exc)
        response = await _complete(False)

    for _ in range(max_tool_rounds + 1):
        choice = response.choices[0].message
        tool_calls = getattr(choice, "tool_calls", None) or []

        if tool_calls:
            assistant_msg: Dict[str, Any] = {
                "role": "assistant",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments or "{}",
                        },
                    }
                    for tc in tool_calls
                ],
            }
            text_part = (getattr(choice, "content", None) or "").strip()
            assistant_msg["content"] = text_part if text_part else None
            messages.append(assistant_msg)
            for tc in tool_calls:
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}
                payload = _run_tool(tc.function.name, args)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": payload,
                    }
                )
            try:
                response = await _complete(True)
            except Exception as exc:
                logger.warning("Tool follow-up completion failed (%s); retrying without tools.", exc)
                response = await _complete(False)
            continue

        text = (choice.content or "").strip()
        if not text:
            text = "I could not generate a reply. Please try rephrasing your question."
        return text, messages

    logger.warning("career_chat tool loop exhausted without final text")
    return (
        "I could not finish reasoning in one step. Please ask a shorter follow-up question.",
        messages,
    )


def _run_anthropic_sync(system_prompt: str, history: List[Dict[str, str]], user_message: str) -> str:
    import anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514").strip()
    client = anthropic.Anthropic(api_key=api_key)
    api_messages: List[Dict[str, Any]] = []
    for m in history:
        if m.get("role") not in {"user", "assistant"}:
            continue
        api_messages.append({"role": m["role"], "content": m["content"]})
    api_messages.append({"role": "user", "content": user_message})

    response = client.messages.create(
        model=model,
        max_tokens=2048,
        system=system_prompt,
        messages=api_messages,
    )
    parts: List[str] = []
    for block in response.content:
        if getattr(block, "type", "") == "text":
            parts.append(block.text)
    text = " ".join(parts).strip()
    return text or "I could not generate a reply. Please try again."


async def run_career_chat_anthropic(
    system_prompt: str,
    history_messages: List[Dict[str, str]],
    user_message: str,
) -> str:
    return await asyncio.to_thread(
        _run_anthropic_sync,
        system_prompt,
        history_messages,
        user_message,
    )
