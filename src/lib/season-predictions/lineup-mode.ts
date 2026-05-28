export type SeasonPredictionsLineupMode = "pragmatic" | "optimal";

export const METHODOLOGY_PRAGMATIC = "sp-v3-sleeper-pragmatic";
export const METHODOLOGY_OPTIMAL = "sp-v3-sleeper-optimal";

const LEAGUE_SCORING_NOTE =
  "Future-week player points use Sleeper projected stats scored with your league's custom settings (not generic PPR presets).";

export function parseLineupMode(input: string | null | undefined): SeasonPredictionsLineupMode {
  if (input?.trim().toLowerCase() === "optimal") return "optimal";
  return "pragmatic";
}

export function methodologyVersionForMode(mode: SeasonPredictionsLineupMode): string {
  return mode === "optimal" ? METHODOLOGY_OPTIMAL : METHODOLOGY_PRAGMATIC;
}

export function valueNoteForMode(
  mode: SeasonPredictionsLineupMode,
  currentWeek: number,
): string {
  if (mode === "optimal") {
    return currentWeek > 0
      ? `Completed weeks use actual Sleeper scores; remaining weeks use the best legal lineup from weekly projections. ${LEAGUE_SCORING_NOTE}`
      : `Each matchup optimizes weekly projections across active roster players (starters + bench, excluding taxi/IR) for your league's roster positions. ${LEAGUE_SCORING_NOTE}`;
  }
  return currentWeek > 0
    ? `Completed weeks use actual Sleeper scores; remaining weeks adjust your listed starters (fill empty slots and swap players projected under 6 pts). ${LEAGUE_SCORING_NOTE}`
    : `Each matchup uses your listed starters plus bench fixes for empty slots and weak projections. ${LEAGUE_SCORING_NOTE}`;
}
