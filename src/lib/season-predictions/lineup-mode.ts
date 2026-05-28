export type SeasonPredictionsLineupMode = "pragmatic" | "optimal";

export const METHODOLOGY_PRAGMATIC = "sp-v2-sleeper-pragmatic";
export const METHODOLOGY_OPTIMAL = "sp-v2-sleeper-optimal";

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
      ? "Completed weeks use actual Sleeper scores; remaining weeks use the best legal lineup from Sleeper projections for active roster players (starters + bench, excluding taxi/IR)."
      : "Each matchup optimizes weekly projections across active roster players (starters + bench, excluding taxi/IR) for your league's roster positions.";
  }
  return currentWeek > 0
    ? "Completed weeks use actual Sleeper scores; remaining weeks adjust your listed starters (fill empty slots and swap players projected under 6 pts)."
    : "Each matchup uses your listed starters plus bench fixes for empty slots and weak projections.";
}
