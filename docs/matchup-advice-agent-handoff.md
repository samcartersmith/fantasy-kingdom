# Matchup Advice — Agent handoff

Context for continuing work on the **Matchup Advice** tool (`/matchup-advice`). The feature is implemented and shippable; the owner’s current focus is **week switching** and **how data is loaded** when the user changes filters.

---

## Product goal

Help dynasty managers pick the best weekly lineup by showing:

- Head-to-head roster view (your team vs opponent) with Sleeper-style paired starter rows
- Projected vs actual points per player
- Rule-based lineup advice (start/sit swaps, injury/bye flags, projected margin)

v1 scope: Sleeper projections + lineup optimizer + injury/status from projection rows. No DVP, weather, or LLM yet.

---

## What’s already built

### Route and API

- Page: [`src/app/matchup-advice/page.tsx`](../src/app/matchup-advice/page.tsx)
- Hub: [`src/components/matchup-advice/MatchupAdviceHub.tsx`](../src/components/matchup-advice/MatchupAdviceHub.tsx)
- API: [`src/app/api/sleeper/matchup-advice/route.ts`](../src/app/api/sleeper/matchup-advice/route.ts)
  - Query: `league_id`, `roster_id`, optional `week` (defaults to current NFL week)
  - `export const dynamic = "force-dynamic"`
  - `export const maxDuration = 120`

### Server payload

- [`src/lib/matchup-advice/build-payload.ts`](../src/lib/matchup-advice/build-payload.ts) — orchestrates league, rosters, matchups, projections, paired rows, advice
- [`src/lib/matchup-advice/advice-engine.ts`](../src/lib/matchup-advice/advice-engine.ts) — deterministic swap/injury/margin insights
- [`src/lib/matchup-advice/types.ts`](../src/lib/matchup-advice/types.ts)

### Important data-loading decision (cache fix)

**Do not reintroduce `fetchSleeperNflPlayersMap()` (`/players/nfl`)** in this flow. That payload is ~7MB and breaks Next.js Data Cache (same issue as weekly projections).

Player display data (name, team, opponent, injury, game date) comes from **embedded `player` objects in weekly projection rows**, parsed in:

- [`src/lib/season-predictions/fetch-sleeper-projections.ts`](../src/lib/season-predictions/fetch-sleeper-projections.ts) — `ProjectionPlayerMeta`, `cache: "no-store"` on projection fetch

### UI layout (locked)

- **League | Team | Week** dropdowns in a bar **above** team summary cards (not beside “Starters” like Sleeper)
- Two team summary cards + VS, then starters/bench paired rows, then advice panel below
- Visual reference: `.cursor/projects/.../assets/Screenshot_2026-05-28_at_3.11.38_PM-....png` (Sleeper matchup screenshot)

### Sleeper connection

- Uses [`useSleeperConnectContext`](../src/contexts/SleeperConnectContext.tsx) — `selectedLeagueId`, `selectedRosterId` from localStorage
- Tool enabled in [`src/components/tools/tools-config.tsx`](../src/components/tools/tools-config.tsx)

---

## Current week-switching and load behavior

This is the area the owner wants improved.

### Client flow (`MatchupAdviceHub`)

1. When Sleeper connect is complete (`ready`), a `useEffect` calls `loadAdvice(leagueId, rosterId, selectedWeek)` whenever `selectedWeek`, league, or team changes.
2. `loadAdvice` fetches `GET /api/sleeper/matchup-advice?...` with `cache: "no-store"`.
3. `lastFetchKey` ref skips duplicate requests for the same `league:roster:week` key.
4. On first load, `selectedWeek` starts as `""` → API uses server default week → response sets `selectedWeek` via `setSelectedWeek((prev) => prev || String(body.week))`, which can trigger a **second fetch** for the explicit week.
5. On week change, `handleWeekChange` clears `lastFetchKey` and sets `selectedWeek` → full API round-trip again.
6. While loading **with no prior payload**: skeleton + message.
7. While loading **with existing payload**: old week’s data stays visible at reduced opacity (no skeleton, no `pointer-events-none` on controls).

### Server flow (per request)

For each API call, `buildMatchupAdvicePayload` roughly:

1. Fetches league, rosters, users, NFL state (cached/revalidated Sleeper league endpoints).
2. Fetches **that week’s** matchups → resolves H2H opponent.
3. Fetches **one week** of projections via `fetchSleeperWeeklyProjectionsWithHints` (downloads full weekly projection JSON ~7MB, then filters to relevant roster player IDs; in-process module cache keyed by season+week).
4. Runs lineup optimizer + advice engine.
5. Returns full `MatchupAdvicePayload` (both teams, all paired rows, advice).

**Every week change = new full payload build**, including re-reading/filtering that week’s projection file on the server (module cache helps only within the same Node process).

### Week dropdown UX quirks

