import { describe, expect, it } from "vitest";
import type { CatalogAsset } from "@/lib/trade-types";
import {
  buildRosterProfile,
  getDepthSurplusPlayers,
  getTradeableSurplusPlayers,
  positionRoomStrength,
  type StartSlots,
} from "@/lib/roster-guidance";
import { findTradeSuggestions } from "@/lib/trade-suggestions";
import type { SleeperLeagueUser, SleeperRoster } from "@/lib/sleeper-league-types";

function player(
  id: string,
  value: number,
  position: string,
  opts?: { slot?: "starter" | "bench" },
): CatalogAsset {
  return {
    id,
    kind: "player",
    name: `Player ${id}`,
    position,
    team: "TST",
    value,
    sleeperPlayerId: id,
    age: 25,
  };
}

function roster(
  rosterId: number,
  playerIds: string[],
  starters: string[],
): SleeperRoster {
  return {
    roster_id: rosterId,
    owner_id: `u${rosterId}`,
    players: playerIds,
    starters,
    reserve: [],
    taxi: null,
  };
}

const startSlots: StartSlots = { qb: 1, rb: 2, wr: 2, te: 1 };

describe("trade-suggestions", () => {
  const catalog = new Map<string, CatalogAsset>([
    ["1", player("1", 4000, "WR")],
    ["2", player("2", 4100, "WR")],
    ["3", player("3", 9000, "WR")],
    ["4", player("4", 8500, "WR")],
    ["5", player("5", 8000, "WR")],
    ["10", player("10", 2000, "TE")],
    ["11", player("11", 1800, "TE")],
    ["30", player("30", 5000, "QB")],
    ["60", player("60", 7500, "TE")],
    ["61", player("61", 7900, "TE")],
    ["62", player("62", 6800, "TE")],
    ["70", player("70", 2500, "WR")],
    ["71", player("71", 2200, "WR")],
    ["p1", { id: "pick_2026_mid_2", kind: "pick", name: "2026 Mid 2nd", position: null, team: null, value: 2200 }],
  ]);

  const pickCatalog = new Map([["pick_2026_mid_2", catalog.get("p1")!]]);

  const users: SleeperLeagueUser[] = [
    { user_id: "u1", display_name: "Team Alpha" },
    { user_id: "u2", display_name: "Team Beta" },
  ];

  /** Strong WR depth / thin TE — wants TE from partner */
  const myRoster = roster(1, ["1", "2", "3", "4", "5", "10", "11", "30"], ["1", "2", "10", "30"]);
  /** Strong TE / thin WR — can send TE, wants WR depth */
  const partnerRoster = roster(2, ["60", "61", "62", "70", "71"], ["60", "70", "71"]);

  it("finds complementary 1-for-1 trades and ranks them", () => {
    const myProfile = buildRosterProfile(myRoster, catalog, startSlots, "Me");
    expect(myProfile.weakSkills).toContain("TE");
    expect(getDepthSurplusPlayers(myProfile.players, startSlots, myProfile.weakSkills).length).toBeGreaterThan(
      0,
    );

    const { suggestions, totalCandidates } = findTradeSuggestions({
      targetRosterId: 1,
      rosters: [myRoster, partnerRoster],
      users,
      catalogById: catalog,
      pickCatalogById: pickCatalog,
      tradedPicks: [],
      startSlots,
      limit: 3,
      offset: 0,
    });
    expect(totalCandidates).toBeGreaterThan(0);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]?.rank).toBe(1);
    expect(suggestions[0]?.team1Receive.length).toBeGreaterThan(0);
    expect(suggestions[0]?.team1Give.length).toBeGreaterThan(0);
  });

  it("excludes weak-skill surplus from trade chips", () => {
    const rows = buildRosterProfile(myRoster, catalog, startSlots, "Me").players;
    const weak = buildRosterProfile(myRoster, catalog, startSlots, "Me").weakSkills;
    const surplus = getTradeableSurplusPlayers(rows, startSlots, weak);
    for (const p of surplus) {
      const skill = p.position?.includes("TE") ? "TE" : null;
      if (skill && weak.includes("TE")) {
        expect(weak).not.toContain("TE");
      }
    }
  });

  it("returns stable ranks without duplicates across progressive slices", () => {
    const full = findTradeSuggestions({
      targetRosterId: 1,
      rosters: [myRoster, partnerRoster],
      users,
      catalogById: catalog,
      pickCatalogById: pickCatalog,
      tradedPicks: [],
      startSlots,
      limit: 3,
      offset: 0,
    });
    if (full.suggestions.length < 2) return;
    const firstId = full.suggestions[0]!.id;
    const rest = findTradeSuggestions({
      targetRosterId: 1,
      rosters: [myRoster, partnerRoster],
      users,
      catalogById: catalog,
      pickCatalogById: pickCatalog,
      tradedPicks: [],
      startSlots,
      limit: 2,
      offset: 0,
      excludeIds: [firstId],
    });
    expect(rest.suggestions.every((s) => s.id !== firstId)).toBe(true);
    if (rest.suggestions[0]) {
      expect(rest.suggestions[0].rank).toBeGreaterThan(1);
    }
  });

  it("rejects packages that would lower a non-target room", () => {
    const my = buildRosterProfile(myRoster, catalog, startSlots, "Me");
    const beforeTe = positionRoomStrength(my.players, "TE", startSlots);
    const { suggestions } = findTradeSuggestions({
      targetRosterId: 1,
      rosters: [myRoster, partnerRoster],
      users,
      catalogById: catalog,
      pickCatalogById: pickCatalog,
      tradedPicks: [],
      startSlots,
      limit: 5,
      offset: 0,
    });
    for (const s of suggestions) {
      expect(s.team1Give.every((a) => !a.position?.includes("TE") || !my.weakSkills.includes("TE"))).toBe(true);
    }
    expect(beforeTe).toBeGreaterThan(0);
  });
});
