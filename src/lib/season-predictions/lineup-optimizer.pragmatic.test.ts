import { describe, expect, it } from "vitest";
import {
  pragmaticProjectedLineupScore,
  WEAK_STARTER_THRESHOLD,
  zipSlotAlignedStarters,
} from "@/lib/season-predictions/lineup-optimizer";

describe("zipSlotAlignedStarters", () => {
  it("preserves empty slots and skips bench positions", () => {
    const aligned = zipSlotAlignedStarters(
      ["QB", "RB", "BN", "WR"],
      ["qb1", null, "bench", "wr1"],
    );
    expect(aligned).toEqual([
      { slot: { kind: "QB" }, playerId: "qb1" },
      { slot: { kind: "RB" }, playerId: null },
      { slot: { kind: "WR" }, playerId: "wr1" },
    ]);
  });
});

describe("pragmaticProjectedLineupScore", () => {
  const lookup = new Map<string, ("QB" | "RB" | "WR" | "TE")[]>([
    ["qb", ["QB"]],
    ["rb1", ["RB"]],
    ["rb2", ["RB"]],
    ["wr1", ["WR"]],
    ["te", ["TE"]],
  ]);

  it("fills an empty RB slot from the bench", () => {
    const projections = new Map([
      ["qb", 20],
      ["rb2", 14],
      ["wr1", 12],
      ["te", 8],
    ]);
    const score = pragmaticProjectedLineupScore(
      ["QB", "RB", "WR", "TE"],
      ["qb", null, "wr1", "te"],
      ["qb", "rb2", "wr1", "te"],
      projections,
      lookup,
    );
    expect(score).toBe(20 + 14 + 12 + 8);
  });

  it("treats zero-projection starters as empty before filling", () => {
    const projections = new Map([
      ["dead_qb", 0],
      ["dead_sflex", 0],
      ["rb1", 12],
      ["rb2", 9],
      ["wr", 10],
      ["te", 8],
    ]);
    const lookup = new Map<string, ("QB" | "RB" | "WR" | "TE")[]>([
      ["dead_qb", ["QB"]],
      ["dead_sflex", ["QB", "RB", "WR", "TE"]],
      ["rb1", ["RB"]],
      ["rb2", ["RB"]],
      ["wr", ["WR"]],
      ["te", ["TE"]],
    ]);
    const score = pragmaticProjectedLineupScore(
      ["QB", "SUPER_FLEX", "RB", "WR", "TE"],
      ["dead_qb", "dead_sflex", "rb1", "wr", "te"],
      ["dead_qb", "dead_sflex", "rb1", "rb2", "wr", "te"],
      projections,
      lookup,
    );
    // Cleared 0-pt superflex → rb2 (9); RB stays rb1 (12); QB fill may still be 0
    expect(score).toBe(0 + 9 + 12 + 10 + 8);
  });

  it("upgrades a starter below the weak threshold", () => {
    const projections = new Map([
      ["weak", 4],
      ["star", 16],
      ["wr1", 11],
      ["te", 9],
      ["qb", 22],
    ]);
    const positions = new Map<string, ("QB" | "RB" | "WR" | "TE")[]>([
      ["weak", ["RB"]],
      ["star", ["RB"]],
      ["wr1", ["WR"]],
      ["te", ["TE"]],
      ["qb", ["QB"]],
    ]);
    const starterSum = 4 + 11 + 9 + 22;
    const score = pragmaticProjectedLineupScore(
      ["QB", "RB", "WR", "TE"],
      ["qb", "weak", "wr1", "te"],
      ["qb", "weak", "star", "wr1", "te"],
      projections,
      positions,
    );
    expect(score).toBeGreaterThan(starterSum);
    expect(score).toBe(22 + 16 + 11 + 9);
  });

  it("ignores illegal starter slot assignments and duplicate player ids", () => {
    const projections = new Map([
      ["wr1", 18],
      ["rb1", 12],
      ["rb2", 10],
    ]);
    const positions = new Map<string, ("QB" | "RB" | "WR")[]>([
      ["wr1", ["WR"]],
      ["rb1", ["RB"]],
      ["rb2", ["RB"]],
    ]);
    // WR listed in RB slot (illegal); rb1 duplicated in two RB slots
    const score = pragmaticProjectedLineupScore(
      ["RB", "RB", "WR"],
      ["wr1", "rb1", "rb1"],
      ["wr1", "rb1", "rb2"],
      projections,
      positions,
    );
    // Legal max: rb1 + rb2 + wr1 = 40 (not wr1 counted twice in RB slots)
    expect(score).toBe(40);
  });

  it("does not swap starters at or above the threshold", () => {
    const projections = new Map([
      ["rb", WEAK_STARTER_THRESHOLD],
      ["bench", 20],
      ["wr", 10],
      ["qb", 18],
    ]);
    const positions = new Map<string, ("QB" | "RB" | "WR" | "TE")[]>([
      ["rb", ["RB"]],
      ["bench", ["RB"]],
      ["wr", ["WR"]],
      ["qb", ["QB"]],
    ]);
    const score = pragmaticProjectedLineupScore(
      ["QB", "RB", "WR"],
      ["qb", "rb", "wr"],
      ["qb", "rb", "bench", "wr"],
      projections,
      positions,
    );
    expect(score).toBe(18 + WEAK_STARTER_THRESHOLD + 10);
  });
});
