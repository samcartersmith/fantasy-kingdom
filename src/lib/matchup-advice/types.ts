import type { GuidanceInsight } from "@/lib/roster-guidance";

export type MatchupPlayerStatus = "yet_to_play" | "played" | "bye" | "out";

export type MatchupPlayerTile = {
  playerId: string;
  name: string;
  shortName: string;
  position: string | null;
  nflTeam: string | null;
  headshotUrl: string | null;
  projectedPoints: number | null;
  actualPoints: number | null;
  status: MatchupPlayerStatus;
  statusLabel: string;
  gameLabel: string | null;
  injuryBadge: string | null;
};

export type MatchupPairedRow = {
  slotLabel: string;
  section: "starters" | "bench";
  left: MatchupPlayerTile | null;
  right: MatchupPlayerTile | null;
};

export type MatchupTeamSummary = {
  rosterId: number;
  teamName: string;
  username: string | null;
  avatarUrl: string | null;
  record: string;
  projectedTotal: number;
  actualTotal: number | null;
  winProbability: number | null;
  yetToPlaySummary: string | null;
};

export type MatchupAdvicePayload = {
  league: {
    league_id: string;
    name: string;
    season: string;
    status: string;
  };
  week: number;
  currentWeek: number;
  regularSeasonWeeks: number;
  usesActuals: boolean;
  yourTeam: MatchupTeamSummary;
  opponent: MatchupTeamSummary | null;
  pairedRows: MatchupPairedRow[];
  advice: GuidanceInsight[];
  meta: {
    valueNote: string;
    opponentNote: string | null;
    weekScopeNote: string;
  };
  availableWeeks: number[];
};
