import type { PprMode } from "@/lib/trade-model/types";
import type { SkillPosition } from "@/lib/sleeper-ranking";

export type SeasonFpRow = {
  pts_ppr: number;
  pts_half_ppr: number;
  pts_std: number;
  games: number;
  /** nflverse `stats_player` season fields when present (built by `npm run data:fantasy`). */
  targets?: number;
  /** 0–1 team target share (WR/TE). */
  target_share?: number;
  carries?: number;
  receptions?: number;
  /** RB-style opportunity: carries + targets. */
  touches?: number;
  /** Season passing EPA (QB). */
  passing_epa?: number;
  passing_yards?: number;
  attempts?: number;
  /** Yards per attempt when attempts > 0. */
  passing_ypa?: number;
  /** Red-zone / short-yardage receiving targets when sourced from pbp builds; else omitted. */
  rz_targets?: number;
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

/** Anchors for optional “rich stat” normalization (same p5–p95 style as production). */
export type RichStatAnchors = {
  wrTeTargetShare: FpQuantileBand | null;
  rbTouchesPerGame: FpQuantileBand | null;
  qbPassingEpa: FpQuantileBand | null;
};

export type FpScoringContext = {
  snapshotAsOf: string;
  profiles: Record<string, PlayerFantasyProfile>;
  anchors: FpAnchors;
  /** Percentile anchors for usage / efficiency blend; null if insufficient sample. */
  richAnchors: RichStatAnchors | null;
  /**
   * Retrospective VBD proxy: weighted fantasy points minus worst-starter baseline for this league’s
   * starting counts (see `computeVbdComputation`). Empty when not computed.
   */
  vbdBySleeperId: Record<string, number>;
  /** p10/p90 style band for mapping raw VBD to a capped trade-point nudge. */
  vbdScale: { lo: number; hi: number } | null;
};

const SKILL_ORDER: SkillPosition[] = ["QB", "RB", "WR", "TE"];

function pickPts(row: SeasonFpRow, ppr: PprMode): number {
  let raw: number;
  if (ppr >= 1) raw = row.pts_ppr;
  else if (ppr >= 0.5) raw = row.pts_half_ppr;
  else raw = row.pts_std;
  if (!Number.isFinite(raw)) return 0;
  /** nflverse (and some feeds) can carry small negative season totals; log1p / norms need non-negative inputs. */
  return Math.max(0, raw);
}

/** Newest-first seasons the FP spine may read (add years here before changing recency weights). */
export const FP_SEASON_ORDER_DESC = ["2025", "2024", "2023"] as const;
export type FpSeasonKey = (typeof FP_SEASON_ORDER_DESC)[number];

export function presentFpSeasonKeysDesc(seasons: Record<string, SeasonFpRow>): FpSeasonKey[] {
  const out: FpSeasonKey[] = [];
  for (const y of FP_SEASON_ORDER_DESC) {
    if (seasons[y]) out.push(y);
  }
  return out;
}

/** Recency weights for 1–3 available seasons (newest first), sum to 1. */
export function fpRecencyWeights(count: number): number[] {
  if (count === 1) return [1];
  if (count === 2) return [0.65, 0.35];
  if (count === 3) return [0.5, 0.35, 0.15];
  throw new Error(`fpRecencyWeights: unsupported season count ${count} (max ${FP_SEASON_ORDER_DESC.length})`);
}

/** Weighted season totals (not per-game) — newest listed season in `FP_SEASON_ORDER_DESC` weighted heaviest. */
export function weightedSeasonTotals(profile: PlayerFantasyProfile, ppr: PprMode): {
  weightedPts: number;
  seasonsUsed: number;
} {
  const keys = presentFpSeasonKeysDesc(profile.seasons);
  if (keys.length === 0) return { weightedPts: 0, seasonsUsed: 0 };
  const w = fpRecencyWeights(keys.length);
  let weightedPts = 0;
  for (let i = 0; i < keys.length; i++) {
    const row = profile.seasons[keys[i]!]!;
    weightedPts += w[i]! * pickPts(row, ppr);
  }
  return { weightedPts, seasonsUsed: keys.length };
}

export function weightedPpg(profile: PlayerFantasyProfile, ppr: PprMode): {
  wppg: number;
  gamesWeight: number;
} {
  const keys = presentFpSeasonKeysDesc(profile.seasons);
  const usable = keys.filter((y) => {
    const r = profile.seasons[y];
    if (!r) return false;
    const p = pickPts(r, ppr);
    const g = r.games ?? 0;
    return Number.isFinite(p) && g > 0;
  });
  if (usable.length === 0) return { wppg: 0, gamesWeight: 0 };
  const w = fpRecencyWeights(usable.length);
  let wppgAcc = 0;
  let gamesWeight = 0;
  for (let i = 0; i < usable.length; i++) {
    const y = usable[i]!;
    const r = profile.seasons[y]!;
    const p = pickPts(r, ppr);
    const g = r.games ?? 0;
    wppgAcc += w[i]! * (p / g);
    gamesWeight += w[i]! * g;
  }
  return { wppg: wppgAcc, gamesWeight };
}

/**
 * Recency-weighted scalar from per-season rows (skips seasons where `picker` returns undefined).
 */
export function weightedNumericFromSeasons(
  profile: PlayerFantasyProfile,
  picker: (row: SeasonFpRow) => number | undefined | null,
): number | null {
  const keys = presentFpSeasonKeysDesc(profile.seasons);
  if (keys.length === 0) return null;
  const w = fpRecencyWeights(keys.length);
  let acc = 0;
  let sumW = 0;
  for (let i = 0; i < keys.length; i++) {
    const row = profile.seasons[keys[i]!]!;
    const v = picker(row);
    if (typeof v === "number" && Number.isFinite(v)) {
      acc += w[i]! * v;
      sumW += w[i]!;
    }
  }
  if (sumW <= 0) return null;
  return acc / sumW;
}

/**
 * Builds percentile anchors for optional nflverse “rich” fields (target share, RB touches/game, QB EPA).
 */
export function buildRichStatAnchors(profiles: Record<string, PlayerFantasyProfile>, _ppr: PprMode): RichStatAnchors {
  const wrTeShares: number[] = [];
  const rbTpg: number[] = [];
  const qbEpa: number[] = [];

  for (const p of Object.values(profiles)) {
    const primary = p.primaryPosition;
    const ts = weightedNumericFromSeasons(p, (r) => r.target_share);
    const tpg = weightedNumericFromSeasons(p, (r) => {
      const g = r.games ?? 0;
      if (g <= 0) return undefined;
      const touches =
        typeof r.touches === "number" && Number.isFinite(r.touches)
          ? r.touches
          : typeof r.carries === "number" && typeof r.targets === "number"
            ? r.carries + r.targets
            : undefined;
      if (touches == null || !Number.isFinite(touches)) return undefined;
      return touches / g;
    });
    const epa = weightedNumericFromSeasons(p, (r) => r.passing_epa);

    if ((primary === "WR" || primary === "TE") && ts != null && ts > 0) wrTeShares.push(ts);
    if (primary === "RB" && tpg != null && tpg > 0) rbTpg.push(tpg);
    if (primary === "QB" && epa != null && Number.isFinite(epa)) qbEpa.push(epa);
  }

  wrTeShares.sort((x, y) => x - y);
  rbTpg.sort((x, y) => x - y);
  qbEpa.sort((x, y) => x - y);

  return {
    wrTeTargetShare: quantileAnchors(wrTeShares, 0.05, 0.95),
    rbTouchesPerGame: quantileAnchors(rbTpg, 0.05, 0.95),
    qbPassingEpa: quantileAnchors(qbEpa, 0.05, 0.95),
  };
}

function richUsageNorm01(
  profile: PlayerFantasyProfile,
  primary: SkillPosition,
  richAnchors: RichStatAnchors | null,
): number {
  if (!richAnchors) return 0.5;
  if (primary === "WR" || primary === "TE") {
    const v = weightedNumericFromSeasons(profile, (r) => r.target_share);
    if (v == null) return 0.5;
    return normFromAnchors(v, richAnchors.wrTeTargetShare);
  }
  if (primary === "RB") {
    const v = weightedNumericFromSeasons(profile, (r) => {
      const g = r.games ?? 0;
      if (g <= 0) return undefined;
      const touches =
        typeof r.touches === "number" && Number.isFinite(r.touches)
          ? r.touches
          : typeof r.carries === "number" && typeof r.targets === "number"
            ? r.carries + r.targets
            : undefined;
      if (touches == null || !Number.isFinite(touches)) return undefined;
      return touches / g;
    });
    if (v == null) return 0.5;
    return normFromAnchors(v, richAnchors.rbTouchesPerGame);
  }
  if (primary === "QB") {
    const v = weightedNumericFromSeasons(profile, (r) => r.passing_epa);
    if (v == null) return 0.5;
    return normFromAnchors(v, richAnchors.qbPassingEpa);
  }
  return 0.5;
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
    if (weightedPts > 0) globals.push(Math.log1p(Math.max(0, weightedPts)));
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
  /** How much rich usage / efficiency norms pull the blended 0–1 strength (rest stays on fantasy points blend). */
  richStatBlend: number;
};

export const FP_BASELINE_DEFAULTS: FpBaselineConstants = {
  baseMin: 1400,
  baseSpan: 11_200,
  globalBlend: 0.45,
  richStatBlend: 0.09,
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
  fp: FpScoringContext,
  constants: FpBaselineConstants = FP_BASELINE_DEFAULTS,
): ProductionBaseResult {
  const anchors = fp.anchors;

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

  const logPts = weightedPts > 0 ? Math.log1p(Math.max(0, weightedPts)) : 0;
  const globalNorm = normFromAnchors(logPts, anchors.globalLogPts);

  const g = constants.globalBlend;
  const blendedPts = (1 - g) * posNorm + g * globalNorm;
  const usage01 = richUsageNorm01(profile, primary, fp.richAnchors);
  const rb = constants.richStatBlend;
  const blendedRaw = (1 - rb) * blendedPts + rb * usage01;
  const combinedNorm01 = stretchCombinedNorm01(blendedRaw);

  const basePoints = Math.round(constants.baseMin + combinedNorm01 * constants.baseSpan);

  const seasonKeys = presentFpSeasonKeysDesc(profile.seasons);
  const maxG = Math.max(0, ...seasonKeys.map((y) => profile.seasons[y]?.games ?? 0), gamesWeight);
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
