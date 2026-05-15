export { TRADE_MODEL_VERSION, DEFAULT_STARTING_SLOTS } from "@/lib/trade-model/types";
export type {
  CatalogEvaluation,
  CuratedTradeSnapshot,
  EvaluationComponent,
  LeagueContext,
  LeagueSize,
  PickBucket,
  PickScoreInput,
  PlayerScoreInput,
  PprMode,
  ScoreResult,
  StartingSlotCounts,
  TradeModelProviders,
} from "@/lib/trade-model/types";
export { createCuratedProviders } from "@/lib/trade-model/providers";
export { scorePlayer } from "@/lib/trade-model/score-player";
export { scorePick } from "@/lib/trade-model/score-pick";
export { resolvePlayerAgeYears, ageCurve01, peakYearsRemaining01 } from "@/lib/trade-model/age-curve";
export { tryParsePickId } from "@/lib/trade-model/pick-parse";
export {
  buildFpAnchors,
  buildRichStatAnchors,
  productionBaseTradePoints,
  weightedPpg,
  weightedSeasonTotals,
  weightedNumericFromSeasons,
  fpRecencyWeights,
  presentFpSeasonKeysDesc,
  FP_SEASON_ORDER_DESC,
} from "@/lib/trade-model/fp-baseline";
export type {
  FantasyProfilePayload,
  FpAnchors,
  FpScoringContext,
  PlayerFantasyProfile,
  RichStatAnchors,
  TradeSpineLayer,
} from "@/lib/trade-model/fp-baseline";
export { buildTradeSpinePrecompute } from "@/lib/trade-model/trade-spine";
export { computeVbdComputation } from "@/lib/trade-model/vbd";
export type { VbdComputation } from "@/lib/trade-model/vbd";
export { MODEL_WEIGHTS, applyLeagueFormatToPlayerValue, BUZZ_MAX_POINTS, buzzTweakPoints, nflDraftRoundTier01 } from "@/lib/trade-model/weights";
