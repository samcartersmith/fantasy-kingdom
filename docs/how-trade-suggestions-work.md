# How trade suggestions work

Trade suggestions appear in the **Leagues** hub after roster analysis. They propose multi-asset packages with other teams in the same Sleeper league, using the same fair-trade values as the trade calculator.

---

## Loading (progressive)

1. **Analyze roster** — `GET /api/sleeper/roster-guidance` (unchanged).
2. **Prefetch #1** — When analyze succeeds, the client calls `GET /api/sleeper/trade-suggestions?limit=1&offset=0` in the background.
3. **Modal** — **Trade suggestions** opens the modal. If #2 and #3 are not loaded yet, the client calls the same API with `limit=2&offset=0&exclude={firstSuggestionId}`.

---

## Server flow

```
Sleeper: league, rosters, users, traded_picks
        ↓
getModeledPlayerCatalog(leagueContext)
        ↓
findTradeSuggestions() in src/lib/trade-suggestions.ts
        ↓
Ranked slice (limit / offset / exclude)
```

---

## Roster profiles

Built via [roster-guidance.ts](../src/lib/roster-guidance.ts):

- **Position room strength** — sum of top *N* values per QB/RB/WR/TE (*N* = league start slots).
- **Weak skills** — lowest room score(s) on your roster.
- **Surplus players** — bench (or deep) players at non-weak skills who pass the trade-chip rule (≥85% of starter cutoff with extra depth).

Suggestions never offer players from your **weak** skill rooms.

---

## Package types

| Type | You give | You receive |
|------|----------|-------------|
| 1-for-1 | One surplus player | One partner player at your weak skill |
| 2-for-1 | Two surplus players | One stronger partner player at your weak skill |
| 1 + pick | Surplus player + owned traded pick | One partner player at your weak skill |

Picks come from Sleeper `traded_picks`, mapped to catalog pick IDs (`pick_{year}_mid_{round}`).

---

## Quality gates

1. **Non-degradation** — After the trade, every position room on your roster is ≥ pre-trade; your weak room must improve.
2. **Fairness** — Package totals use trade points; clearly uneven gaps (≥500) are dropped when possible.
3. **Partner protection** — Partner players who are required starters at their position are not offered.

---

## Ranking

Strongest → weakest by:

1. Improvement at your weak room
2. Fairness tier (even > lean > uneven)
3. Smaller value gap
4. Prefer different trade partners in the top three

---

## UI

- [TradeSuggestionsModal.tsx](../src/components/trade/TradeSuggestionsModal.tsx) — three slots with skeletons while loading.
- **Team One** — your team name; **You give** / **You receive**.
- **Team Two** — partner name; **They give** / **They receive** (mirror of your side).

See also [how-roster-guidance-works.md](./how-roster-guidance-works.md).
