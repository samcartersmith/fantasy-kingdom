import { describe, expect, it } from "vitest";
import { attenuateParticipation01TowardNeutral } from "@/lib/trade-model/fp-baseline";
import {
  LOW_HISTORY_RB_MAX_YEARS_EXP,
  imputedRbRankBaseFromPrior01,
  imputedRbVbd01FromPrior01,
  qualifiesLowHistoryRbTradeRescue,
  rbProspectPrior01,
} from "@/lib/trade-model/low-history-rb";
import { RANK_BASE_MIN, RANK_BASE_SPAN } from "@/lib/trade-model/trade-spine";

describe("qualifiesLowHistoryRbTradeRescue", () => {
  it("accepts RB with years_exp 0–1 and rejects null or higher", () => {
    expect(qualifiesLowHistoryRbTradeRescue("RB", 0)).toBe(true);
    expect(qualifiesLowHistoryRbTradeRescue("RB", 1)).toBe(true);
    expect(qualifiesLowHistoryRbTradeRescue("RB", LOW_HISTORY_RB_MAX_YEARS_EXP)).toBe(true);
    expect(qualifiesLowHistoryRbTradeRescue("RB", null)).toBe(false);
    expect(qualifiesLowHistoryRbTradeRescue("RB", 2)).toBe(false);
    expect(qualifiesLowHistoryRbTradeRescue("WR", 0)).toBe(false);
    expect(qualifiesLowHistoryRbTradeRescue("RB,WR", 0)).toBe(true);
  });
});

describe("rbProspectPrior01", () => {
  it("rises with better draft and role tiers", () => {
    const low = rbProspectPrior01({
      draftTier01: 0.5,
      draftMissing: false,
      roleTier01: 0.5,
      roleMissing: false,
      historyTier01: 0.5,
      historyMissing: false,
    });
    const high = rbProspectPrior01({
      draftTier01: 0.92,
      draftMissing: false,
      roleTier01: 0.88,
      roleMissing: false,
      historyTier01: 0.72,
      historyMissing: false,
    });
    expect(high).toBeGreaterThan(low);
  });
});

describe("imputedRbRankBaseFromPrior01", () => {
  it("maps prior into rank base band within RB span", () => {
    const lo = imputedRbRankBaseFromPrior01(0);
    const hi = imputedRbRankBaseFromPrior01(1);
    expect(lo).toBeGreaterThanOrEqual(RANK_BASE_MIN);
    expect(hi).toBeLessThanOrEqual(RANK_BASE_MIN + RANK_BASE_SPAN + 5);
    expect(hi).toBeGreaterThan(lo);
  });
});

describe("imputedRbVbd01FromPrior01", () => {
  it("stays in 0–1 and increases with prior", () => {
    expect(imputedRbVbd01FromPrior01(0)).toBeGreaterThanOrEqual(0);
    expect(imputedRbVbd01FromPrior01(1)).toBeLessThanOrEqual(1);
    expect(imputedRbVbd01FromPrior01(0.8)).toBeGreaterThan(imputedRbVbd01FromPrior01(0.3));
  });
});

describe("attenuateParticipation01TowardNeutral", () => {
  it("pulls participation toward 0.5 for low-history games blend", () => {
    const raw = 10 / 17;
    const softened = attenuateParticipation01TowardNeutral(raw, 0.35);
    expect(Math.abs(softened - 0.5)).toBeLessThan(Math.abs(raw - 0.5));
  });
});
