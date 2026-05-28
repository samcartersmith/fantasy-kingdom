import { describe, expect, it } from "vitest";
import {
  optimizeProjectedLineupScore,
  parseStartingSlots,
  playerEligibleForSlot,
  type LineupPlayer,
} from "@/lib/season-predictions/lineup-optimizer";

const slots1qb2rb2wr1te1flex = parseStartingSlots([
  "QB",
  "RB",
  "RB",
  "WR",
  "WR",
  "TE",
  "FLEX",
  "BN",
]);

describe("parseStartingSlots", () => {
  it("excludes bench IR and taxi", () => {
    expect(
      parseStartingSlots(["QB", "RB", "BN", "IR", "TAXI", "FLEX"]),
    ).toEqual([{ kind: "QB" }, { kind: "RB" }, { kind: "FLEX" }]);
  });

  it("maps superflex tokens", () => {
    expect(parseStartingSlots(["SUPER_FLEX"])).toEqual([{ kind: "SUPER_FLEX" }]);
    expect(parseStartingSlots(["QB_FLEX"])).toEqual([{ kind: "SUPER_FLEX" }]);
  });
});

describe("playerEligibleForSlot", () => {
  const rbWr: LineupPlayer = {
    playerId: "1",
    points: 10,
    positions: ["RB", "WR"],
    rawPosition: "RB",
  };

  it("allows RB/WR on FLEX but not on QB", () => {
    expect(playerEligibleForSlot(rbWr, { kind: "FLEX" })).toBe(true);
    expect(playerEligibleForSlot(rbWr, { kind: "QB" })).toBe(false);
  });

  it("allows QB on SUPER_FLEX only among skill positions", () => {
    const qb: LineupPlayer = {
      playerId: "q",
      points: 20,
      positions: ["QB"],
      rawPosition: "QB",
    };
    expect(playerEligibleForSlot(qb, { kind: "SUPER_FLEX" })).toBe(true);
    expect(playerEligibleForSlot(qb, { kind: "FLEX" })).toBe(false);
  });
});

describe("optimizeProjectedLineupScore", () => {
  const lookup = new Map<string, ("QB" | "RB" | "WR" | "TE")[]>([
    ["qb", ["QB"]],
    ["rb1", ["RB"]],
    ["rb2", ["RB"]],
    ["rb3", ["RB"]],
    ["wr1", ["WR"]],
    ["wr2", ["WR"]],
    ["te", ["TE"]],
  ]);

  it("fills standard slots with highest eligible players", () => {
    const projections = new Map([
      ["qb", 22],
      ["rb1", 18],
      ["rb2", 16],
      ["rb3", 14],
      ["wr1", 15],
      ["wr2", 13],
      ["te", 12],
    ]);
    const score = optimizeProjectedLineupScore(
      ["qb", "rb1", "rb2", "rb3", "wr1", "wr2", "te"],
      projections,
      slots1qb2rb2wr1te1flex,
      lookup,
    );
    // QB + top 2 RB + top 2 WR + TE + best FLEX (rb3=14)
    expect(score).toBe(22 + 18 + 16 + 15 + 13 + 12 + 14);
  });

  it("beats summing listed starters when bench is stronger", () => {
    const projections = new Map([
      ["weak1", 5],
      ["weak2", 6],
      ["star", 25],
      ["wr1", 14],
      ["wr2", 12],
      ["te", 10],
      ["qb", 20],
    ]);
    const positions = new Map<string, ("QB" | "RB" | "WR" | "TE")[]>([
      ["weak1", ["RB"]],
      ["weak2", ["RB"]],
      ["star", ["RB"]],
      ["wr1", ["WR"]],
      ["wr2", ["WR"]],
      ["te", ["TE"]],
      ["qb", ["QB"]],
    ]);
    const starterSum = 5 + 6 + 14 + 12 + 10 + 20; // listed weak RBs + others
    const optimal = optimizeProjectedLineupScore(
      ["weak1", "weak2", "star", "wr1", "wr2", "te", "qb"],
      projections,
      parseStartingSlots(["QB", "RB", "RB", "WR", "WR", "TE", "FLEX"]),
      positions,
    );
    expect(optimal).toBeGreaterThan(starterSum);
    expect(optimal).toBe(20 + 25 + 6 + 14 + 12 + 10 + 5); // star at RB, weak2 at RB2, weak1 FLEX
  });

  it("uses second QB in superflex when worth more than flex alternative", () => {
    const projections = new Map([
      ["qb1", 24],
      ["qb2", 20],
      ["rb", 12],
      ["wr", 11],
      ["te", 9],
    ]);
    const positions = new Map<string, ("QB" | "RB" | "WR" | "TE")[]>([
      ["qb1", ["QB"]],
      ["qb2", ["QB"]],
      ["rb", ["RB"]],
      ["wr", ["WR"]],
      ["te", ["TE"]],
    ]);
    const score = optimizeProjectedLineupScore(
      ["qb1", "qb2", "rb", "wr", "te"],
      projections,
      parseStartingSlots(["QB", "SUPER_FLEX", "RB", "WR", "TE"]),
      positions,
    );
    expect(score).toBe(24 + 20 + 12 + 11 + 9);
  });

  it("slots team defense ids when rawPosition is DEF", () => {
    const projections = new Map([
      ["qb", 18],
      ["rb", 12],
      ["wr", 14],
      ["SF", 6],
    ]);
    const lookup = new Map<string, ("QB" | "RB" | "WR" | "TE")[]>([
      ["qb", ["QB"]],
      ["rb", ["RB"]],
      ["wr", ["WR"]],
    ]);
    const raw = new Map<string, string | null>([["SF", "DEF"]]);
    const score = optimizeProjectedLineupScore(
      ["qb", "rb", "wr", "SF"],
      projections,
      parseStartingSlots(["QB", "RB", "WR", "DEF"]),
      lookup,
      raw,
    );
    expect(score).toBe(18 + 12 + 14 + 6);
  });

  it("ignores zero-projection players in optimal lineup", () => {
    const projections = new Map([
      ["qb0", 0],
      ["qb1", 18],
      ["rb", 12],
      ["wr", 11],
      ["te", 9],
    ]);
    const positions = new Map<string, ("QB" | "RB" | "WR" | "TE")[]>([
      ["qb0", ["QB"]],
      ["qb1", ["QB"]],
      ["rb", ["RB"]],
      ["wr", ["WR"]],
      ["te", ["TE"]],
    ]);
    const score = optimizeProjectedLineupScore(
      ["qb0", "qb1", "rb", "wr", "te"],
      projections,
      parseStartingSlots(["QB", "SUPER_FLEX", "RB", "WR", "TE"]),
      positions,
    );
    expect(score).toBe(18 + 12 + 11 + 9);
  });

  it("returns 0 when no starting slots", () => {
    expect(optimizeProjectedLineupScore(["a"], new Map([["a", 10]]), [], new Map())).toBe(
      0,
    );
  });
});
