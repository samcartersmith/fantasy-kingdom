import {
  computeRichUsageNorm01,
  type FpAnchors,
  type FpQuantileBand,
  type PlayerFantasyProfile,
  type RichStatAnchors,
  type TradeSpineLayer,
  weightedPpg,
  weightedSeasonTotals,
} from "@/lib/trade-model/fp-baseline";
import type { PprMode } from "@/lib/trade-model/types";
import type { SkillPosition } from "@/lib/sleeper-ranking";

const SKILL_ORDER: SkillPosition[] = ["QB", "RB", "WR", "TE"];

/** FP weight in composite sort key (rest = rich usage / efficiency). */
export const COMPOSITE_FP_WEIGHT = 0.76;
/** Rank curve exponent for **tail** ranks (outside elite cluster); lower = stiffer drop toward depth. */
export const RANK_CURVE_EXPONENT = 0.22;
/** Top ranks per position use a **tight linear** band; remaining ranks use the tail power curve. */
export const ELITE_CLUSTER_BY_POS: Record<SkillPosition, number> = {
  QB: 6,
  RB: 8,
  WR: 10,
  TE: 6,
};
/** `curve01` at the end of the elite band (joins tail); keeps RB1/RB2-type ranks close before the cliff. */
export const ELITE_CURVE_BOTTOM = 0.91;
/** Internal rank-only trade points before VBD multiplier in scorePlayer. */
export const RANK_BASE_MIN = 2200;
/** Span for RB/WR/QB rank→points mapping (TE uses {@link RANK_BASE_SPAN_TE}). */
export const RANK_BASE_SPAN = 17_800;
/** TE-only span (shorter replacement curve at the position). */
export const RANK_BASE_SPAN_TE = 10_200;
/** VBD percentile band within each position for normalization. */
const VBD_POS_Q_LO = 0.08;
const VBD_POS_Q_HI = 0.92;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function quantileAnchors(sorted: number[], qLo: number, qHi: number): FpQuantileBand | null {
  const n = sorted.length;
  if (n < 8) return null;
  const lo = sorted[Math.max(0, Math.floor(qLo * (n - 1)))];
  const hi = sorted[Math.min(n - 1, Math.ceil(qHi * (n - 1)))];
  if (!(hi > lo)) return { lo: lo - 1e-6, hi: lo + 1e-3, n };
  return { lo, hi, n };
}

function normFromAnchors(value: number, a: FpQuantileBand | null): number {
  if (!a) return 0.5;
  return clamp01((value - a.lo) / (a.hi - a.lo));
}

/**
 * Maps sort index `idx` (0 = best) among `n` players at `pos` to ~0–1 before applying `RANK_BASE_SPAN`.
 * Elite band: linear from 1 down to {@link ELITE_CURVE_BOTTOM}. Tail: `ELITE_CURVE_BOTTOM × (1 − u^p)`.
 */
export function rankCurve01(idx: number, n: number, pos: SkillPosition): number {
  if (n <= 1) return 1;
  const K = Math.min(ELITE_CLUSTER_BY_POS[pos], n);
  if (idx < K) {
    const denom = Math.max(K - 1, 1);
    return 1 - (1 - ELITE_CURVE_BOTTOM) * (idx / denom);
  }
  const m = n - K;
  if (m <= 0) return ELITE_CURVE_BOTTOM;
  const j = idx - K;
  const uTail = m <= 1 ? 0 : j / (m - 1);
  return ELITE_CURVE_BOTTOM * (1 - Math.pow(uTail, RANK_CURVE_EXPONENT));
}

function buildLogPtsAnchorsPerPosition(
  profiles: Record<string, PlayerFantasyProfile>,
  ppr: PprMode,
): Record<SkillPosition, FpQuantileBand | null> {
  const byPos: Record<SkillPosition, number[]> = { QB: [], RB: [], WR: [], TE: [] };
  for (const p of Object.values(profiles)) {
    const pos = p.primaryPosition;
    const { weightedPts } = weightedSeasonTotals(p, ppr);
    if (weightedPts > 0) {
      byPos[pos]?.push(Math.log1p(weightedPts));
    }
  }
  const out: Record<SkillPosition, FpQuantileBand | null> = { QB: null, RB: null, WR: null, TE: null };
  for (const pos of SKILL_ORDER) {
    const arr = byPos[pos].sort((x, y) => x - y);
    out[pos] = quantileAnchors(arr, 0.05, 0.95);
  }
  return out;
}

