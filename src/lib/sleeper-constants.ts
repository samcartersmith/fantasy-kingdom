/** Official Sleeper read-only API — no key required. @see https://docs.sleeper.com */
export const SLEEPER_API_V1_BASE = "https://api.sleeper.app/v1";

export const SLEEPER_NFL_PLAYERS_URL = `${SLEEPER_API_V1_BASE}/players/nfl`;

/** Per Sleeper docs: avoid hitting players/nfl more than about once per day (large payload). */
export const SLEEPER_PLAYERS_REVALIDATE_SECONDS = 86_400;

/** Trending adds/drops can refresh more often than the full player map. */
export const SLEEPER_TRENDING_REVALIDATE_SECONDS = 3_600;

export function sleeperTrendingAddsUrl(limit: number, lookbackHours: number): string {
  const q = new URLSearchParams({
    limit: String(limit),
    lookback_hours: String(lookbackHours),
  });
  return `${SLEEPER_API_V1_BASE}/players/nfl/trending/add?${q.toString()}`;
}
