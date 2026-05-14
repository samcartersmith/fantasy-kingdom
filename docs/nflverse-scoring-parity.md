# nflverse vs Sleeper fantasy columns (scoring parity)

The checked-in trade model spine is **`src/data/trade-model/player-fantasy-profile.json`**, built from **nflverse** regular-season player releases (see below). Sleeper’s own fantasy-point rollups are **not** what production reads anymore; they remain available as an **optional diff artifact** only.

This project’s trade model consumes **three** numeric columns per NFL season on each player profile:

| Field | Meaning in the model |
| --- | --- |
| `pts_ppr` | Full PPR season total |
| `pts_half_ppr` | Half PPR season total |
| `pts_std` | Non-PPR (“standard”) season total |
| `games` | Games used for durability / PPG (clamped to 1–22 in builders) |

## Canonical nflverse spine (`npm run data:fantasy`)

[`scripts/build-fantasy-profiles-nflverse.mjs`](../scripts/build-fantasy-profiles-nflverse.mjs) reads nflverse **regular-season player** CSV releases ([`stats_player_reg_{season}.csv`](https://github.com/nflverse/nflverse-data/releases)) and writes **`player-fantasy-profile.json`**. It maps:

- `pts_ppr` ← `fantasy_points_ppr`
- `pts_std` ← `fantasy_points` (nflverse’s non-PPR aggregate for that table)
- `pts_half_ppr` ← arithmetic mean: `(fantasy_points_ppr + fantasy_points) / 2`

**Important:** nflverse fantasy columns follow **nflverse’s** documented scoring rules for those fields (see the [nflreadr player stats dictionary](https://nflreadr.nflverse.com/articles/dictionary_player_stats.html)). They are **not guaranteed** to match Sleeper’s site scoring for every player-season.

Sleeper is still used in this build **only** for `players/nfl`: **Sleeper player id**, **primary skill position**, and **`gsis_id`** to join nflverse `player_id`.

## Optional Sleeper rollup (`npm run data:fantasy:sleeper`)

[`scripts/build-fantasy-profiles.mjs`](../scripts/build-fantasy-profiles.mjs) maps Sleeper’s `pts_ppr`, `pts_half_ppr`, `pts_std`, and `gp` from `GET /v1/stats/nfl/regular/{season}` (week 18 rollup) into **`player-fantasy-profile.sleeper.json`**. That file exists for **comparison** (definition drift, join coverage), not for the live app.

Run `npm run data:fantasy:sleeper` then [`npm run data:fantasy:diff`](../package.json) to compare canonical nflverse vs Sleeper-derived profiles.

## Join key

Sleeper `players/nfl` entries include `gsis_id` (often with leading spaces). After **trimming** whitespace, that string should equal nflverse’s `player_id` in the reg-season player file (GSIS format such as `00-0033873`).

## Coverage

Only players with a **joinable GSIS id** and nflverse regular-season rows appear in `player-fantasy-profile.json`. That list is typically **smaller** than “all Active skill players” from Sleeper alone; everyone else still appears in the trade catalog but uses the **neutral production prior** until the join improves or curated fallbacks apply.

