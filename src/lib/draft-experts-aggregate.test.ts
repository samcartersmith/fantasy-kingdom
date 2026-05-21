import { describe, expect, it } from "vitest";
import { expectedSlotPoints } from "@/lib/draft-slot-value";
import {
  buildBusts,
  buildManagerEffectiveness,
  buildSteals,
  isBustPick,
  isStartupDraft,
  isStealPick,
  selectAnnualDraftForSeason,
} from "@/lib/draft-experts-aggregate";
import type { EnrichedPick } from "@/lib/draft-experts-aggregate";
import type { SleeperDraft, SleeperDraftPick } from "@/lib/sleeper-league-types";

function draft(id: string, season: string, rounds?: number, teams?: number): SleeperDraft {
  return {
    draft_id: id,
    season,
    status: "complete",
    settings: rounds != null || teams != null ? { rounds, teams } : undefined,
  };
}

function picksForRounds(rounds: number, teams: number): SleeperDraftPick[] {
  const out: SleeperDraftPick[] = [];
  let pickNo = 1;
  for (let r = 1; r <= rounds; r++) {
    for (let t = 1; t <= teams; t++) {
      out.push({
        pick_no: pickNo++,
        round: r,
        roster_id: t,
        player_id: String(1000 + pickNo),
      });
    }
  }
  return out;
}

describe("isStartupDraft", () => {
  it("flags 20-round startup draft", () => {
    const d = draft("1", "2019", 20, 12);
    const picks = picksForRounds(20, 12);
    expect(isStartupDraft(d, picks)).toBe(true);
  });

  it("does not flag 4-round annual draft", () => {
    const d = draft("2", "2024", 4, 12);
    const picks = picksForRounds(4, 12);
    expect(isStartupDraft(d, picks)).toBe(false);
  });
});

describe("selectAnnualDraftForSeason", () => {
  it("prefers annual draft when both exist in one season", () => {
    const startup = { draft: draft("s", "2020", 20, 10), picks: picksForRounds(20, 10) };
    const annual = { draft: draft("a", "2020", 4, 10), picks: picksForRounds(4, 10) };
    const { included, excluded } = selectAnnualDraftForSeason([startup, annual]);
    expect(included?.draft.draft_id).toBe("a");
    expect(excluded.some((e) => e.draft_id === "s" && e.isStartup)).toBe(true);
  });
});

describe("slot curve via enrich pipeline fields", () => {
  it("decays from pick 1 to pick 48 on 10k pool", () => {
    const early = expectedSlotPoints(1, 1, 12, 4);
    const late = expectedSlotPoints(48, 4, 12, 4);
    expect(early).toBeGreaterThan(late);
  });
});

function enriched(overrides: Partial<EnrichedPick> & Pick<EnrichedPick, "pick_no" | "vsSlotRatio">): EnrichedPick {
  return {
    round: 1,
    roster_id: 1,
    managerName: "A",
    playerId: "1",
    playerName: "P",
    position: "RB",
    season: "2023",
    draft_id: "d",
    currentValue: 1000,
    slotPoints: 500,
    vsSlotExcess: 0,
    ...overrides,
  };
}

describe("steal and bust pick rules", () => {
  it("excludes first-six picks from steals even when ratio is high", () => {
    expect(isStealPick(enriched({ pick_no: 1, vsSlotRatio: 2 }))).toBe(false);
    expect(isStealPick(enriched({ pick_no: 6, vsSlotRatio: 1.5 }))).toBe(false);
    expect(isStealPick(enriched({ pick_no: 7, vsSlotRatio: 1.15 }))).toBe(true);
    expect(isStealPick(enriched({ pick_no: 7, vsSlotRatio: 1.1 }))).toBe(false);
  });

  it("limits busts to pick 24 or earlier with low vs-slot ratio", () => {
    expect(isBustPick(enriched({ pick_no: 24, vsSlotRatio: 0.8 }))).toBe(true);
    expect(isBustPick(enriched({ pick_no: 25, vsSlotRatio: 0.5 }))).toBe(false);
    expect(isBustPick(enriched({ pick_no: 12, vsSlotRatio: 0.9 }))).toBe(false);
  });

  it("buildSteals and buildBusts apply pick windows", () => {
    const picks = [
      enriched({ pick_no: 1, vsSlotRatio: 2, playerId: "early" }),
      enriched({ pick_no: 10, vsSlotRatio: 1.2, playerId: "steal" }),
      enriched({ pick_no: 20, vsSlotRatio: 0.7, playerId: "bust" }),
      enriched({ pick_no: 30, vsSlotRatio: 0.5, playerId: "late" }),
    ];
    expect(buildSteals(picks).map((r) => r.playerId)).toEqual(["steal"]);
    expect(buildBusts(picks).map((r) => r.playerId)).toEqual(["bust"]);
  });
});

describe("buildManagerEffectiveness and steals", () => {
  it("ranks managers by average vs-slot ratio", () => {
    const picks = [
      {
        pick_no: 1,
        round: 1,
        roster_id: 1,
        managerName: "A",
        playerId: "1",
        playerName: "P1",
        position: "RB",
        season: "2023",
        draft_id: "d",
        currentValue: 5000,
        slotPoints: 400,
        vsSlotRatio: 1.5,
        vsSlotExcess: 0.5,
      },
      {
        pick_no: 2,
        round: 1,
        roster_id: 1,
        managerName: "A",
        playerId: "2",
        playerName: "P2",
        position: "WR",
        season: "2023",
        draft_id: "d",
        currentValue: 4500,
        slotPoints: 350,
        vsSlotRatio: 1.3,
        vsSlotExcess: 0.3,
      },
      {
        pick_no: 10,
        round: 2,
        roster_id: 1,
        managerName: "A",
        playerId: "10",
        playerName: "P10",
        position: "WR",
        season: "2023",
        draft_id: "d",
        currentValue: 4200,
        slotPoints: 200,
        vsSlotRatio: 1.2,
        vsSlotExcess: 0.2,
      },
      {
        pick_no: 3,
        round: 1,
        roster_id: 2,
        managerName: "B",
        playerId: "3",
        playerName: "P3",
        position: "QB",
        season: "2023",
        draft_id: "d",
        currentValue: 2000,
        slotPoints: 380,
        vsSlotRatio: 0.6,
        vsSlotExcess: -0.4,
      },
      {
        pick_no: 4,
        round: 1,
        roster_id: 2,
        managerName: "B",
        playerId: "4",
        playerName: "P4",
        position: "TE",
        season: "2023",
        draft_id: "d",
        currentValue: 2100,
        slotPoints: 360,
        vsSlotRatio: 0.65,
        vsSlotExcess: -0.35,
      },
      {
        pick_no: 5,
        round: 2,
        roster_id: 2,
        managerName: "B",
        playerId: "5",
        playerName: "P5",
        position: "RB",
        season: "2023",
        draft_id: "d",
        currentValue: 3000,
        slotPoints: 220,
        vsSlotRatio: 0.9,
        vsSlotExcess: -0.1,
      },
    ];
    const names = new Map([
      [1, "A"],
      [2, "B"],
    ]);
    const eff = buildManagerEffectiveness(picks, names, 3);
    expect(eff[0]?.roster_id).toBe(1);
    expect(eff[1]?.roster_id).toBe(2);
    const steals = buildSteals(picks);
    expect(steals[0]?.vsSlotRatio).toBeGreaterThanOrEqual(1.15);
  });
});
