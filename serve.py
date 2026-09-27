"""Serve the UI and proxy /v1 to the FastAPI backend from one origin, so phones need a single URL.

Run with the Backend venv (it already has starlette, httpx and uvicorn):
  ../Backend/.venv/bin/python serve.py            # http://0.0.0.0:8000
  API_URL=http://127.0.0.1:8001 PORT=8000 ../Backend/.venv/bin/python serve.py
"""

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
        Mount("/", NoCacheStatic(directory=ROOT, html=True)),
    ],
    lifespan=lifespan,
)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
