"""Ask Circle — Muse Spark backend with tool calling over a mock Instagram graph."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from openai import OpenAI

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

app = Flask(__name__, static_folder=str(ROOT), static_url_path="")

GRAPH_PATH = Path(__file__).resolve().parent / "graph.json"
with GRAPH_PATH.open(encoding="utf-8") as f:
    GRAPH = json.load(f)

PEOPLE = {p["id"]: p for p in GRAPH["people"]}
VIEWER = GRAPH["viewer"]

MODEL = os.getenv("MUSE_MODEL", "muse-spark-1.3")
BASE_URL = os.getenv("MUSE_BASE_URL", "https://api.meta.ai/v1")
API_KEY = os.getenv("MODEL_API_KEY", "").strip()

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_people",
            "description": "Search followers/following by semantic keywords across bios, interests, captions, and tags.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "limit": {"type": "integer", "default": 8},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_person_posts",
            "description": "Get recent posts (caption, tags, image URL) for a person.",
            "parameters": {
                "type": "object",
                "properties": {"user_id": {"type": "string"}},
                "required": ["user_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_message_topics",
            "description": "Get past DM conversation topics with a person (synthetic).",
            "parameters": {
                "type": "object",
                "properties": {"user_id": {"type": "string"}},
                "required": ["user_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_proximity",
            "description": "Get proximity signals: same city, same campus, visited same city.",
            "parameters": {
                "type": "object",
                "properties": {"user_id": {"type": "string"}},
                "required": ["user_id"],
            },
        },
    },
]

SYSTEM_PROMPT = f"""You are Muse inside Instagram helping {VIEWER['display_name']} (@{VIEWER['username']}) use the Ben Franklin effect: getting closer to someone by asking them for a favor only they can provide.

Given the user's need, use tools to inspect their circle (posts, message topics, proximity). Return ONLY valid JSON (no markdown) with this shape:
{{
  "matches": [
    {{
      "user_id": "...",
      "username": "...",
      "display_name": "...",
      "avatar": "...",
      "score": 0.0,
      "reasons": ["short reason why ONLY they can help"],
      "evidence": [{{"type": "post"|"dm"|"proximity", "text": "..."}}],
      "draft_ask": "a warm, specific DM asking for a small favor — not small talk"
    }}
  ],
  "summary": "one sentence framing the Ben Franklin ask"
}}

