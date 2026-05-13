import type { PprMode } from "@/lib/trade-model/types";
import type { SkillPosition } from "@/lib/sleeper-ranking";

export type SeasonFpRow = {
  pts_ppr: number;
  pts_half_ppr: number;
  pts_std: number;
  games: number;
};

export type PlayerFantasyProfile = {
  primaryPosition: SkillPosition;
  seasons: Record<string, SeasonFpRow>;
};

export type FantasyProfilePayload = {
  snapshotAsOf: string;
  source?: string;
  profiles: Record<string, PlayerFantasyProfile>;
};

/** Percentile band used to normalize PPG / log-points (wider lo–hi = more spread among elites). */
export type FpQuantileBand = { lo: number; hi: number; n: number };

export type PositionalFpAnchors = Record<SkillPosition, FpQuantileBand | null>;

export type FpAnchors = {
  /** Per-position weighted PPG (for league scoring mode). */
  positionalWppg: PositionalFpAnchors;
  /** League-wide log(1 + weighted season points) percentiles. */
  globalLogPts: FpQuantileBand | null;
};

export type FpScoringContext = {
  snapshotAsOf: string;
  profiles: Record<string, PlayerFantasyProfile>;
  anchors: FpAnchors;
};

const SKILL_ORDER: SkillPosition[] = ["QB", "RB", "WR", "TE"];

function pickPts(row: SeasonFpRow, ppr: PprMode): number {
  if (ppr >= 1) return row.pts_ppr;
  if (ppr >= 0.5) return row.pts_half_ppr;
  return row.pts_std;
}

/** Weighted season totals (not per-game) — last season weighted heavier. */
export function weightedSeasonTotals(profile: PlayerFantasyProfile, ppr: PprMode): {
  weightedPts: number;
  seasonsUsed: number;
} {
  const s24 = profile.seasons["2024"];
  const s23 = profile.seasons["2023"];
  const p24 = s24 ? pickPts(s24, ppr) : null;
  const p23 = s23 ? pickPts(s23, ppr) : null;
  if (p24 != null && p23 != null) return { weightedPts: 0.65 * p24 + 0.35 * p23, seasonsUsed: 2 };
  if (p24 != null) return { weightedPts: p24, seasonsUsed: 1 };
  if (p23 != null) return { weightedPts: p23, seasonsUsed: 1 };
  return { weightedPts: 0, seasonsUsed: 0 };
}

export function weightedPpg(profile: PlayerFantasyProfile, ppr: PprMode): {
  wppg: number;
  gamesWeight: number;
} {
  const s24 = profile.seasons["2024"];
  const s23 = profile.seasons["2023"];
  const p24 = s24 ? pickPts(s24, ppr) : null;
  const g24 = s24?.games ?? 0;
  const p23 = s23 ? pickPts(s23, ppr) : null;
  const g23 = s23?.games ?? 0;

  if (p24 != null && p23 != null && g24 > 0 && g23 > 0) {
    const wppg = (0.65 * (p24 / g24) + 0.35 * (p23 / g23));
    return { wppg, gamesWeight: 0.65 * g24 + 0.35 * g23 };
  }
  if (p24 != null && g24 > 0) return { wppg: p24 / g24, gamesWeight: g24 };
  if (p23 != null && g23 > 0) return { wppg: p23 / g23, gamesWeight: g23 };
  return { wppg: 0, gamesWeight: 0 };
}

