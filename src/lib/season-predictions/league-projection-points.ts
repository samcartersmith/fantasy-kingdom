import type { PprMode } from "@/lib/trade-model/types";

export type ProjectionStats = Record<string, unknown>;

function statsObject(row: Record<string, unknown>): ProjectionStats | null {
  const stats = row.stats;
  if (!stats || typeof stats !== "object") return null;
  return stats as ProjectionStats;
}

/** True when league scoring_settings has at least one numeric rule. */
export function hasLeagueScoringSettings(
  scoringSettings: Record<string, number> | null | undefined,
): boolean {
  if (!scoringSettings) return false;
  return Object.values(scoringSettings).some((v) => typeof v === "number");
}

/**
 * Sum projected stat line using Sleeper league scoring_settings (same dot-product as the app).
 */
export function fantasyPointsFromProjectionStats(
  stats: ProjectionStats | null | undefined,
  scoringSettings: Record<string, number>,
): number {
  if (!stats) return 0;

  let pts = 0;
  for (const [key, multiplier] of Object.entries(scoringSettings)) {
    if (typeof multiplier !== "number" || !(key in stats)) continue;
    const value = Number(stats[key]);
    if (Number.isFinite(value)) pts += value * multiplier;
  }

  return pts;
}

function genericProjectionPts(stats: ProjectionStats | null, ppr: PprMode): number {
  if (!stats) return 0;
  const key = ppr === 1 ? "pts_ppr" : ppr === 0.5 ? "pts_half_ppr" : "pts_std";
  const raw = stats[key];
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function fantasyPointsFromProjectionRow(
  row: Record<string, unknown>,
  scoringSettings: Record<string, number> | null | undefined,
  pprFallback: PprMode,
): number {
  const stats = statsObject(row);

  if (hasLeagueScoringSettings(scoringSettings)) {
    const leaguePts = fantasyPointsFromProjectionStats(stats, scoringSettings!);
    if (leaguePts > 0) return leaguePts;
  }

  return genericProjectionPts(stats, pprFallback);
}

/** Stable cache key segment for parsed projection maps (per league scoring). */
export function scoringSettingsCacheKey(
  scoringSettings: Record<string, number> | null | undefined,
  ppr: PprMode,
): string {
  if (!hasLeagueScoringSettings(scoringSettings)) {
    return `ppr:${ppr}`;
  }

  const entries = Object.entries(scoringSettings!)
    .filter(([, v]) => typeof v === "number")
    .sort(([a], [b]) => a.localeCompare(b));
  return `league:${JSON.stringify(entries)}`;
}
