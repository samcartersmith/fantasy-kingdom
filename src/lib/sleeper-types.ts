/**
 * Partial shape of each value in `GET /v1/players/nfl` (object keyed by player_id).
 * Sleeper may add fields; we only rely on these.
 */
export type SleeperNflPlayer = {
  player_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  fantasy_positions?: string[] | null;
  team?: string | null;
  status?: string | null;
  sport?: string | null;
  /** Search popularity rank when Sleeper exposes it (lower = more searched). */
  search_rank?: number | null;
  /** NFL GSIS id when known; trim before joining to nflverse `player_id`. */
  gsis_id?: string | null;
  years_exp?: number | null;
  /** Numeric age in years when Sleeper provides it. */
  age?: number | null;
  /** ISO date string when present (not used directly by the trade model v1). */
  birth_date?: string | null;
};

export type SleeperNflPlayersMap = Record<string, SleeperNflPlayer>;

export type SleeperTrendingRow = {
  player_id: string;
  count: number;
};
