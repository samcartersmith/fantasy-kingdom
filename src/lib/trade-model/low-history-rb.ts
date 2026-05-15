import { primarySkillFromLabel } from "@/lib/trade-model/fp-baseline";
import { RANK_BASE_MIN, RANK_BASE_SPAN } from "@/lib/trade-model/trade-spine";

const NEUTRAL = 0.5;

/**
 * Inclusive cap on Sleeper `years_exp` for RB low-history trade rescue.
 * 0 = NFL rookie, 1 = second NFL season. `years_exp` null/unknown opts out (no rescue).
 */
export const LOW_HISTORY_RB_MAX_YEARS_EXP = 1;

/**
 * Pull games-played participation toward 0.5 for Y0/Y1 RBs so partial rookie seasons
 * are not scored like veteran durability gaps.
 */
export const LOW_HISTORY_RB_GAMES_TO_NEUTRAL_BLEND = 0.35;

export function qualifiesLowHistoryRbTradeRescue(positionLabel: string, yearsExp: number | null): boolean {
  if (primarySkillFromLabel(positionLabel) !== "RB") return false;
  if (yearsExp == null || !Number.isFinite(yearsExp)) return false;
  return yearsExp >= 0 && yearsExp <= LOW_HISTORY_RB_MAX_YEARS_EXP;
}

/**
 * Dynasty-style prior in ~0–1 from draft capital, curated role, and optional history tier.
 * Missing signals contribute neutral 0.5 so UDFA / unknown draft still get a middle prior.
 */
export function rbProspectPrior01(inputs: {
  draftTier01: number;
  draftMissing: boolean;
  roleTier01: number;
  roleMissing: boolean;
  historyTier01: number;
  historyMissing: boolean;
}): number {
  const d = inputs.draftMissing ? NEUTRAL : inputs.draftTier01;
  const r = inputs.roleMissing ? NEUTRAL : inputs.roleTier01;
  const h = inputs.historyMissing ? NEUTRAL : inputs.historyTier01;
  const v = 0.44 * d + 0.42 * r + 0.14 * h;
  return Math.max(0, Math.min(1, v));
}

/** Imputed RB rank base before VBD × dyn (uses full RB span, not TE). */
export function imputedRbRankBaseFromPrior01(prior01: number): number {
  const p = Math.max(0, Math.min(1, prior01));
  const curve01 = 0.4 + 0.38 * p;
  return Math.round(RANK_BASE_MIN + RANK_BASE_SPAN * curve01);
}

/** Imputed within-position VBD norm for low-history RB rescue. */
export function imputedRbVbd01FromPrior01(prior01: number): number {
  const p = Math.max(0, Math.min(1, prior01));
  return Math.max(0, Math.min(1, 0.36 + 0.54 * p));
}
