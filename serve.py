"""Serve the UI and proxy /v1 to the FastAPI backend from one origin, so phones need a single URL.

Run with the Backend venv (it already has starlette, httpx and uvicorn):
  ../Backend/.venv/bin/python serve.py            # http://0.0.0.0:8000
  API_URL=http://127.0.0.1:8001 PORT=8000 ../Backend/.venv/bin/python serve.py

Local Supabase (optional, gitignored):
  Put SUPABASE_URL and SUPABASE_ANON_KEY in .env.local.
  /js/games-env.js then overrides the hosted defaults in js/games-config.js.
  Leave .env.local absent to keep the hosted project.
"""

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

API_URL = os.environ.get("API_URL", "http://127.0.0.1:8001")
ROOT = Path(__file__).resolve().parent
HOP_HEADERS = {"host", "content-length", "connection", "transfer-encoding", "content-encoding"}


def read_local_env(path: Path) -> dict[str, str]:
    """Read SUPABASE_URL and SUPABASE_ANON_KEY only. Process env wins. Never logs values."""
    found: dict[str, str] = {}
    if path.is_file():
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            key = key.strip()
            if key not in {"SUPABASE_URL", "SUPABASE_ANON_KEY"}:
                continue
            found[key] = value.strip().strip('"').strip("'")
    for key in ("SUPABASE_URL", "SUPABASE_ANON_KEY"):
        if os.environ.get(key, "").strip():
            found[key] = os.environ[key].strip()
    return found


def games_env_js(_request: Request) -> Response:
    """Browser override for local development. Empty when .env.local is absent."""
    local = read_local_env(ROOT / ".env.local")
    url = local.get("SUPABASE_URL", "")
    key = local.get("SUPABASE_ANON_KEY", "")
    if not url or not key:
        body = "/* hosted Supabase config in games-config.js */\n"
    else:
        body = (
            "window.GAMES_CONFIG = Object.assign({}, window.GAMES_CONFIG, {\n"
            f"  supabaseUrl: {json.dumps(url)},\n"
            f"  supabaseAnonKey: {json.dumps(key)},\n"
            "});\n"
            "try {\n"
            "  const host = new URL(window.GAMES_CONFIG.supabaseUrl).hostname;\n"
            "  if (host === '127.0.0.1' || host === 'localhost') window.GAMES_CONFIG.demoPlayers = [];\n"
            "} catch (e) {}\n"
        )
    return Response(body, media_type="application/javascript", headers={"Cache-Control": "no-store"})


# Sending a game waits for the AI to write the rounds (up to 45s before the API falls back).
client = httpx.AsyncClient(base_url=API_URL, timeout=90)


async def proxy(request: Request) -> Response:
    upstream = await client.request(
        request.method,
        request.url.path,
        params=request.query_params,
        content=await request.body(),
        headers={k: v for k, v in request.headers.items() if k.lower() not in HOP_HEADERS | {"origin"}},
    )
    headers = {k: v for k, v in upstream.headers.items() if k.lower() not in HOP_HEADERS}
    return Response(upstream.content, upstream.status_code, headers=headers)


class NoCacheStatic(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-store"
        return response


@asynccontextmanager
async def lifespan(_app):
    yield
    await client.aclose()


app = Starlette(
    routes=[
        Route("/v1/{path:path}", proxy, methods=["GET", "POST", "PUT", "PATCH", "DELETE"]),
        Route("/js/games-env.js", games_env_js),
        Mount("/", NoCacheStatic(directory=ROOT, html=True)),
    ],
    lifespan=lifespan,
)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
