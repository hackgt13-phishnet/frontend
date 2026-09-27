# Instagram Games (GamePigeon-style)

Games live **inside a DM**. The composer's controller button opens the games sheet.
Only **Chaos** (3 AI-written rounds) is enabled for now.

Backed by the team backend (`hackgt13-phishnet/Backend`): Supabase Auth (anonymous),
FastAPI for every write, Supabase Realtime (Postgres Changes) for live updates.
See `Backend/docs/realtime-contract.md`.

## Flow

1. Each phone signs in anonymously with Supabase and is dealt a random free demo profile
   (Ana, Dev, Kofi, Maya, Riya, Sam). One phone per profile, so six players max.
2. Each chat thread has one room (`POST /v1/threads/{thread_key}/room`). Opening a chat
   joins you to it, so everyone in the group chat is already in the game. No codes.
3. Anyone taps **Chaos** (`POST /v1/threads/{thread_key}/games`, `mode: "async"`). Everyone
   who has opened the chat at least once is dealt in, even if they're offline right now.
4. GamePigeon-style: all rounds open at once and each player answers whenever they open the
   chat. The invite bubble says "your turn" or "Waiting on N players". A round reveals the
   moment its last player answers; the game ends (final scores) when every round is revealed.
   No timers, no host buttons.

## AI rounds and scoring

Sending a game takes ~10-15s: the backend's AI pipeline (`app/services/rounds.py`, Meta Muse)
writes 3 rounds for exactly the players in the chat, from their shared chat history ("moments")
and each player's own interests. If every model call fails it falls back to the fixture rounds.

Chaos mixes two games (both appear in every game when the material allows):

- **Who Sent This?**: +1 if you guess who sent it. It's a **text** or a **reel** someone shared in the
  group chat (only threads whose whole membership is playing), or, in groups with no usable chat,
  a player's public post or story.
- **Hot Take** (open, no right answer): an AI-written question about what the players are into.
  Everyone **types their own take** (one line, no options). When the last person answers, the AI
  judges the most interesting take (~4s), gives it +1 and posts a shout-out. Everyone's take is
  shown at the reveal.

The old timed flow (`mode: "live"`, one round at a time, paced by the AI game master) still
exists for the team's other clients; the game master only runs live sessions.

## Multi-phone demo

Clone both repos side by side and set up the backend first (its README: install, `.env`,
and database setup if you use a new Supabase project):

```bash
git clone https://github.com/hackgt13-phishnet/frontend.git
git clone https://github.com/hackgt13-phishnet/Backend.git

# 1. API (demo pace: ~25s answer timer, short discussion between rounds)
cd Backend
GAME_PACE=demo .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001

# 2. UI + /v1 proxy on one origin (the Backend venv already has starlette/httpx/uvicorn;
#    or pip install -r requirements.txt into any venv). API_URL / PORT override the defaults.
cd ../frontend
../Backend/.venv/bin/python serve.py          # http://localhost:8000

# 3. Public HTTPS URL for phones (works on any network, including cellular)
brew install cloudflared                      # once
cloudflared tunnel --no-autoupdate --url http://localhost:8000

# Before each demo: free all profiles, end running chat games, clear chat members
cd ../Backend && .venv/bin/python scripts/reset_demo.py
```

Send every player `https://<tunnel>.trycloudflare.com/messages.html?thread=roshan-group`.
Each phone is given a player and lands in the group chat. After everyone has opened it once
(that's what "joins the group"), anyone can send **Chaos** and the others play whenever. The tunnel URL changes every time cloudflared restarts.

Phones on the same Wi-Fi can also use `http://<mac-lan-ip>:8000/...` if the network
allows device-to-device traffic (hackathon Wi-Fi often doesn't).

## Two players in one browser

Append `&player=2` to the URL in a second tab. Each slot keeps its own Supabase session.
