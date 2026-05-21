/**
 * Draft pick slot values on the trade-calculator scale (0–10k-ish per pick, not a fixed pool sum).
 * Baseline anchors are defined for a 12-team, 4-round (48-pick) draft; other sizes map by normalized position.
 */

/** Minimum divisor when grading player value vs slot (avoids ratio blow-ups). */
export const MIN_SLOT_FLOOR = 25;

export const STEAL_RATIO_THRESHOLD = 1.15;
export const BUST_RATIO_THRESHOLD = 0.85;

/** Reference draft shape for anchor knots (12 × 4 = 48). */
export const BASELINE_TOTAL_PICKS = 48;

/**
 * Anchor picks for a 12-team, 4-round draft — piecewise-linear interpolation between knots.
 * Aligned with trade calculator pick anchors (early 1st ~4.8k; pick 1 ~5k).
 */
export const BASELINE_SLOT_ANCHORS: ReadonlyArray<{ pick: number; points: number }> = [
  { pick: 1, points: 5000 },
  { pick: 2, points: 4800 },
  { pick: 6, points: 3800 },
  { pick: 12, points: 3000 },
  { pick: 16, points: 2200 },
  { pick: 24, points: 1900 },
  { pick: 30, points: 1600 },
  { pick: 36, points: 1300 },
  { pick: 40, points: 1100 },
  { pick: 48, points: 800 },
] as const;

export type DraftSlotCurveInput = {
  leagueSize: number;
  totalRounds: number;
};

export type SlotCurveRow = {
  pick_no: number;
  round: number;
  slot_points: number;
};

export function slotInRoundFromPickNo(pickNo: number, leagueSize: number): number {
  const teams = Math.max(1, leagueSize);
  return ((Math.max(1, pickNo) - 1) % teams) + 1;
}

export function roundFromPickNo(pickNo: number, leagueSize: number): number {
  const teams = Math.max(1, leagueSize);
  return Math.ceil(Math.max(1, pickNo) / teams);
}

export function resolvePickRound(pickNo: number, round: number | undefined, leagueSize: number): number {
  if (typeof round === "number" && round >= 1) return round;
  return roundFromPickNo(pickNo, leagueSize);
}

/** Map draft pick_no to a position on the 1..48 baseline curve. */
export function baselinePickForSlot(pickNo: number, leagueSize: number, totalRounds: number): number {
  const teams = Math.max(1, leagueSize);
  const rounds = Math.max(1, totalRounds);
  const totalPicks = teams * rounds;
  const slot = Math.max(1, Math.min(pickNo, totalPicks));
  if (totalPicks <= 1) return 1;
  return 1 + ((slot - 1) * (BASELINE_TOTAL_PICKS - 1)) / (totalPicks - 1);
}

/** Piecewise-linear interpolation on baseline anchor picks (fractional pick numbers allowed). */
export function interpolateBaselineSlotPoints(baselinePick: number): number {
  const anchors = BASELINE_SLOT_ANCHORS;
  const p = Math.max(anchors[0]!.pick, Math.min(anchors[anchors.length - 1]!.pick, baselinePick));

  if (p <= anchors[0]!.pick) return anchors[0]!.points;
  if (p >= anchors[anchors.length - 1]!.pick) return anchors[anchors.length - 1]!.points;

  for (let i = 0; i < anchors.length - 1; i++) {
    const a0 = anchors[i]!;
    const a1 = anchors[i + 1]!;
    if (p >= a0.pick && p <= a1.pick) {
      const t = (p - a0.pick) / (a1.pick - a0.pick);
      return Math.round(a0.points + (a1.points - a0.points) * t);
    }
  }

  return anchors[anchors.length - 1]!.points;
}

export function buildDraftSlotCurve(input: DraftSlotCurveInput): Map<number, number> {
  const teams = Math.max(1, input.leagueSize);
  const totalRounds = Math.max(1, input.totalRounds);
  const totalPicks = teams * totalRounds;
  const map = new Map<number, number>();

  for (let pickNo = 1; pickNo <= totalPicks; pickNo++) {
    const baseline = baselinePickForSlot(pickNo, teams, totalRounds);
    map.set(pickNo, interpolateBaselineSlotPoints(baseline));
  }
  return map;
}

export function expectedSlotPoints(
  pickNo: number,
  _round: number | undefined,
  leagueSize: number,
  totalRounds: number,
): number {
  const teams = Math.max(1, leagueSize);
  const rounds = Math.max(1, totalRounds);
  const curve = buildDraftSlotCurve({ leagueSize: teams, totalRounds: rounds });
  return curve.get(Math.max(1, pickNo)) ?? interpolateBaselineSlotPoints(baselinePickForSlot(pickNo, teams, rounds));
}

export function gradeVsSlotRatio(currentValue: number, expectedSlot: number): number {
  const slot = Math.max(MIN_SLOT_FLOOR, expectedSlot);
  return currentValue / slot;
}

export function vsSlotExcess(vsSlotRatio: number): number {
  return vsSlotRatio - 1;
}

/** Sum of slot points for a given round (1-based). */
export function roundSlotTotal(round: number, leagueSize: number, totalRounds: number): number {
  const teams = Math.max(1, leagueSize);
  const curve = buildDraftSlotCurve({ leagueSize: teams, totalRounds });
  let sum = 0;
  for (const [pickNo, pts] of curve) {
    if (roundFromPickNo(pickNo, teams) === round) sum += pts;
  }
  return sum;
}

/** Full pick table for a draft shape (e.g. example 12×4 output). */
export function getExampleSlotCurveTable(leagueSize: number, totalRounds: number): SlotCurveRow[] {
  const teams = Math.max(1, leagueSize);
  const curve = buildDraftSlotCurve({ leagueSize: teams, totalRounds });
  return [...curve.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pick_no, slot_points]) => ({
      pick_no,
      round: roundFromPickNo(pick_no, teams),
      slot_points,
    }));
}

/** Total slot capital across all picks in the curve. */
export function draftSlotCurveTotal(leagueSize: number, totalRounds: number): number {
  const curve = buildDraftSlotCurve({ leagueSize, totalRounds });
  return [...curve.values()].reduce((a, b) => a + b, 0);
}