Rules:
- Rank 3–5 people max by unique relevance (not popularity).
- Prefer people with concrete evidence (posts/DMs/proximity).
- draft_ask must request something specific that person uniquely knows.
- Refuse creepy, romantic-pressure, stalking, or spam intents with matches: [] and a summary explaining why.
- Viewer context: city={VIEWER['city']}, campus={VIEWER['campus']}.
"""


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def search_people(query: str, limit: int = 8) -> list[dict[str, Any]]:
    q_tokens = _tokenize(query)
    scored: list[tuple[float, dict]] = []
    for person in GRAPH["people"]:
        blob = " ".join(
            [
                person.get("bio", ""),
                person.get("username", ""),
                " ".join(person.get("interests", [])),
                " ".join(person.get("proximity", [])),
                " ".join(person.get("message_topics", [])),
                " ".join(
                    f"{p.get('caption','')} {' '.join(p.get('tags', []))}"
                    for p in person.get("posts", [])
                ),
            ]
        )
        p_tokens = _tokenize(blob)
        overlap = q_tokens & p_tokens
        if not overlap and not any(t in blob.lower() for t in q_tokens if len(t) > 3):
            # soft substring match for multi-word themes
            soft = sum(1 for t in q_tokens if len(t) > 3 and t in blob.lower())
            if soft == 0:
                continue
            score = soft * 0.5
        else:
            score = float(len(overlap))
            score += 0.5 * sum(1 for t in q_tokens if len(t) > 3 and t in blob.lower())
            # proximity boost when related to local asks
            if person.get("proximity"):
                score += 0.4 * len(person["proximity"])
        scored.append((score, person))
    scored.sort(key=lambda x: x[0], reverse=True)
    results = []
    for score, person in scored[:limit]:
        results.append(
            {
                "user_id": person["id"],
                "username": person["username"],
                "display_name": person["display_name"],
                "avatar": person["avatar"],
                "bio": person["bio"],
                "city": person.get("city"),
                "campus": person.get("campus"),
                "interests": person.get("interests", []),
                "proximity": person.get("proximity", []),
                "score_hint": round(score, 2),
            }
        )
    return results


def get_person_posts(user_id: str) -> list[dict[str, Any]]:
    person = PEOPLE.get(user_id)
    if not person:
        return []
    return person.get("posts", [])


def get_message_topics(user_id: str) -> list[str]:
    person = PEOPLE.get(user_id)
    if not person:
        return []
    return person.get("message_topics", [])


def get_proximity(user_id: str) -> dict[str, Any]:
    person = PEOPLE.get(user_id)
    if not person:
        return {}
    return {
        "user_id": user_id,
        "city": person.get("city"),
        "campus": person.get("campus"),
        "proximity": person.get("proximity", []),
        "viewer_city": VIEWER["city"],
        "viewer_campus": VIEWER["campus"],
    }


TOOL_IMPL = {
    "search_people": lambda args: search_people(
        args.get("query", ""), int(args.get("limit", 8))
    ),
    "get_person_posts": lambda args: get_person_posts(args.get("user_id", "")),
    "get_message_topics": lambda args: get_message_topics(args.get("user_id", "")),
    "get_proximity": lambda args: get_proximity(args.get("user_id", "")),
}


def local_fallback(query: str) -> dict[str, Any]:
    """Heuristic ranking when MODEL_API_KEY is missing — keeps the demo runnable."""
    candidates = search_people(query, limit=5)
    matches = []
    for c in candidates[:4]:
        person = PEOPLE[c["user_id"]]
        posts = person.get("posts", [])
        evidence = []
        if posts:
            evidence.append({"type": "post", "text": posts[0]["caption"][:160]})
        for topic in person.get("message_topics", [])[:1]:
            evidence.append({"type": "dm", "text": f"Past DM topic: {topic}"})
        for prox in person.get("proximity", [])[:1]:
            label = prox.replace("_", " ")
            evidence.append({"type": "proximity", "text": f"Proximity: {label}"})
        ask_clean = re.sub(r"^(who\s+(knows|can)|i\s+want\s+to|looking\s+for)\s+", "", query.strip(), flags=re.I)
        ask_clean = ask_clean.rstrip("?").strip() or query.strip()
        first = person["display_name"].split()[0]
        draft = (
            f"Hey {first} — your posts about this are exactly what I need. "
            f"Could I ask you one specific thing about {ask_clean.lower()}? "
            f"Happy to keep it short — you'd know better than anyone in my circle."
        )
        matches.append(
            {
                "user_id": person["id"],
                "username": person["username"],
                "display_name": person["display_name"],
                "avatar": person["avatar"],
                "score": round(min(0.99, 0.55 + c["score_hint"] * 0.08), 2),
                "reasons": [
                    f"Unique signal from @{person['username']}'s posts/interests",
                    f"Knows: {', '.join(person.get('interests', [])[:3])}",
                ],
                "evidence": evidence,
                "draft_ask": draft,
            }
        )
    return {
        "matches": matches,
        "summary": (
            "Ask one of these people for a small, specific favor — "
            "the Ben Franklin effect turns the ask into closeness."
        ),
        "mode": "local_fallback",
    }


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start : end + 1])
        raise


def muse_ask_circle(query: str) -> dict[str, Any]:
    if not API_KEY:
        result = local_fallback(query)
        result["muse_available"] = False
        return result

    client = OpenAI(base_url=BASE_URL, api_key=API_KEY)
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"I need help from someone in my Instagram circle about: {query}\n"
                "Search my circle, inspect the best people, then return the JSON result."
            ),
        },
    ]

    for _ in range(6):
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            temperature=0.4,
        )
        message = response.choices[0].message
        messages.append(
            {
                "role": "assistant",
                "content": message.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in (message.tool_calls or [])
                ]
                if message.tool_calls
                else None,
            }
        )
        # Clean None tool_calls for compatibility
        if messages[-1].get("tool_calls") is None:
            messages[-1].pop("tool_calls", None)

        if not message.tool_calls:
            content = message.content or "{}"
            data = _extract_json(content)
            data["mode"] = "muse"
            data["muse_available"] = True
            data["model"] = MODEL
            # Enrich avatars/usernames from graph if missing
            for m in data.get("matches", []):
                uid = m.get("user_id")
                if uid and uid in PEOPLE:
                    p = PEOPLE[uid]
                    m.setdefault("username", p["username"])
                    m.setdefault("display_name", p["display_name"])
                    m.setdefault("avatar", p["avatar"])
            return data

        for tc in message.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            impl = TOOL_IMPL.get(name)
            result = impl(args) if impl else {"error": f"unknown tool {name}"}
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result),
                }
            )

    # Exhausted tool loop — fall back
    result = local_fallback(query)
    result["mode"] = "local_fallback_after_muse"
    result["muse_available"] = True
    return result


@app.get("/api/health")
def health():
    return jsonify(
        {
            "ok": True,
            "muse_configured": bool(API_KEY),
            "model": MODEL,
            "people": len(GRAPH["people"]),
        }
    )


@app.get("/api/graph/viewer")
def viewer():
    return jsonify(VIEWER)


@app.post("/api/ask-circle")
def ask_circle():
    body = request.get_json(silent=True) or {}
    query = (body.get("query") or "").strip()
    if not query:
        return jsonify({"error": "query is required"}), 400
    if len(query) > 500:
        return jsonify({"error": "query too long"}), 400
    try:
        result = muse_ask_circle(query)
        return jsonify(result)
    except Exception as exc:  # noqa: BLE001 — surface for demo debugging
        fallback = local_fallback(query)
        fallback["error"] = str(exc)
        fallback["mode"] = "local_fallback_error"
        return jsonify(fallback)


@app.route("/")
def index():
    return send_from_directory(ROOT, "index.html")


@app.route("/<path:path>")
def static_proxy(path: str):
    return send_from_directory(ROOT, path)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    print(f"Ask Circle server on http://localhost:{port}")
    print(f"Muse configured: {bool(API_KEY)} | model={MODEL}")
    app.run(host="0.0.0.0", port=port, debug=True)
