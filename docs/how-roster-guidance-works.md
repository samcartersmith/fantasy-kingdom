# How roster guidance works

`src/lib/roster-guidance.ts` turns a Sleeper roster plus the league’s **modeled player catalog** (same fair-trade values as the trade calculator) into a sorted player list and a small set of **insights** for the Leagues hub.

It does **not** re-score players. It only reads `CatalogAsset.value` and roster metadata from Sleeper.

---

## Data flow

```
Sleeper league + rosters
        ↓
GET /api/sleeper/roster-guidance?league_id=&roster_id=
        ↓
getModeledPlayerCatalog(leagueContext)  →  Map<sleeperPlayerId, CatalogAsset>
        ↓
buildRosterGuidancePayload(...)
        ↓
{ totalValue, valueRank, players[], insights[] }
```

The API route lives at `src/app/api/sleeper/roster-guidance/route.ts`. The UI loads it from `LeaguesHub.tsx`.

---

## Main exports

| Function | Role |
|----------|------|
| `buildRosterPlayerRows` | Join roster player IDs to catalog; tag starter/bench/reserve/taxi; sort by value descending |
| `sumRosterValue` | Sum of all modeled values on a roster |
| `rankRosterValues` | Compare one roster’s total to every roster in the league (1 = highest) |
| `buildRosterGuidance` | Rule-based insights from rows + rank + league start slots |
| `buildRosterGuidancePayload` | One-shot bundle: rows, rank, total, insights |

---

## Building player rows

For each ID in `roster.players` (skipping `"0"`):

1. Look up the player in `catalogById`.
2. Skip if missing or not `kind: "player"`.
3. Set **slot** from Sleeper lists: `starters` → starter, `reserve` → reserve, `taxi` → taxi, else bench.
4. Copy name, position, team, value, age, and `sleeperTrendingAdds` from the catalog.

Rows are sorted **highest value first**.

---

## Position rooms

Skill positions are **QB, RB, WR, TE** (via `catalogPlayerHasSkillPosition`).

**Room strength** for a skill = sum of the top *N* player values at that position, where *N* = league start slots for that skill (`startQb`, `startRb`, etc. from Sleeper settings).

Example: 2 RB starters → room score = RB1 value + RB2 value.

---

## Insights (rules)

`buildRosterGuidance` always tries to add these; results are capped at **6** insights.

| ID | When it fires | Tone |
|----|----------------|------|
| `value-rank` | Always — roster total and rank in league | positive if top third; caution if bottom 2; else neutral |
| `strong-room` | At least two position rooms with score > 0; strongest ≠ thinnest | positive |
| `trade-chip` | Bench player ≥ 85% of that position’s “starter cutoff” and depth > slots + 1 | opportunity |
| `trending` | Highest `trendingAdds` ≥ 3 | opportunity |
| `age-rb` | RB age ≥ 29, value ≥ 4500 | caution |
| `youth` | ≥ 3 players age ≤ 24 with value ≥ 5500 | positive |

### Trade chip logic (detail)

For each bench player with a skill position:

1. Collect all roster players at that skill.
2. **Starter cutoff** = `sumTop(values, startSlots)` (same as room strength).
3. Candidate if: `benchValue >= cutoff * 0.85` and `count at position > startSlots + 1`.
4. Pick the highest-value candidate.

### Value rank tone

- **Positive**: rank ≤ ceil(leagueSize / 3) (top third).
- **Caution**: rank ≥ total − 1 (last or second-to-last).
- **Neutral**: everything else.

---

## Types (for API / UI)

- **`RosterPlayerRow`** — one player with slot and trending metadata.
- **`GuidanceInsight`** — `id`, `tone` (`neutral` \| `positive` \| `caution` \| `opportunity`), `title`, `body`.
- **`RosterGuidancePayload`** — `totalValue`, `valueRank`, `leagueRosterCount`, `players`, `insights`.

---

## Tests

`src/lib/roster-guidance.test.ts` covers row building (slot + sort), league ranking, and that guidance returns at least a `value-rank` insight.

---

## Related code

- Trade values / catalog: `src/lib/get-modeled-catalog.ts`, trade model under `src/lib/trade-model/`
- Trade score math: `docs/how-player-trade-score-is-calculated.md`
- Trade suggestions modal: `docs/how-trade-suggestions-work.md`
- Sleeper types: `src/lib/sleeper-league-types.ts`
