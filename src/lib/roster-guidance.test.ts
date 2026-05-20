import { describe, expect, it } from "vitest";
import type { CatalogAsset } from "@/lib/trade-types";
import {
  buildRosterGuidance,
  buildRosterPlayerRows,
  rankRosterValues,
} from "@/lib/roster-guidance";
import type { SleeperRoster } from "@/lib/sleeper-league-types";

function player(id: string, value: number, position: string, age?: number): CatalogAsset {
  return {
    id,
    kind: "player",
    name: `Player ${id}`,
    position,
    team: "TST",
    value,
    sleeperPlayerId: id,
    age: age ?? 25,
  };
}

describe("roster-guidance", () => {
  const catalog = new Map<string, CatalogAsset>([
    ["1", player("1", 8000, "RB", 31)],
    ["2", player("2", 7500, "WR")],
    ["3", player("3", 7200, "WR")],
    ["4", player("4", 5000, "RB")],
    ["5", player("5", 9000, "QB")],
  ]);

  const roster: SleeperRoster = {
    roster_id: 1,
    owner_id: "u1",
    players: ["1", "2", "3", "4", "5"],
    starters: ["5", "1", "2", "3"],
    reserve: [],
    taxi: null,
  };

  const roster2: SleeperRoster = {
    roster_id: 2,
    owner_id: "u2",
    players: ["5"],
    starters: ["5"],
    reserve: [],
    taxi: null,
  };

  it("builds sorted player rows", () => {
    const rows = buildRosterPlayerRows(roster, catalog);
    expect(rows[0]?.sleeperPlayerId).toBe("5");
    expect(rows[0]?.slot).toBe("starter");
    expect(rows.find((r) => r.sleeperPlayerId === "4")?.slot).toBe("bench");
  });

  it("ranks roster totals", () => {
    const rank = rankRosterValues([roster, roster2], catalog, 1);
    expect(rank.rank).toBe(1);
    expect(rank.total).toBe(2);
  });

  it("returns guidance insights", () => {
    const rows = buildRosterPlayerRows(roster, catalog);
    const insights = buildRosterGuidance(rows, { rank: 1, total: 12 }, "12-team · PPR · 1QB", {
      qb: 1,
      rb: 2,
      wr: 2,
      te: 1,
    });
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.some((i) => i.id === "value-rank")).toBe(true);
  });
});
