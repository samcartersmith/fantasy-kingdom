# nflverse data harvest (canonical spine)

This folder documents the **recommended integration path** chosen for the repo: **Node downloads nflverse CSV releases** (no R required for CI or contributors who only run npm scripts).

## Why CSV + Node

- Releases are public HTTPS assets on [nflverse-data](https://github.com/nflverse/nflverse-data/releases) (`stats_player_reg_{season}.csv`).
- The `player_id` column in those files is the **GSIS** id. Sleeper `players/nfl` provides `gsis_id` when present; when it is null, the builder falls back to **nflverse `players.csv`** (display name + latest team + position ↔ Sleeper `search_full_name` + team + position).
- The trade model loads [`player-fantasy-profile.json`](../../src/data/trade-model/player-fantasy-profile.json) produced by the nflverse builder (`npm run data:fantasy`).

## Optional R spike

If you already use R, `spike-join-coverage.R` mirrors the join-coverage check with `nflreadr::load_player_stats()` for cross-validation. It is **not** required for the npm workflow.

## Commands (from repo root)

| Script | Purpose |
| --- | --- |
| `npm run data:fantasy` | Writes **`player-fantasy-profile.json`** (nflverse PPR spine + Sleeper id bridge) |
| `npm run data:fantasy:nflverse` | Same as `data:fantasy` (alias) |
| `npm run data:fantasy:sleeper` | Writes `player-fantasy-profile.sleeper.json` (Sleeper rollup only, for diff) |
| `npm run data:fantasy:spike-join` | JSON report: Sleeper skill ↔ nflverse GSIS coverage |
| `npm run data:fantasy:diff` | Compares canonical nflverse profile vs Sleeper rollup + prints acceptance gates |

See also [`docs/nflverse-scoring-parity.md`](../../docs/nflverse-scoring-parity.md).
