# Ask your circle — Ben Franklin demo (90 seconds)

## Thesis

A great way to get closer to someone is to ask them for something **only they** can provide (Ben Franklin effect). Muse finds that person in your Instagram circle and drafts the ask.

## Setup

```bash
cd Instagram-UI-v2.0
python3 -m venv .venv
source .venv/bin/activate
pip install -r server/requirements.txt

# Optional — live Muse Spark (otherwise local ranking runs):
cp .env.example .env
# edit .env and set MODEL_API_KEY from https://ai.developer.meta.com/

# Stop any old static server on 8000, then:
python server/app.py
```

Open **http://localhost:8000**

Check health: `curl http://localhost:8000/api/health`  
- `muse_configured: true` → Muse Spark tool loop  
- `muse_configured: false` → local demo scorer (still demoable)

## Demo script

1. **Hook (10s)**  
   “We’re building an Instagram feature for Meta’s social-connection track. Muse helps you ask your circle for favors only they can give — the Ben Franklin effect.”

2. **Show the feed (10s)**  
   Point at stories / post / sidebar — familiar Instagram surface.

3. **Open Ask your circle (5s)**  
   Click the black **Ask your circle** pill (or **Ask circle** in the left nav).

4. **Run the query (20s)**  
   Click the example:  
   *“Who knows good cafes in Kyoto that locals actually go to?”*  
   → **Find people**

5. **Evidence → ask (25s)**  
   Highlight the top match (e.g. `@maya.kyoto`):
   - reasons (“only they can help because…”)
   - evidence from posts / DMs / proximity
   - suggested DM ask  
   Click **Copy DM**.

6. **Close (20s)**  
   “In production this would use Meta’s Instagram-grounded Muse tools (`content_search`). Our demo recreates that loop on a privacy-safe graph with Muse Spark 1.3 as the brain.”

## Other good demo queries

| Query | Expected vibe |
|-------|----------------|
| Who knows good cafes in Kyoto… | Travel / Japan experts |
| I want to join an ML or coding club… | Campus club leads |
| Cheap vegan lunches near NYU | Local food + proximity |
| Surfed in Portugal / beginner spots | Niche travel knowledge |

## Architecture (one liner for judges)

User ask → `/api/ask-circle` → Muse Spark (`muse-spark-1.3`) tool-calls `search_people` / `get_person_posts` / `get_message_topics` / `get_proximity` over a mock follower graph → ranked people + draft ask.
