/**
 * Central place for Sleeper URLs beyond the minimal set in `sleeper-constants.ts` / `sleeper-fetch.ts`.
 *
 * **Trade model (today):** uses a checked-in **nflverse-backed** fantasy stat snapshot for production + short-window **trending adds** + **search_rank**
 * from the players map — rate-limit and cap buzz so hype cannot dominate (`docs/how-player-trade-score-is-calculated.md`).
 *
 * **Future / calibration:** league drafts, rosters, and forward-looking signals can be layered here with explicit TTLs;
 * keep **nflverse stat builds** for reproducible historical production (`npm run data:fantasy`).
 */
import { SLEEPER_API_V1_BASE, sleeperTrendingAddsUrl } from "@/lib/sleeper-constants";

/** Regular-season stat rollup (same family as `scripts/build-fantasy-profiles.mjs`). */
export function sleeperNflRegularStatsRollupUrl(season: number, week = 18): string {
  const q = new URLSearchParams({ season_type: "regular", week: String(week) });
  return `${SLEEPER_API_V1_BASE}/stats/nfl/regular/${season}?${q.toString()}`;
}

export function sleeperTrendingDropsUrl(limit: number, lookbackHours: number): string {
  const q = new URLSearchParams({
    limit: String(limit),
    lookback_hours: String(lookbackHours),
  });
  return `${SLEEPER_API_V1_BASE}/players/nfl/trending/drop?${q.toString()}`;
}

export { sleeperTrendingAddsUrl };

export function sleeperLeagueUrl(leagueId: string): string {
  return `${SLEEPER_API_V1_BASE}/league/${encodeURIComponent(leagueId)}`;
}

export function sleeperLeagueRostersUrl(leagueId: string): string {
  return `${SLEEPER_API_V1_BASE}/league/${encodeURIComponent(leagueId)}/rosters`;
}

export function sleeperDraftUrl(draftId: string): string {
  return `${SLEEPER_API_V1_BASE}/draft/${encodeURIComponent(draftId)}`;
}

export function sleeperDraftPicksUrl(draftId: string): string {
  return `${SLEEPER_API_V1_BASE}/draft/${encodeURIComponent(draftId)}/picks`;
}
