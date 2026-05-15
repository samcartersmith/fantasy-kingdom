# How a player’s trade score is calculated

This document describes the **fair-trade player model (v3)** used by the trade calculator when it is **not** in legacy mode. The number you see in the catalog is a **0–10,000 dynasty-style index** (per API response cohort), not a dollar value, not Sleeper’s internal value, and not a prediction of future points.

The server first builds an **internal** trade total (wide range), then **maps all skill players in that catalog response** linearly from the cohort min to max into **0–10,000** so the UI has a stable scale. **Ordering** is preserved; **component lines** are scaled by the same factor so they still sum to the displayed total.

The steps below are **in order** for the internal model; the display map is the last step on the wire.

---

## 1. What you are looking at

Each player gets a single **trade point total** (0–10,000 after scaling) plus an optional **confidence** percentage: it goes down when important inputs are missing (for example, no usable fantasy stat seasons for that player in the nflverse snapshot).

---

## 2. Step 1 — Trade spine (composite rank + merged VBD)

This is the **largest** part of the score. It replaces the older “percentile blend + separate VBD line” design.

### Data

- **Source**: Checked-in **nflverse** snapshot (`player-fantasy-profile.json`), same build pipeline as before (`npm run data:fantasy`, [`scripts/build-fantasy-profiles-nflverse.mjs`](../scripts/build-fantasy-profiles-nflverse.mjs)). See [`docs/nflverse-scoring-parity.md`](nflverse-scoring-parity.md).

### Composite sort key (per position)

Within each of **QB, RB, WR, TE**, every player with countable fantasy points is ranked using:

1. **Recency-weighted fantasy points** (same PPR column as your league): `log1p(weighted season total)` normalized to ~p5–p95 **within that position**.
2. **Rich usage / efficiency** (same nflverse fields as before): WR/TE **target share**, RB **touches per game**, QB **passing EPA** — each normalized to league anchors, then blended with FP using a fixed weight (see [`src/lib/trade-model/trade-spine.ts`](../src/lib/trade-model/trade-spine.ts)).

**Tie-breaks**: higher weighted season points, then higher weighted PPG.

### Rank → internal “rank base” trade points

Players at each position are sorted by that composite **descending**. Sort index is mapped in two bands (see [`trade-spine.ts`](../src/lib/trade-model/trade-spine.ts)):

1. **Elite cluster (top K ranks per position)** — a **linear** drop from the best rank down to a join value `ELITE_CURVE_BOTTOM`, so **RB1 vs RB2–type** gaps stay relatively tight.
2. **Tail (remaining ranks)** — the same join value is scaled by a **power curve** in `u` so **elite vs depth** (e.g. RB1 vs ~RB10) stays wide.

**TE uses a shorter rank span than QB/RB/WR** so elite TEs do not occupy the same ceiling as every-down RB/WR pillars.

### League VBD merged into the spine (not a separate breakdown row)

For the same league context (starters + flex split as in [`src/lib/trade-model/vbd.ts`](../src/lib/trade-model/vbd.ts)), **raw VBD** (weighted FP minus “last starter” FP at that position) is normalized **within the position** to ~0–1. The spine contribution is:

`round(rankBase × (spineVbdFloor + spineVbdSpan × vbdPos01 × dyn))`

where **dyn** is a **peak-years** factor from age/position (same idea as the old VBD dynasty weight in [`src/lib/trade-model/age-curve.ts`](../src/lib/trade-model/age-curve.ts)). Constants **`spineVbdFloor` / `spineVbdSpan`** are in [`src/lib/trade-model/weights.ts`](../src/lib/trade-model/weights.ts).

**Missing / zero FP profile**: neutral rank base + neutral VBD norm; the line is marked **missing** and confidence drops.

The UI breakdown still shows a single line keyed **`fantasyProduction`** whose label states that it includes the merged VBD.

---

## 3. Step 2 — Games played / durability

When a fantasy snapshot row exists and production is not missing, the model adds a **smaller** adjustment from games played vs a **17-game** full-season reference (see `gamesParticipation01FromProfile` in [`fp-baseline.ts`](../src/lib/trade-model/fp-baseline.ts)).

If there is **no** usable snapshot row, this step is skipped and **curated “recent form” fallback** may apply instead.

---

## 4. Step 3 — Team offense (curated)

Hand-maintained **team offense tier**. Missing team → neutral middle + missing flag where applicable.

---

## 5. Step 4 — Offensive coordinator / scheme (curated)

Year-stamped coordinator / scheme tier for the player’s NFL team.

---

## 6. Step 5 — Role / depth (curated)

Optional per-player usage / depth tiers in JSON.

---

## 7. Step 6 — Injury / availability (curated)

Optional health / availability tiers.

---

## 8. Step 7 — Age and career phase

Sleeper **age** when present, else estimate from **years of experience**; position-aware age curve.

---

## 9. Step 8 — Future outlook blend

Small blend of age + team offense + role.

---

## 10. Step 9 — League format tilt

Modest PPR vs non-PPR tilt for RB/WR/TE and a small league-size nudge.

---

## 11. Step 10 — Sleeper buzz (capped)

Search rank + trending adds, **capped** (see `BUZZ_MAX_POINTS` in [`weights.ts`](../src/lib/trade-model/weights.ts)).

---

## 12. Step 11 — Superflex (QBs only)

If **superflex** is on, **quarterbacks** get a **one-time multiplier** on the summed internal total (same constant as before in trade types).

---

## 13. Step 12 — Internal clamp, confidence, then 0–10,000 display

- **Internal clamp**: very wide floor/ceiling so outliers stay finite (see [`score-player.ts`](../src/lib/trade-model/score-player.ts)).
- **Confidence**: penalized for missing production or missing curated tiers.
- **Catalog display**: when the trade catalog builds the full active player list, each player’s internal total is **linearly mapped** across that response’s min/max into **0–10,000** in [`src/lib/sleeper-map.ts`](../src/lib/sleeper-map.ts). Breakdown contributions are scaled by the same ratio so they sum to the displayed total.

---

## 14. Draft picks (different pipeline)

Unchanged: picks use [`src/lib/trade-model/score-pick.ts`](../src/lib/trade-model/score-pick.ts) and are **not** forced onto the 0–10,000 player scale unless product changes that separately.

---

## 15. Legacy mode

`?legacy=1` on the trade catalog API still uses the older Sleeper-signal-only heuristic.

---

## 16. Reproducible stats vs Sleeper platform

- **Historical fantasy production in the spine** remains **nflverse-backed**.
- **Sleeper** supplies live roster metadata, buzz, and legacy ranking heuristics.

---

## 17. Calibration vs external boards

`node scripts/calibrate-vs-reference.mjs --reference /path/to/board.csv` — same as before; anchor pairs (e.g. elite WR vs mid RB, elite RB vs elite TE) are used during model tuning (`TRADE_MODEL_VERSION` in [`types.ts`](../src/lib/trade-model/types.ts)).
