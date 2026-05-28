import { describe, expect, it } from "vitest";
import { buildMatchupAdvice, winProbabilityFromProjections } from "@/lib/matchup-advice/advice-engine";
import type { LineupAssignment } from "@/lib/season-predictions/lineup-optimizer";

describe("winProbabilityFromProjections", () => {
  it("returns share of projected totals", () => {
    expect(winProbabilityFromProjections(110, 90)).toBeCloseTo(55, 1);
  });

  it("returns null when both zero", () => {
    expect(winProbabilityFromProjections(0, 0)).toBeNull();
  });
});

describe("buildMatchupAdvice", () => {
  const projections = new Map([
    ["a", 12],
    ["b", 18],
    ["c", 8],
  ]);

  const playerLookup = {
    name: (id: string) => id.toUpperCase(),
    injuryBadge: () => null,
    isUnavailable: () => false,
  };

  it("suggests starting higher projected player", () => {
    const current: LineupAssignment[] = [{ slot: { kind: "RB" }, playerId: "a" }];
    const optimal: LineupAssignment[] = [{ slot: { kind: "RB" }, playerId: "b" }];
    const advice = buildMatchupAdvice({
      yourRosterId: 1,
      yourProjectedTotal: 12,
      opponentProjectedTotal: 10,
      currentAssignments: current,
      optimalAssignments: optimal,
      projections,
      playerLookup,
    });
    expect(advice.some((a) => a.id.startsWith("swap-"))).toBe(true);
    expect(advice.some((a) => a.title.includes("B"))).toBe(true);
  });

  it("flags zero projection starters", () => {
    const zeroProjections = new Map([["c", 0]]);
    const current: LineupAssignment[] = [{ slot: { kind: "WR" }, playerId: "c" }];
    const optimal: LineupAssignment[] = [{ slot: { kind: "WR" }, playerId: "c" }];
    const advice = buildMatchupAdvice({
      yourRosterId: 1,
      yourProjectedTotal: 0,
      opponentProjectedTotal: null,
      currentAssignments: current,
      optimalAssignments: optimal,
      projections: zeroProjections,
      playerLookup,
    });
    expect(advice.some((a) => a.id.startsWith("bye-"))).toBe(true);
  });
});
