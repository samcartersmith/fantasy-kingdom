import { describe, expect, it } from "vitest";
import type { DraftBoardPickRow } from "@/lib/draft-experts-build";
import {
  buildDraftBoardMatrix,
  buildSlotColumnHeaders,
  columnIndexForPick,
  formatDraftSlot,
  pickIndexInRound,
  snakePickInRound,
} from "@/lib/draft-board-slot";
import type { SleeperDraftTradedPick } from "@/lib/sleeper-league-types";

function pick(
  overrides: Partial<DraftBoardPickRow> &
    Pick<DraftBoardPickRow, "pick_no" | "round" | "roster_id">,
): DraftBoardPickRow {
  if ("status" in overrides && overrides.status === "skipped") {
    return {
      status: "skipped",
      skipReason: "player_not_in_cache",
      managerName: "A",
      isTradedOrProxy: false,
      isSlotTrade: false,
      ...overrides,
    } as DraftBoardPickRow;
  }
  return {
    status: "graded",
    managerName: "A",
    isTradedOrProxy: false,
    isSlotTrade: false,
    playerId: "1",
    playerName: "P",
    position: "RB",
    team: "ARI",
    imageUrl: "https://example.com/1.jpg",
    currentValue: 1000,
    slotPoints: 500,
    vsSlotRatio: 1,
    ...overrides,
  } as DraftBoardPickRow;
}

describe("draft slot labels", () => {
  it("pickIndexInRound cycles within league size", () => {
    expect(pickIndexInRound(1, 12)).toBe(1);
    expect(pickIndexInRound(12, 12)).toBe(12);
    expect(pickIndexInRound(13, 12)).toBe(1);
  });

  it("snakePickInRound reverses even rounds", () => {
    expect(snakePickInRound(1, 1, 12)).toBe(1);
    expect(snakePickInRound(2, 13, 12)).toBe(12);
    expect(formatDraftSlot(2, 13, 12)).toBe("2.12");
  });
});

describe("draft_slot column placement", () => {
  it("uses Sleeper draft_slot for column, not roster home column", () => {
    const teams = 4;
    const picks: DraftBoardPickRow[] = [
      pick({ pick_no: 1, round: 1, roster_id: 1, draft_slot: 1, playerId: "1" }),
      pick({ pick_no: 2, round: 1, roster_id: 2, draft_slot: 2, playerId: "2" }),
      pick({
        pick_no: 3,
        round: 1,
        roster_id: 99,
        draft_slot: 3,
        playerId: "99",
      }),
      pick({ pick_no: 4, round: 1, roster_id: 4, draft_slot: 4, playerId: "4" }),
    ];
    expect(columnIndexForPick(picks[2]!, teams)).toBe(2);
    const matrix = buildDraftBoardMatrix(picks, teams);
    expect(matrix.cells[0]![2]?.roster_id).toBe(99);
  });

  it("places pick using pick_no when Sleeper round field is off", () => {
    const teams = 12;
    const picks: DraftBoardPickRow[] = [];
    for (let i = 1; i <= 12; i++) {
      picks.push(
        pick({
          pick_no: i,
          round: 1,
          roster_id: i,
          draft_slot: i,
          playerId: String(i),
        }),
      );
    }
    picks.push(
      pick({
        pick_no: 13,
        round: 3,
        roster_id: 12,
        draft_slot: 12,
        playerId: "13",
      }),
    );
    const matrix = buildDraftBoardMatrix(picks, teams);
    expect(matrix.cells[1]![11]?.pick_no).toBe(13);
  });
});

describe("buildSlotColumnHeaders", () => {
  it("keeps original owner on column when round-1 slot was traded", () => {
    const names = new Map([
      [2, "Original Owner"],
      [3, "Acquirer"],
    ]);
    const boardPicks: DraftBoardPickRow[] = [
      pick({ pick_no: 1, round: 1, roster_id: 1, draft_slot: 1, playerId: "1" }),
      pick({
        pick_no: 2,
        round: 1,
        roster_id: 3,
        draft_slot: 2,
        playerId: "2",
        isSlotTrade: true,
        tradedToName: "Acquirer",
      }),
    ];
    const traded: SleeperDraftTradedPick[] = [
      { season: "2024", round: 1, roster_id: 2, previous_owner_id: 2, owner_id: 3 },
    ];
    const headers = buildSlotColumnHeaders(4, traded, boardPicks, names);
    expect(headers[1]?.managerName).toBe("Original Owner");
    expect(headers[1]?.roster_id).toBe(2);
  });
});

describe("buildDraftBoardMatrix", () => {
  it("fills a full 12x4 board without gaps", () => {
    const teams = 12;
    const rounds = 4;
    const picks: DraftBoardPickRow[] = [];
    for (let n = 1; n <= teams * rounds; n++) {
      const round = Math.ceil(n / teams);
      picks.push(
        pick({
          pick_no: n,
          round,
          roster_id: ((n - 1) % teams) + 1,
          draft_slot: snakePickInRound(round, n, teams),
          playerId: String(n),
        }),
      );
    }
    const matrix = buildDraftBoardMatrix(picks, teams);
    const filled = matrix.cells.flat().filter(Boolean).length;
    expect(filled).toBe(48);
    expect(matrix.maxRound).toBe(4);
  });
});
