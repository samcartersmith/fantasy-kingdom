import { describe, expect, it } from "vitest";
import type { DraftExpertsPickRow } from "@/lib/draft-experts-build";
import {
  filterPicksByRoster,
  filterStealBustByRoster,
  managerRank,
  teamSummary,
} from "@/lib/draft-experts-team";

describe("draft-experts-team", () => {
  const picks: DraftExpertsPickRow[] = [
    {
      pick_no: 1,
      round: 1,
      roster_id: 1,
      managerName: "A",
      playerId: "a",
      playerName: "P1",
      position: "RB",
      team: "ARI",
      imageUrl: "",
      currentValue: 1000,
      slotPoints: 500,
      vsSlotRatio: 1.2,
      isTradedOrProxy: false,
      isSlotTrade: false,
    },
    {
      pick_no: 2,
      round: 1,
      roster_id: 2,
      managerName: "B",
      playerId: "b",
      playerName: "P2",
      position: "WR",
      team: "DAL",
      imageUrl: "",
      currentValue: 900,
      slotPoints: 480,
      vsSlotRatio: 0.8,
      isTradedOrProxy: false,
      isSlotTrade: false,
    },
  ];

  it("filters picks and steal/bust rows by roster", () => {
    expect(filterPicksByRoster(picks, 1)).toHaveLength(1);
    expect(
      filterStealBustByRoster(
        [{ season: "2024", pick_no: 2, round: 1, roster_id: 2, managerName: "B", playerId: "b", playerName: "P2", position: "WR", currentValue: 1, slotPoints: 1, vsSlotRatio: 0.5 }],
        2,
      ),
    ).toHaveLength(1);
  });

  it("computes rank and summary", () => {
    const effectiveness = [
      { roster_id: 1, avgVsSlotRatio: 1.2, pickCount: 1, name: "A" },
      { roster_id: 2, avgVsSlotRatio: 0.8, pickCount: 1, name: "B" },
    ];
    expect(managerRank(effectiveness, 1)).toBe(1);
    const summary = teamSummary(picks, 1, effectiveness);
    expect(summary.pickCount).toBe(1);
    expect(summary.rank).toBe(1);
    expect(summary.avgVsSlotRatio).toBe(1.2);
  });
});
