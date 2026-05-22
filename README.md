# fantasy-kingdom

Dynasty fantasy playground — trade calculator, Sleeper-derived rankings, and Dashboard styling. Leagues still planned.

## Prerequisites

You need a **full Node.js install** (which includes `npm` and `npx`). The editor-only `node` binary some tools ship with is not enough — if `npm` is “not found”, Node is missing or not on your `PATH`.

**macOS (pick one):**

1. **Installer (simplest):** Download **LTS** from [https://nodejs.org](https://nodejs.org), run the installer, then **quit and reopen** your terminal (and Cursor).
2. **Homebrew:** After [Homebrew](https://brew.sh) is installed: `brew install node`

Check:

```bash
node -v
npm -v
```

Both should print versions. If not, ensure `/usr/local/bin` or `/opt/homebrew/bin` appears in `echo $PATH` in the same terminal you use inside Cursor.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Tools: [`/trade`](http://localhost:3000/trade), [`/rankings`](http://localhost:3000/rankings), [`/news-room`](http://localhost:3000/news-room).

### News room

Aggregates FantasyPros headlines (API key or local fixture), Sleeper trending add/drop, and optional Yahoo league signals. Copy [`.env.example`](.env.example) to `.env.local` and set `FANTASYPROS_API_KEY` / `CRON_SECRET` when ready. First visit to `/news-room` triggers ingest if the store is empty; scheduled sync uses `POST /api/cron/news-ingest` (hourly on Vercel). Local manual run: start dev server, then `npm run news:ingest`.

Fantasy production snapshot: `npm run data:fantasy` (nflverse CSVs + Sleeper id join). Optional Sleeper-only rollup for comparison: `npm run data:fantasy:sleeper` then `npm run data:fantasy:diff` (see [`docs/nflverse-scoring-parity.md`](docs/nflverse-scoring-parity.md)).

## Design skill

[`SKILL.md`](SKILL.md) is the TypeUI **Dashboard** design skill. Refresh it with `npx typeui.sh pull dashboard` when the CLI is available, or replace the file manually.

Draft pick chips in [`src/data/players-picks.json`](src/data/players-picks.json) use **local demo values**. NFL players come from Sleeper [`GET /v1/players/nfl`](https://docs.sleeper.com). **Rankings** ([`/rankings`](src/app/rankings/page.tsx), API [`/api/rankings`](src/app/api/rankings/route.ts)) sort by Sleeper `search_rank` and blend in [`/players/nfl/trending/add`](https://docs.sleeper.com); **trade catalog player values** use the fair-trade model (nflverse-backed fantasy snapshot plus smaller nudges; see [`docs/how-player-trade-score-is-calculated.md`](docs/how-player-trade-score-is-calculated.md)). Refresh the checked-in snapshot with `npm run data:fantasy`.