export function buildTradeSpinePrecompute(
  profiles: Record<string, PlayerFantasyProfile>,
  ppr: PprMode,
  vbdBySleeperId: Record<string, number>,
  richAnchors: RichStatAnchors | null,
  _anchors: FpAnchors,
): TradeSpineLayer {
  const logAnchors = buildLogPtsAnchorsPerPosition(profiles, ppr);
  const rankBaseBySleeperId: Record<string, number> = {};
  const vbdPosNorm01BySleeperId: Record<string, number> = {};

  type Row = {
    id: string;
    profile: PlayerFantasyProfile;
    composite: number;
    weightedPts: number;
    wppg: number;
  };

  for (const pos of SKILL_ORDER) {
    const rows: Row[] = [];
    for (const [id, profile] of Object.entries(profiles)) {
      if (profile.primaryPosition !== pos) continue;
      const { weightedPts } = weightedSeasonTotals(profile, ppr);
      const { wppg } = weightedPpg(profile, ppr);
      if (weightedPts <= 0 && wppg <= 0) continue;
      const logPts = Math.log1p(Math.max(0, weightedPts));
      const fpNorm = normFromAnchors(logPts, logAnchors[pos]);
      const rich01 = computeRichUsageNorm01(profile, pos, richAnchors);
      const composite = COMPOSITE_FP_WEIGHT * fpNorm + (1 - COMPOSITE_FP_WEIGHT) * rich01;
      rows.push({ id, profile, composite, weightedPts, wppg });
    }

    rows.sort((a, b) => {
      if (b.composite !== a.composite) return b.composite - a.composite;
      if (b.weightedPts !== a.weightedPts) return b.weightedPts - a.weightedPts;
      return b.wppg - a.wppg;
    });

    const n = rows.length;
    for (let idx = 0; idx < n; idx++) {
      const curve01 = rankCurve01(idx, n, pos);
      const span = pos === "TE" ? RANK_BASE_SPAN_TE : RANK_BASE_SPAN;
      const rankBase = Math.round(RANK_BASE_MIN + span * curve01);
      rankBaseBySleeperId[rows[idx]!.id] = rankBase;
    }

    const vbdVals = rows
      .map((r) => vbdBySleeperId[r.id])
      .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
      .sort((a, b) => a - b);
    let lo = 0;
    let hi = 1;
    if (vbdVals.length >= 4) {
      lo = vbdVals[Math.max(0, Math.floor(VBD_POS_Q_LO * (vbdVals.length - 1)))];
      hi = vbdVals[Math.min(vbdVals.length - 1, Math.ceil(VBD_POS_Q_HI * (vbdVals.length - 1)))];
      if (!(hi > lo)) {
        lo = vbdVals[0]!;
        hi = vbdVals[vbdVals.length - 1]! + 1e-6;
      }
    } else if (vbdVals.length > 0) {
      lo = vbdVals[0]!;
      hi = vbdVals[vbdVals.length - 1]! + 1e-6;
    }
    for (const r of rows) {
      const raw = vbdBySleeperId[r.id];
      const norm =
        typeof raw === "number" && Number.isFinite(raw) && hi > lo ? clamp01((raw - lo) / (hi - lo)) : 0.5;
      vbdPosNorm01BySleeperId[r.id] = norm;
    }
  }

  return { rankBaseBySleeperId, vbdPosNorm01BySleeperId };
}

/** Neutral rank base when profile exists but player had no countable FP seasons in snapshot. */
export const RANK_BASE_NEUTRAL_WEAK = 3600;
/** Neutral rank base when profile row is missing entirely. */
export const RANK_BASE_NEUTRAL_MISSING = 5200;
