export type { SeasonPredictionsLineupMode } from "@/lib/season-predictions/lineup-mode";
export {
  METHODOLOGY_OPTIMAL,
  METHODOLOGY_PRAGMATIC,
} from "@/lib/season-predictions/lineup-mode";

export type SeasonPredictionSortKey =
  | "rank"
  | "teamName"
  | "projectedRecord"
  | "pointsFor"
  | "pointsAgainst";

export type SeasonPredictionRow = {
  rosterId: number;
  teamName: string;
  ownerDisplayName: string;
  avatarUrl?: string;
  projectedWins: number;
  projectedLosses: number;
  projectedTies: number;
  projectedRecord: string;
  pointsFor: number;
  pointsAgainst: number;
};

export type SeasonPredictionMatchup = {
  week: number;
  rosterA: number;
  rosterB: number;
  teamNameA: string;
  teamNameB: string;
  scoreA: number;
  scoreB: number;
  winnerRosterId: number | null;
  usedActuals: boolean;
};

export type SeasonPredictionsMeta = {
  methodologyVersion: string;
  lineupMode: "pragmatic" | "optimal";
  leagueContextLabel: string;
  season: string;
  currentWeek: number;
  regularSeasonWeeks: number;
  valueNote: string;
  lastUpdated: string;
  projectionWeeksFetched: number;
  /** Projected weeks are scored with league scoring_settings (not generic pts_ppr presets). */
  usesLeagueScoring: boolean;
};

export type SeasonPredictionsPayload = {
  league: {
    league_id: string;
    name: string;
    season: string;
    status: string;
  };
  rows: SeasonPredictionRow[];
  matchups: SeasonPredictionMatchup[];
  meta: SeasonPredictionsMeta;
};
