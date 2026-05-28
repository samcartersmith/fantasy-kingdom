import { describe, expect, it } from "vitest";
import {
  optimizeProjectedLineupScore,
  parseStartingSlots,
  pragmaticProjectedLineupScore,
} from "@/lib/season-predictions/lineup-optimizer";

describe("pragmatic vs optimal projected scores", () => {
  const slots = parseStartingSlots(["QB", "RB", "RB", "WR", "TE", "FLEX"]);
  const rosterPositions = ["QB", "RB", "RB", "WR", "TE", "FLEX"];
  const pool = ["qb", "rb1", "rb2", "wr1", "wr2", "te1", "flex1"];
  const lookup = new Map<string, ("QB" | "RB" | "WR" | "TE")[]>([
    ["qb", ["QB"]],
    ["rb1", ["RB"]],
    ["rb2", ["RB"]],
    ["wr1", ["WR"]],
    ["wr2", ["WR"]],
    ["te1", ["TE"]],
    ["flex1", ["RB", "WR"]],
  ]);

  it("optimal is never below pragmatic on the same projection map", () => {
    const projections = new Map([
      ["qb", 22],
      ["rb1", 16],
      ["rb2", 14],
      ["wr1", 15],
      ["wr2", 11],
      ["te1", 9],
      ["flex1", 13],
    ]);
    const starters = ["qb", "rb2", "wr1", "wr2", "te1", "rb1"];

    const pragmatic = pragmaticProjectedLineupScore(
      rosterPositions,
      starters,
      pool,
      projections,
      lookup,
    );
    const optimal = optimizeProjectedLineupScore(
      pool,
      projections,
      slots,
      lookup,
    );

    expect(optimal).toBeGreaterThanOrEqual(pragmatic);
  });
});
