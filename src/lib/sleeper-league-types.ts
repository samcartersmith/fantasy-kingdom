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
  metadata?: { team_name?: string };
};
