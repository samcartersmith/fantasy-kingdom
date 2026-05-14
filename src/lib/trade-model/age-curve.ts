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
  /** Dynasty “years left before decline cliff” framing: QB ~34, WR/TE ~30, RB ~28. */
  const peak = pos === "QB" ? 30 : pos === "RB" ? 24 : 26;
  const width = pos === "QB" ? 6.8 : pos === "RB" ? 3.8 : 5.2;
  const z = (peak - ageYears) / width;
  const sigmoid = 1 / (1 + Math.exp(-z));
  return { tier01: clamp01(sigmoid), missing: false };
}

/**
 * 0–1 scale for “high-level seasons remaining” before a position-specific decline cliff
 * (RB 28, WR/TE 30, QB 34). Used to weight retrospective VBD toward dynasty without a second age model.
 */
export function peakYearsRemaining01(
  ageYears: number | null,
  positionLabel: string,
): { years01: number; missing: boolean } {
  if (ageYears == null || !Number.isFinite(ageYears)) {
    return { years01: 0.5, missing: true };
  }
  const pos = primarySkillForCurve(positionLabel);
  const cliff = pos === "QB" ? 34 : pos === "RB" ? 28 : 30;
  const span = pos === "QB" ? 14 : pos === "RB" ? 10 : 12;
  const raw = Math.max(0, cliff - ageYears);
  return { years01: clamp01(Math.min(1, raw / span)), missing: false };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
