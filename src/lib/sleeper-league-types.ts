export type SleeperUser = {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
};

export type SleeperLeagueSettings = {
  type?: number;
  best_ball?: number;
  dynasty?: number;
  playoff_week_start?: number;
  playoff_teams?: number;
  playoff_round_type?: number;
};

export type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  status: string;
  total_rosters: number;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  settings?: SleeperLeagueSettings;
  previous_league_id?: string | null;
  draft_id?: string | null;
};

export type SleeperMatchup = {
  roster_id: number;
  matchup_id: number;
  points: number;
  custom_points?: number | null;
  starters?: string[];
  players?: string[];
};

export type SleeperBracketMatch = {
  r: number;
  m: number;
  t1: number | null;
  t2: number | null;
  w?: number | null;
  l?: number | null;
  t1_from?: { w?: number; l?: number };
  t2_from?: { w?: number; l?: number };
  p?: number;
};

export type SleeperDraftSettings = {
  rounds?: number;
  teams?: number;
};

export type SleeperDraft = {
  draft_id: string;
  season: string;
  status: string;
  type?: string;
  settings?: SleeperDraftSettings;
};

export type SleeperDraftPick = {
  pick_no: number;
  round: number;
  roster_id: number;
  player_id: string | null;
  picked_by?: string;
  /** Sleeper draft board column (1-based). */
  draft_slot?: number;
};

/** Traded picks for a specific draft (`GET /draft/{id}/traded_picks`). */
export type SleeperDraftTradedPick = {
  season: string;
  round: number;
  /** Original slot owner roster id. */
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
};

export type LeagueHistorySeason = {
  league_id: string;
  season: string;
  name: string;
  status: string;
};

export type SleeperRoster = {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
  starters: string[] | null;
  reserve: string[] | null;
  taxi: string[] | null;
};

export type SleeperLeagueUser = {
  user_id: string;
  display_name: string;
  avatar?: string | null;
  metadata?: { team_name?: string };
};

/** League traded / future draft picks (`GET /league/{id}/traded_picks`). */
export type SleeperTradedPick = {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
};
