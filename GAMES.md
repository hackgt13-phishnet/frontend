# Chaos backend integration

The frontend uses Supabase anonymous authentication and Realtime, with FastAPI
for writes. `serve.py` proxies `/v1` to `http://127.0.0.1:8001` by default.

## Start and join from chat

1. Open a chat and choose Games → Chaos → **Start Chaos**. No room setup or code
   entry is required. The first starter becomes that chat room's host; only the
   host starts subsequent sessions. One player is enough.
2. Every profile-bound demo player opening the same chat sees its game invites.
   Discovery refreshes every five seconds while visible, on open, and on returning
   to the foreground. Invites persist across refreshes and devices.
3. Tap **Join Game** to join the room and all unrevealed rounds. Existing players
   see **Open Game**. Merely viewing the chat does not enroll someone in the game.
4. Round 1 opens first. Everyone eligible must answer; then the backend reveals it
   and waits for discussion to quiet down before advancing. There is no timeout.
5. Late joiners can answer the current answering round and future rounds. Earlier
   reveals are read-only and marked **Joined after this round**. Questions and
   answer choices remain unchanged, and missed rounds award no retroactive points.
6. Completed invites show **Game Ended**; existing room members can view results.
   New players cannot enroll after all rounds reveal. The host can start again.

The optional **Use a Room Code Instead** path remains for existing standalone
rooms. Room memberships and profile claims persist; there is no idle profile
expiry. The six-player session cap remains. Connected-room messages go to the
backend so conversation pacing reflects chat activity.

Chat identifiers are shared demo spaces, not private-chat membership checks.

## API contract

| Action | Endpoint | Body |
| --- | --- | --- |
| Discover invites | GET `/v1/threads/{key}/games` | — |
| Start in chat | POST `/v1/threads/{key}/games` | `{name,vibe:"chaos"}` |
| Join invite | POST `/v1/threads/{key}/games/{session_id}/join` | — |
| Claim profile | POST `/v1/demo-sessions` | `{profile_id}` |
| Create room | POST `/v1/rooms` | `{name}` |
| Join room | POST `/v1/rooms/join` | `{code}` |
| Load room | GET `/v1/rooms/{id}` | — |
| Start session (host) | POST `/v1/rooms/{id}/sessions` | `{vibe:"chaos"}` |
| Answer | POST `/v1/rounds/{id}/responses` | `{value: profileUuid}` |
| Send chat | POST `/v1/rooms/{id}/messages` | `{body}` |

DELETE `/demo-sessions` is not supported or called. The current backend
provides three fixture-based `who_sent_this` rounds; it does not accept async mode
or written `why` answers. Existing presentation support for other game types is
not a claim that this backend can generate or accept them.

## Run locally

Apply backend migration `202609270014_thread_invites.sql` first, then start the updated backend on port 8001 using its existing environment. In this frontend:

```bash
/Users/shreydesai/Documents/Codex/2026-09-26/this-x20/.venv/bin/python serve.py
```

Open `http://localhost:8000/messages.html`. A second tab with `?player=2` gets its
own persistent anonymous identity. Open the same chat in both tabs, start in one, and tap Join Game in the other.
`API_URL` and `PORT` override the proxy target and frontend port.

Run the dependency-free adapter and UI-state regression tests:

```bash
node --test tests/games-contract.test.cjs
```

These tests mock API responses and do not modify the shared demo database. A live
multi-client test still requires a running backend and available demo profiles.
