import type { LeagueContext, PprMode } from "@/lib/trade-model/types";

/** Tunable coefficients layered on top of fantasy-production baseline. */
export const MODEL_WEIGHTS = {
  /** Scale for converting (tier − 0.5) into trade points for team offense. */
  teamOffensePoints: 320,
  ocPoints: 220,
  /** Curated “history” when no fantasy games row exists for this player. */
  curatedHistoryPoints: 260,
  /** Games played signal when fantasy snapshot exists (avoids double-counting curated history). */
  gamesPlayedPoints: 200,
  rolePoints: 360,
  injuryPoints: 260,
  /** Age curve contribution magnitude. */
  agePoints: 520,
  /** “Outlook” blends age + team + role (small nudge, avoids double-counting team). */
  futureBlendPoints: 200,
  /** Pick class strength adjustment scale. */
  pickClassPoints: 380,
  /** Per future season beyond the nearest draft year. */
  pickFutureDiscountPerYear: 180,
  leagueFormatReceiverPoints: 180,
  leagueFormatSizePoints: 120,
  /** Rank spine × merged VBD: `rankBase × (floor + span × vbdPos01 × dyn)`. */
  spineVbdFloor: 0.48,
  spineVbdSpan: 1.12,
  /** NFL draft round tier nudge (early rounds bump value for young résumés). */
  draftCapitalPoints: 160,
} as const;

/** Max absolute trade points added from Sleeper search rank + trending adds. */
export const BUZZ_MAX_POINTS = 140;

const NEUTRAL = 0.5;

function clamp01w(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Map NFL draft round (1–7) to a 0–1 tier for a small trade nudge; unknown/undrafted → neutral. */
export function nflDraftRoundTier01(round: number | null): { tier01: number; missing: boolean } {
  if (round == null || !Number.isFinite(round) || round < 1) {
    return { tier01: NEUTRAL, missing: true };
  }
  const r = Math.min(7, Math.floor(round));
  const table: Record<number, number> = {
    1: 0.9,
    2: 0.8,
    3: 0.68,
    4: 0.58,
    5: 0.52,
    6: 0.48,
    7: 0.46,
  };
  return { tier01: clamp01w(table[r] ?? 0.45), missing: false };
}

/**
 * Small market-sentiment nudge from Sleeper signals (not the value spine).
 * Typical range is about ±`cap` trade points.
 */
export function buzzTweakPoints(searchRank: number | null, trendingAdds: number, cap = BUZZ_MAX_POINTS): number {
  const sr = searchRank ?? 950;
  const inv = 1 - Math.min(Math.max(sr, 1), 2200) / 2200;
  const ta = Math.min(Math.max(trendingAdds, 0), 120) / 120;
  const mix = 0.78 * inv + 0.22 * ta;
  return (mix - NEUTRAL) * 2 * cap;
}

/** Map PPR setting to a tiny RB/WR tilt (QB/TE mostly unchanged at v1). */
export function pprReceiverTilt01(ppr: PprMode): number {
  if (ppr >= 1) return 0.55;
  if (ppr >= 0.5) return 0.52;
  return 0.48;
}

/** Slight scarcity tweak by league size (larger league → skill players worth a bit more). */
export function leagueSizeTilt01(leagueSize: number): number {
  if (leagueSize <= 8) return 0.48;
  if (leagueSize >= 14) return 0.52;
  return NEUTRAL;
}

export function futureOutlookRaw(input: {
  age01: number;
  team01: number;
  role01: number;
  missingAge: boolean;
  missingTeam: boolean;
  missingRole: boolean;
}): { value01: number; missing: boolean } {
  const parts: number[] = [];
  if (!input.missingAge) parts.push(input.age01);
  // Unknown team tier uses the same neutral prior as an explicit 0.5 offense tier for this blend only.
  parts.push(input.missingTeam ? NEUTRAL : input.team01);
  if (!input.missingRole) parts.push(input.role01);
  if (parts.length === 0) return { value01: NEUTRAL, missing: true };
  const v = parts.reduce((a, b) => a + b, 0) / parts.length;
  const allMissing = input.missingAge && input.missingTeam && input.missingRole;
  return { value01: v, missing: allMissing };
}

export function applyLeagueFormatToPlayerValue(
  value: number,
  ctx: LeagueContext,
  positionLabel: string,
  qbMultiplier: number,
): number {
  const isQb = positionLabel
    .split(",")
    .some((p) => p.trim().toUpperCase() === "QB");
  if (ctx.superflex && isQb) {
    return Math.round(value * qbMultiplier);
  }
  return Math.round(value);
}
