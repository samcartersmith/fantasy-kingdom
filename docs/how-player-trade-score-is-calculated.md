# How a player’s trade score is calculated

This document describes the **fair-trade player model (v2)** used by the trade calculator when it is **not** in legacy mode. The number you see is a **dynasty-style trade point index**, not a dollar value, not Sleeper’s internal value, and not a prediction of future points.

The steps below are **in order**: later steps see the result of earlier ones (some adjustments are combined before the final clamp).

---

## 1. What you are looking at

Each player gets a single **trade point total** after the steps below. The UI may also show a **confidence** percentage: it goes down when important inputs are missing (for example, no fantasy stat snapshot row for that player yet).

---

## 2. Step 1 — Fantasy production (primary spine)

This is the **largest** part of the score.

- **Data**: A checked-in snapshot built from Sleeper’s **regular-season stat rollups** (recent NFL seasons) plus each player’s **primary skill position** (QB, RB, WR, TE) from Sleeper’s player map. Refresh the snapshot by running `npm run data:fantasy` (see `scripts/build-fantasy-profiles.mjs`).
- **Scoring mode**: The catalog request tells the server whether your league is **full PPR**, **half PPR**, or **non-PPR**. The model uses the matching points column for each season row.
- **Recency blend**: Recent season totals are weighted a bit more than the prior season so the score reacts to the latest year of football, without ignoring the previous year entirely.
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
