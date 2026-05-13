import type { SkillPosition } from "@/lib/sleeper-ranking";

const NEUTRAL = 0.5;

/** Best-effort age from Sleeper fields. */
export function resolvePlayerAgeYears(rawAge: number | null | undefined, yearsExp: number | null | undefined): number | null {
  if (typeof rawAge === "number" && Number.isFinite(rawAge) && rawAge > 17 && rawAge < 55) {
    return rawAge;
  }
  if (typeof yearsExp === "number" && Number.isFinite(yearsExp) && yearsExp >= 0 && yearsExp <= 30) {
    return 22 + yearsExp;
  }
  return null;
}

function primarySkillForCurve(positionLabel: string): SkillPosition | null {
  const parts = positionLabel.split(",").map((p) => p.trim().toUpperCase());
  const order: SkillPosition[] = ["QB", "RB", "WR", "TE"];
  for (const pos of order) {
    if (parts.includes(pos)) return pos;
  }
  return null;
}

/**
 * Returns a 0–1 “youth / prime / decline” score where 0.5 is neutral (unknown age uses neutral).
 * Higher = more valuable dynasty moment (prime / ascending).
 */
export function ageCurve01(ageYears: number | null, positionLabel: string): { tier01: number; missing: boolean } {
  if (ageYears == null || !Number.isFinite(ageYears)) {
    return { tier01: NEUTRAL, missing: true };
  }
  const pos = primarySkillForCurve(positionLabel);
  if (pos == null) {
    const z = (26.5 - ageYears) / 6;
    return { tier01: clamp01(1 / (1 + Math.exp(-z))), missing: false };
  }
  const peak = pos === "QB" ? 29 : pos === "RB" ? 24.5 : 26.5;
  const width = pos === "QB" ? 7 : pos === "RB" ? 4.5 : 6;
  const z = (peak - ageYears) / width;
  const sigmoid = 1 / (1 + Math.exp(-z));
  return { tier01: clamp01(sigmoid), missing: false };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
