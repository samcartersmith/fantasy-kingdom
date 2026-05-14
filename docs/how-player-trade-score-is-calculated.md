# How a player’s trade score is calculated

This document describes the **fair-trade player model (v2)** used by the trade calculator when it is **not** in legacy mode. The number you see is a **dynasty-style trade point index**, not a dollar value, not Sleeper’s internal value, and not a prediction of future points.

The steps below are **in order**: later steps see the result of earlier ones (some adjustments are combined before the final clamp).

---

## 1. What you are looking at

Each player gets a single **trade point total** after the steps below. The UI may also show a **confidence** percentage: it goes down when important inputs are missing (for example, no fantasy stat snapshot row for that player yet).

---

## 2. Step 1 — Fantasy production (primary spine)

This is the **largest** part of the score.

- **Data**: A checked-in snapshot from **nflverse** regular-season player CSVs (recent NFL seasons) for fantasy points + games, joined to each player’s **Sleeper id** and **primary skill position** (QB, RB, WR, TE) via Sleeper’s `gsis_id`. Refresh by running **`npm run data:fantasy`** ([`scripts/build-fantasy-profiles-nflverse.mjs`](../scripts/build-fantasy-profiles-nflverse.mjs)). An optional Sleeper-only rollup for diff lives in `player-fantasy-profile.sleeper.json` (`npm run data:fantasy:sleeper`); see [`docs/nflverse-scoring-parity.md`](nflverse-scoring-parity.md).
- **Scoring mode**: The catalog request tells the server whether your league is **full PPR**, **half PPR**, or **non-PPR**. The model uses the matching points column for each season row.
- **Recency blend**: Up to the **three most recent** seasons present on the profile (`2025`, `2024`, `2023`, newest first) are combined with fixed recency weights: **50% / 35% / 15%** when all three exist, otherwise **65% / 35%** for two seasons, or 100% for a single season—so the score reacts most to the latest year of football while still using older seasons when present.
- **Two normalizations blended together**:
  1. **Within your position**: your weighted per-game pace is compared to other players **at the same position** in the snapshot (roughly “how elite is this season line for a WR vs other WRs?”). Anchor percentiles use the **~5th–~95th** sample band (wider than a tight p10–p90 window) so elite starters are less compressed.
  2. **Across all skill positions**: the same player’s **weighted season point total** (log-scaled) is compared to everyone in the snapshot so an elite season at any skill spot earns a fair global bump.
- **Elite tail mapping**: the blended 0–1 production strength is passed through a **piecewise “stretch”** on the upper tail before it is converted to trade points, so small differences among top producers map to larger point gaps than a purely linear norm.
- **Output**: These two signals are blended, then mapped into a **wide band of base trade points** (the “fantasy production” line item in the technical breakdown).

If there is **no row** for this player in the fantasy snapshot (common for some rookies or ID gaps), the model falls back to a **neutral production prior** and marks the row as missing, which lowers confidence.

---

## 3. Step 2 — Games played / durability

When a fantasy snapshot row exists, the model adds a **smaller** adjustment based on how many games appear in those stat seasons (participation vs a full season).  

If there is **no** snapshot row, this step is skipped and a **curated “recent form” fallback** may be used instead (see the curated data files under `src/data/trade-model/`).

---

## 4. Step 3 — Team offense (curated)

A hand-maintained **team offense tier** nudges the score up or down. If a team is not listed, the model uses a **neutral middle** and marks the data as defaulted.

---

## 5. Step 4 — Offensive coordinator / scheme (curated)

Similar to team offense: a **year-stamped** coordinator / scheme tier for the player’s NFL team. Missing keys use the same neutral default behavior.

---

## 6. Step 5 — Role / depth (curated)

Optional per-player **usage / depth chart** tiers maintained in JSON. Neutral when missing. This is meant to capture things the raw stat line might not fully spell out (true alpha vs part-time).

---

## 7. Step 6 — Injury / availability signal (curated)

Optional per-player **health / availability** tiers. Neutral when missing.

---

## 8. Step 7 — Age and career phase

Using Sleeper’s **age** when available, otherwise a rough estimate from **years of experience**, the model applies a **position-aware age curve** (for example, RB peak vs QB peak are not the same shape).

---

## 9. Step 8 — Future outlook blend

A **small** blended nudge from age + team offense tier + role tier so the story is not *only* “young” or *only* “good offense.”

---

## 10. Step 9 — League format tilt

A modest adjustment for **PPR vs non-PPR** (mostly affecting pass catchers) and **league size** (scarcity). This is intentionally smaller than the fantasy production spine.

---

## 11. Step 10 — Sleeper buzz (small, capped)

**Search rank** (how often players are looked up in Sleeper) and **recent add counts** (trending) are combined into a **sentiment nudge** with a **strict cap** so buzz cannot dominate the score anymore.

**Design note (rookies / thin résumé):** boards like FantasyCalc still price rookies off **draft capital and projection** while this model uses a **neutral production prior** when stat rows are missing. A future improvement is a **separate, capped channel** (for example **Sleeper ADP aggregated from public drafts**, or a **longer trending window** than the trade cap uses) applied only when **games played in the FP snapshot is very low**, so market context moves the needle without reopening uncapped hype. URL helpers for extra endpoints live in `src/lib/sleeper-supplemental.ts`.

---

## 12. Step 11 — Superflex (QBs only)

If the request says **superflex is on**, **quarterbacks** receive a **one-time multiplier** after the sum above so QB scarcity is reflected without double-counting on the client.

---

## 13. Step 12 — Clamp and confidence

- The final number is **clamped** to a minimum and maximum trade point range so one wild input cannot explode the UI.
- **Confidence** starts high and is reduced when production or curated tiers are missing or defaulted.

---

## 14. Draft picks (different pipeline)

Draft picks **do not** use the player fantasy snapshot. They start from **local anchor values** in `src/data/players-picks.json`, then receive adjustments for **draft class strength**, **how many years away** the pick is, **round**, and **early / mid / late** slot. See `src/lib/trade-model/score-pick.ts` for the technical detail.

---

## 15. Legacy mode

Calling the trade catalog API with `?legacy=1` restores the older **Sleeper buzz–only** player heuristic for comparison. It does **not** use the fantasy production snapshot.

---

## 16. Reproducible stats (nflverse) vs Sleeper platform signals

- **Historical fantasy production in the trade spine** is **nflverse-backed** and checked in as `player-fantasy-profile.json` after `npm run data:fantasy` (see `docs/nflverse-scoring-parity.md`).
- **Sleeper as a live platform** (not a stats warehouse) is the right place for signals that nflverse does not own:
  - **Market sentiment** — trending adds/drops over short windows (already used in a capped way for trade buzz).
  - **Fantasy ADP** — mock and live draft prices on Sleeper (not NFL draft slot); useful for priors or calibration, typically cached daily—not per keystroke.
  - **League state** — rosters, trades, waivers when you bind a league id; not needed for the global trade index today.
  - **Projections** — Sleeper’s forward-looking points; relevant for start/sit or projection-first dynasty layers, not the current v2 retrospective spine.

Request-time reads use caching; URL helpers live in `src/lib/sleeper-supplemental.ts`.

---

## 17. Calibration vs external boards

To compare ranks to a **FantasyCalc-style** export (semicolon-separated, `sleeperId` + `value`), run:

`node scripts/calibrate-vs-reference.mjs --reference /path/to/fantasycalc_dynasty_rankings.csv`

The script prints **Spearman** correlation, **linear regression** of reference value on model score, and a **monotone (isotonic) fit** summary along model sort order. The default checked-in CSV still uses the legacy comma format with player names.
