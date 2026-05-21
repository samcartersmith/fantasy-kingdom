import { describe, expect, it } from "vitest";
import {
  buildManagerEffectiveness,
  buildSteals,
  expectedValueAtPickNo,
  isStartupDraft,
  selectAnnualDraftForSeason,
} from "@/lib/draft-experts-aggregate";
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

describe("expectedValueAtPickNo", () => {
  it("decays from early picks to late picks", () => {
    const early = expectedValueAtPickNo(1, 12);
    const late = expectedValueAtPickNo(48, 12);
    expect(early).toBeGreaterThan(late);
  });
});

describe("buildManagerEffectiveness and steals", () => {
  it("ranks managers by average delta", () => {
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
        expectedValue: 4000,
        delta: 1000,
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
        expectedValue: 3900,
        delta: 600,
      },
      {
        pick_no: 6,
        round: 2,
        roster_id: 1,
        managerName: "A",
        playerId: "6",
        playerName: "P6",
        position: "WR",
        season: "2023",
        draft_id: "d",
        currentValue: 4200,
        expectedValue: 3600,
        delta: 600,
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
        expectedValue: 3800,
        delta: -1800,
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
        expectedValue: 3700,
        delta: -1600,
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
        expectedValue: 3500,
        delta: -500,
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
    expect(steals[0]?.delta).toBeGreaterThan(0);
  });
});