/** ~5th / ~95th sample positions (wider than p10–p90) so elite starters separate more in normalized space. */
function quantileAnchors(sorted: number[], qLo: number, qHi: number): FpQuantileBand | null {
  const n = sorted.length;
  if (n < 8) return null;
  const lo = sorted[Math.max(0, Math.floor(qLo * (n - 1)))];
  const hi = sorted[Math.min(n - 1, Math.ceil(qHi * (n - 1)))];
  if (!(hi > lo)) return { lo: lo - 1e-6, hi: lo + 1e-3, n };
  return { lo, hi, n };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function normFromAnchors(value: number, a: FpQuantileBand | null): number {
  if (!a) return 0.5;
  return clamp01((value - a.lo) / (a.hi - a.lo));
}

/**
 * Builds positional PPG anchors and global log-points anchors for the given profiles and scoring mode.
 */
export function buildFpAnchors(profiles: Record<string, PlayerFantasyProfile>, ppr: PprMode): FpAnchors {
  const byPos: Record<SkillPosition, number[]> = { QB: [], RB: [], WR: [], TE: [] };
  const globals: number[] = [];

  for (const p of Object.values(profiles)) {
    const { wppg } = weightedPpg(p, ppr);
    const { weightedPts } = weightedSeasonTotals(p, ppr);
    if (weightedPts > 0) globals.push(Math.log1p(weightedPts));
    if (wppg > 0 && p.primaryPosition) {
      byPos[p.primaryPosition]?.push(wppg);
    }
  }

  const positionalWppg: PositionalFpAnchors = { QB: null, RB: null, WR: null, TE: null };
  for (const pos of SKILL_ORDER) {
    const arr = byPos[pos].sort((x, y) => x - y);
    positionalWppg[pos] = quantileAnchors(arr, 0.05, 0.95);
  }

  const sortedG = globals.sort((x, y) => x - y);
  const globalLogPts = quantileAnchors(sortedG, 0.05, 0.95);

  return { positionalWppg, globalLogPts };
}

export type ProductionBaseResult = {
  /** Primary trade-point contribution from fantasy production. */
  basePoints: number;
  /** Combined 0–1 strength after positional + global blend. */
  combinedNorm01: number;
  missing: boolean;
  /** Games-weighted participation for durability signal (0–1). */
  gamesParticipation01: number;
};

export type FpBaselineConstants = {
  /** Trade points mapped from combined production strength. */
  baseMin: number;
  baseSpan: number;
  /** Blend: positional PPG norm vs global season-points norm (higher = more cross-position separation). */
  globalBlend: number;
};

export const FP_BASELINE_DEFAULTS: FpBaselineConstants = {
  baseMin: 1400,
  baseSpan: 11_200,
  globalBlend: 0.45,
};

/**
 * Convexifies the upper tail of the blended 0–1 production norm so elite-vs-elite
 * differences map to larger trade-point gaps (see player model review plan).
 */
export function stretchCombinedNorm01(raw: number): number {
  const knee = 0.82;
  const outKnee = 0.62;
  const t = clamp01(raw);
  if (t <= knee) return clamp01((t / knee) * outKnee);
  return clamp01(outKnee + ((t - knee) / (1 - knee)) * (1 - outKnee));
}

/**
 * Maps fantasy profile + anchors into the main production-based score contribution.
 */
export function productionBaseTradePoints(
  profile: PlayerFantasyProfile | undefined,
  positionLabel: string,
  ppr: PprMode,
  anchors: FpAnchors,
  constants: FpBaselineConstants = FP_BASELINE_DEFAULTS,
): ProductionBaseResult {
  if (!profile) {
    const combinedNorm01 = stretchCombinedNorm01(0.42);
    return {
      basePoints: Math.round(constants.baseMin + combinedNorm01 * constants.baseSpan),
      combinedNorm01,
      missing: true,
      gamesParticipation01: 0.5,
    };
  }

  const primary = profile.primaryPosition;
  const { wppg, gamesWeight } = weightedPpg(profile, ppr);
  const { weightedPts } = weightedSeasonTotals(profile, ppr);

  const posAnchors = anchors.positionalWppg[primary];
  const posNorm = normFromAnchors(wppg, posAnchors);

  const logPts = weightedPts > 0 ? Math.log1p(weightedPts) : 0;
  const globalNorm = normFromAnchors(logPts, anchors.globalLogPts);

  const g = constants.globalBlend;
  const blendedRaw = (1 - g) * posNorm + g * globalNorm;
  const combinedNorm01 = stretchCombinedNorm01(blendedRaw);

  const basePoints = Math.round(constants.baseMin + combinedNorm01 * constants.baseSpan);

  const maxG = Math.max(
    profile.seasons["2024"]?.games ?? 0,
    profile.seasons["2023"]?.games ?? 0,
    gamesWeight,
  );
  const gamesParticipation01 = clamp01(maxG / 17);

  const missing = weightedPts <= 0 && wppg <= 0;

  return { basePoints, combinedNorm01, missing, gamesParticipation01 };
}

/** Primary skill position from catalog label (matches profile.primaryPosition). */
export function primarySkillFromLabel(positionLabel: string): SkillPosition | null {
  const parts = positionLabel.split(",").map((p) => p.trim().toUpperCase());
  for (const pos of SKILL_ORDER) {
    if (parts.includes(pos)) return pos;
  }
  return null;
}
