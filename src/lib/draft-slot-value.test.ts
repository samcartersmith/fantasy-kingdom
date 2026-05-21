import { describe, expect, it } from "vitest";
import {
  BASELINE_SLOT_ANCHORS,
  buildDraftSlotCurve,
  draftSlotCurveTotal,
  expectedSlotPoints,
  getExampleSlotCurveTable,
  gradeVsSlotRatio,
  interpolateBaselineSlotPoints,
  roundFromPickNo,
  roundSlotTotal,
} from "@/lib/draft-slot-value";

function expectNear(actual: number, target: number, tolerance = 15): void {
  expect(actual).toBeGreaterThanOrEqual(target - tolerance);
  expect(actual).toBeLessThanOrEqual(target + tolerance);
}

describe("interpolateBaselineSlotPoints", () => {
  it("hits anchor knots exactly", () => {
    for (const { pick, points } of BASELINE_SLOT_ANCHORS) {
      expect(interpolateBaselineSlotPoints(pick)).toBe(points);
    }
  });

  it("interpolates between pick 2 and pick 6", () => {
    expect(interpolateBaselineSlotPoints(3)).toBe(4550);
    expect(interpolateBaselineSlotPoints(4)).toBe(4300);
  });
});

describe("buildDraftSlotCurve 12x4", () => {
  const curve = buildDraftSlotCurve({ leagueSize: 12, totalRounds: 4 });

  it("has 48 picks", () => {
    expect(curve.size).toBe(48);
  });

  it("matches anchor targets at key picks", () => {
    expectNear(curve.get(1)!, 5000);
    expectNear(curve.get(2)!, 4800);
    expectNear(curve.get(6)!, 3800);
    expectNear(curve.get(12)!, 3000);
    expectNear(curve.get(16)!, 2200);
    expectNear(curve.get(24)!, 1900);
    expectNear(curve.get(30)!, 1600);
    expectNear(curve.get(36)!, 1300);
    expectNear(curve.get(40)!, 1100);
    expectNear(curve.get(48)!, 800);
  });

  it("is strictly decreasing by pick number", () => {
    for (let p = 2; p <= 48; p++) {
      expect(curve.get(p)!).toBeLessThan(curve.get(p - 1)!);
    }
  });

  it("allocates more than half of capital to rounds 1-2", () => {
    const total = draftSlotCurveTotal(12, 4);
    const r1 = roundSlotTotal(1, 12, 4);
    const r2 = roundSlotTotal(2, 12, 4);
    expect((r1 + r2) / total).toBeGreaterThan(0.5);
  });

  it("allocates 10-15% of capital to round 4", () => {
    const total = draftSlotCurveTotal(12, 4);
    const r4 = roundSlotTotal(4, 12, 4);
    expect(r4 / total).toBeGreaterThanOrEqual(0.1);
    expect(r4 / total).toBeLessThanOrEqual(0.15);
  });

  it("keeps pick 1 above first pick of round 2", () => {
    expect(curve.get(1)!).toBeGreaterThan(curve.get(13)!);
  });

  it("returns identical values for same slot across calls", () => {
    expect(expectedSlotPoints(1, 1, 12, 4)).toBe(expectedSlotPoints(1, 1, 12, 4));
    expect(expectedSlotPoints(13, 2, 12, 4)).toBe(expectedSlotPoints(13, 2, 12, 4));
  });
});

describe("buildDraftSlotCurve 10x5", () => {
  it("is monotonic and favors early picks", () => {
    const curve = buildDraftSlotCurve({ leagueSize: 10, totalRounds: 5 });
    expect(curve.size).toBe(50);
    for (let p = 2; p <= 50; p++) {
      expect(curve.get(p)!).toBeLessThan(curve.get(p - 1)!);
    }
    expect(curve.get(1)!).toBeGreaterThan(curve.get(50)!);
  });
});

describe("getExampleSlotCurveTable", () => {
  it("returns sorted rows with round numbers", () => {
    const rows = getExampleSlotCurveTable(12, 4);
    expect(rows).toHaveLength(48);
    expect(rows[0]?.pick_no).toBe(1);
    expect(rows[0]?.slot_points).toBe(5000);
    expect(rows[47]?.pick_no).toBe(48);
    expect(rows[11]?.round).toBe(1);
    expect(rows[12]?.round).toBe(2);
  });
});

describe("gradeVsSlotRatio", () => {
  it("uses floor on tiny slot values", () => {
    expect(gradeVsSlotRatio(100, 5)).toBe(4);
    expect(gradeVsSlotRatio(5000, 5000)).toBe(1);
  });
});

describe("roundFromPickNo", () => {
  it("maps pick numbers to rounds in a 12-team draft", () => {
    expect(roundFromPickNo(1, 12)).toBe(1);
    expect(roundFromPickNo(12, 12)).toBe(1);
    expect(roundFromPickNo(13, 12)).toBe(2);
  });
});
