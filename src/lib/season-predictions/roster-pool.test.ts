import { describe, expect, it } from "vitest";
import {
  activeLineupPlayerIds,
  collectActiveLineupPlayerIds,
} from "@/lib/season-predictions/roster-pool";
import type { SleeperRoster } from "@/lib/sleeper-league-types";

describe("activeLineupPlayerIds", () => {
  const roster: SleeperRoster = {
    roster_id: 1,
    owner_id: "u1",
    players: ["qb", "rb", "taxi1", "ir1"],
    starters: ["qb", "rb"],
    taxi: ["taxi1"],
    reserve: ["ir1"],
  };

  it("excludes taxi and reserve players", () => {
    expect(activeLineupPlayerIds(roster).sort()).toEqual(["qb", "rb"]);
  });

  it("collects unique ids across rosters", () => {
    const r2: SleeperRoster = {
      roster_id: 2,
      owner_id: "u2",
      players: ["wr1"],
      starters: ["wr1"],
      taxi: null,
      reserve: null,
    };
    const all = collectActiveLineupPlayerIds([roster, r2]);
    expect(all.has("qb")).toBe(true);
    expect(all.has("taxi1")).toBe(false);
    expect(all.has("wr1")).toBe(true);
  });
});