- `weekOptions` uses `payload.regularSeasonWeeks` and `payload.currentWeek` after first load; before that it falls back to **14 weeks** hardcoded.
- Week list is not derived from league settings until the first successful response.
- Past weeks: `usesActuals` → team totals from matchup points; advice panel shows “Week complete” stub instead of swap suggestions.
- Future/current weeks: projections + swap advice.

---

## Known issues / improvement targets (owner priority)

### 1. Week switching feels slow or confusing

- Each week change triggers a **full API refetch** and server rebuild; projection download dominates latency.
- User may still see **previous week’s roster/advice** while the new week loads (opacity only), which can look like the week didn’t change.
- No loading indicator on the week control itself; only global “Loading weekly projections…” on first load.

**Directions to consider:**

- Keep previous payload visible but add explicit “Loading week N…” state and/or disable week dropdown only during fetch (not league/team).
- Show skeleton overlay for roster section on week change, not only when `!payload`.
- Stale-while-revalidate: show cached week data if already fetched this session (client-side `Map<week, payload>`).
- Abort in-flight fetch when user changes week again (`AbortController`).

### 2. Double fetch on initial load

- Mount: `selectedWeek === ""` → fetch with default week.
- Then `setSelectedWeek` from response may trigger second fetch if key differs (`default` vs `"5"`).

**Fix:** Initialize week from NFL state or league metadata client-side, or always pass explicit week on first fetch and don’t re-fetch when response week matches.

### 3. Server loads full projection file per week

- `fetchRawWeekRows` pulls entire week’s projection array even though only ~30–40 roster players are needed (same pattern as season predictions).
- In-process caches: `rawWeekCache`, `parsedWeekCache` in `fetch-sleeper-projections.ts`.

**Directions to consider:**

- Prefetch adjacent weeks in background after first load.
- Parallel fetch only matchup + projections (already parallelized partially via `Promise.all` at top of build).
- Document that first week switch after cold start will be slow; optimize perceived performance in UI first.

### 4. `lastFetchKey` edge cases

- Cleared on week/league/team change handlers, but logic is easy to get wrong and block legitimate refetches.
- Review whether dedup should live in the hub at all vs relying on React Query / SWR.

### 5. Not in scope for this pass (but planned elsewhere)

- URL query params (`?week=`) for shareable links
- DVP, weather, news-room injury links
- Per-player actual points when Sleeper matchup lacks `players_points`

---

## Key files to touch for week/load work

| Area | File |
|------|------|
| Client fetch + week state | [`src/components/matchup-advice/MatchupAdviceHub.tsx`](../src/components/matchup-advice/MatchupAdviceHub.tsx) |
| Week/league/team controls | [`src/components/matchup-advice/MatchupAdviceControlBar.tsx`](../src/components/matchup-advice/MatchupAdviceControlBar.tsx) |
| API entry | [`src/app/api/sleeper/matchup-advice/route.ts`](../src/app/api/sleeper/matchup-advice/route.ts) |
| Payload assembly | [`src/lib/matchup-advice/build-payload.ts`](../src/lib/matchup-advice/build-payload.ts) |
| Projections + player meta | [`src/lib/season-predictions/fetch-sleeper-projections.ts`](../src/lib/season-predictions/fetch-sleeper-projections.ts) |
| Reference pattern (manual run button) | [`src/components/season-predictions/SeasonPredictionsHub.tsx`](../src/components/season-predictions/SeasonPredictionsHub.tsx) |

---

## Reference: prior cache incident

Symptoms users reported: dropdowns disabled, no advice visible, page felt frozen.

Cause: loading entire `players/nfl` through Next Data Cache + disabling all controls while `loading === true`.

Fix applied: remove `players/nfl` from matchup advice; use projection row metadata; `cache: "no-store"` on client API fetch; don’t disable league/team/week during advice fetch (only while connect lists restore).

**Regression test:** Changing week should always refetch and update opponent + rows; controls should stay clickable; network tab should show `matchup-advice` returning 200 with a new `week` field in JSON.

---

## Tests

- [`src/lib/matchup-advice/advice-engine.test.ts`](../src/lib/matchup-advice/advice-engine.test.ts)
- [`src/lib/matchup-advice/build-payload.test.ts`](../src/lib/matchup-advice/build-payload.test.ts)
- [`src/lib/season-predictions/fetch-sleeper-projections.test.ts`](../src/lib/season-predictions/fetch-sleeper-projections.test.ts) — asserts `cache: "no-store"` on projection fetch

---

## Suggested acceptance criteria for “week switching” improvement

1. Changing week updates opponent, totals, roster rows, and advice without requiring a full page refresh.
2. User gets clear feedback while a new week is loading (not a silent stale view).
3. No double fetch on initial page load when connect is already complete.
4. First load and week switch remain correct for past weeks (actuals) vs future weeks (projections).
5. Do not reintroduce `/players/nfl` in this API path.

---

## Plan doc (do not edit unless asked)

Original craft plan lives at `.cursor/plans/matchup_advice_feature_8789723b.plan.md` (owner asked agents not to modify it). This handoff supersedes it for **follow-up work only**.
