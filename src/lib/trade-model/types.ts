/** Semantic version of the explainable trade model (bump when weights or snapshot schema change). */
export const TRADE_MODEL_VERSION = "2.1.0";

export type PprMode = 0 | 0.5 | 1;

export type LeagueSize = 8 | 10 | 12 | 14;

/** Per-team starting counts for VBD-style scarcity (1–4 each). */
export type StartingSlotCounts = {
  startQb: 1 | 2 | 3 | 4;
  startRb: 1 | 2 | 3 | 4;
  startWr: 1 | 2 | 3 | 4;
  startTe: 1 | 2 | 3 | 4;
  startFlex: 1 | 2 | 3 | 4;
};

export const DEFAULT_STARTING_SLOTS: StartingSlotCounts = {
  startQb: 1,
  startRb: 2,
  startWr: 2,
  startTe: 1,
  startFlex: 1,
};

/** League scoring context — all format adjustments should consume this once on the server. */
export type LeagueContext = {
  superflex: boolean;
  ppr: PprMode;
  leagueSize: LeagueSize;
} & StartingSlotCounts;

export type EvaluationComponent = {
  key: string;
  label: string;
  /** Points added (can be negative) toward final trade value before clamp. */
  contribution: number;
  /** True when curated/API data was absent and a neutral prior was used. */
  missing?: boolean;
};

/** Slim shape stored on each catalog asset for the trade UI. */
export type CatalogEvaluation = {
  confidence01: number;
  components: EvaluationComponent[];
};

export type PlayerScoreInput = {
  sleeperPlayerId: string;
  teamAbbr: string;
  /** Display string e.g. `QB` or `QB,TE` — model uses primary skill role. */
  positionLabel: string;
  searchRank: number | null;
  trendingAdds: number;
  age: number | null;
  yearsExp: number | null;
  /** NFL draft round 1–7 when known (from nflverse players crosswalk); null = undrafted / unknown. */
  nflDraftRound: number | null;
};

export type PickBucket = "early" | "mid" | "late";

export type PickScoreInput = {
  /** Draft year of the pick. */
  year: number;
  round: number;
  bucket: PickBucket;
  /** Baseline value from catalog JSON before model adjustments. */
  anchorValue: number;
};

export type ScoreResult = {
  value: number;
  confidence01: number;
  components: EvaluationComponent[];
};

/** Raw curated tables (subset optional — missing keys resolve to neutral). */
export type CuratedTradeSnapshot = {
  snapshotAsOf: string;
  /** Sleeper-like team abbrev → offense quality in [0, 1], 0.5 = unknown/neutral. */
  teamOffense01: Record<string, number>;
  /** Key `${teamAbbr}:${seasonYear}` → OC / scheme quality in [0, 1]. */
  ocQuality01: Record<string, number>;
  /** Sleeper player id string → recent performance / stability tier in [0, 1]. */
  playerHistory01: Record<string, number>;
  /** Sleeper player id → role / depth in [0, 1] (higher = more central / “star”). */
  playerRole01: Record<string, number>;
  /** Sleeper player id → availability tier in [0, 1] (higher = cleaner health signal). */
  injuryAvailability01: Record<string, number>;
  /** Draft class year → strength in [0, 1] for pick valuation. */
  draftClassStrength01: Record<string, number>;
};

export type TeamOffenseContext = { tier01: number; missing: boolean };
export type OcContext = { tier01: number; missing: boolean };
export type PlayerScalarContext = { tier01: number; missing: boolean };

export interface TeamOffenseProvider {
  getTeamOffense(teamAbbr: string): TeamOffenseContext;
}

export interface CoordinatorProvider {
  /** @param seasonYear NFL season year label (e.g. 2026 for 2025–26 season work). */
  getOcQuality(teamAbbr: string, seasonYear: number): OcContext;
}

export interface PlayerHistoryProvider {
  getHistoryTier(sleeperPlayerId: string): PlayerScalarContext;
}

export interface PlayerRoleProvider {
  getRoleTier(sleeperPlayerId: string): PlayerScalarContext;
}

export interface InjuryAvailabilityProvider {
  getAvailabilityTier(sleeperPlayerId: string): PlayerScalarContext;
}

export interface DraftClassProvider {
  getClassStrength01(draftYear: number): PlayerScalarContext;
}

export type TradeModelProviders = {
  teamOffense: TeamOffenseProvider;
  coordinator: CoordinatorProvider;
  history: PlayerHistoryProvider;
  role: PlayerRoleProvider;
  injury: InjuryAvailabilityProvider;
  draftClass: DraftClassProvider;
};
