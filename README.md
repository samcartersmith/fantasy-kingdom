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

Open [http://localhost:3000](http://localhost:3000). Tools: [`/trade`](http://localhost:3000/trade), [`/rankings`](http://localhost:3000/rankings).

## Design skill

[`SKILL.md`](SKILL.md) is the TypeUI **Dashboard** design skill. Refresh it with `npx typeui.sh pull dashboard` when the CLI is available, or replace the file manually.

Draft pick chips in [`src/data/players-picks.json`](src/data/players-picks.json) use **local demo values**. NFL players come from Sleeper [`GET /v1/players/nfl`](https://docs.sleeper.com). **Rankings** ([`/rankings`](src/app/rankings/page.tsx), API [`/api/rankings`](src/app/api/rankings/route.ts)) sort by Sleeper `search_rank` and blend in [`/players/nfl/trending/add`](https://docs.sleeper.com); **trade catalog player values** use the fair-trade model (fantasy stat snapshot plus smaller nudges; see [`docs/how-player-trade-score-is-calculated.md`](docs/how-player-trade-score-is-calculated.md)). Refresh fantasy snapshot data with `npm run data:fantasy`.
