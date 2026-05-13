import type { EvaluationComponent, PickScoreInput, ScoreResult, TradeModelProviders } from "@/lib/trade-model/types";
import { MODEL_WEIGHTS } from "@/lib/trade-model/weights";

const NEUTRAL = 0.5;
const VALUE_MIN = 400;
const VALUE_MAX = 19_000;

function clampValue(n: number): number {
  return Math.round(Math.max(VALUE_MIN, Math.min(VALUE_MAX, n)));
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Draft capital model: start from catalog anchor, adjust for class strength and calendar distance.
 */
export function scorePick(input: PickScoreInput, providers: TradeModelProviders): ScoreResult {
  const components: EvaluationComponent[] = [];

  const anchor = input.anchorValue;
  components.push({ key: "anchor", label: "Catalog anchor (round / slot)", contribution: anchor });

  const cls = providers.draftClass.getClassStrength01(input.year);
  const classAdj = (cls.tier01 - NEUTRAL) * MODEL_WEIGHTS.pickClassPoints;
  components.push({
    key: "draftClass",
    label: `Draft class strength (${input.year})`,
    contribution: classAdj,
    missing: cls.missing,
  });

  const currentYear = new Date().getUTCFullYear();
  const yearsOut = Math.max(0, input.year - currentYear);
  const futureDisc = -yearsOut * MODEL_WEIGHTS.pickFutureDiscountPerYear;
  components.push({
    key: "futureDiscount",
    label: "Future pick discount (years out)",
    contribution: futureDisc,
  });

  const bucketNudge =
    input.bucket === "early" ? 120 : input.bucket === "mid" ? 0 : -80;
  components.push({
    key: "slotBucket",
    label: "Early / mid / late slot nudge",
    contribution: bucketNudge,
  });

  const roundDisc = input.round > 1 ? -(input.round - 1) * 140 : 0;
  components.push({
    key: "round",
    label: "Round depth adjustment",
    contribution: roundDisc,
  });

  const raw = components.reduce((a, c) => a + c.contribution, 0);
  const value = clampValue(raw);

  const missingCount = components.filter((c) => c.missing).length;
  const confidence01 = clamp01(1 - missingCount * 0.15);

  return { value, confidence01, components };
}
