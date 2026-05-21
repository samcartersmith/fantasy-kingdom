import type { DraftBoardPickRow, DraftExpertsPickRow } from "@/lib/draft-experts-build";
import type { SleeperDraftTradedPick } from "@/lib/sleeper-league-types";

export function isGradedBoardPick(
  pick: DraftBoardPickRow,
): pick is { status: "graded" } & DraftExpertsPickRow {
  return pick.status === "graded";
}

export type DraftBoardColumn = {
  roster_id: number;
  managerName: string;
  avatarUrl?: string;
  draft_slot: number;
};

export type DraftSlotColumnHeader = DraftBoardColumn;

/** Column headers use the original slot owner (unchanged when the pick was traded). */
export function buildSlotColumnHeaders(
  teamsInDraft: number,
  tradedPicks: SleeperDraftTradedPick[],
  boardPicks: DraftBoardPickRow[],
  nameByRoster: Map<number, string>,
  managers?: Record<string, { roster_id: number; name: string; avatarUrl?: string }>,
): DraftSlotColumnHeader[] {
  return Array.from({ length: teamsInDraft }, (_, colIdx) => {
    const draft_slot = colIdx + 1;
    const round1Pick = boardPicks.find(
      (p) =>
        effectiveDraftRound(p.pick_no, teamsInDraft, p.round) === 1 &&
        draftSlotForPick(p, teamsInDraft) === draft_slot,
    );
    const slotTrade = round1Pick
      ? tradedPicks.find(
          (t) =>
            t.round === 1 &&
            t.owner_id === round1Pick.roster_id &&
            t.owner_id !== t.roster_id,
        )
      : undefined;
    const roster_id = slotTrade?.roster_id ?? round1Pick?.roster_id ?? 0;
    const mgr = roster_id ? managers?.[String(roster_id)] : undefined;
    return {
      draft_slot,
      roster_id,
      managerName:
        mgr?.name ??
        nameByRoster.get(roster_id) ??
        (roster_id ? `Roster ${roster_id}` : `Slot ${draft_slot}`),
      avatarUrl: mgr?.avatarUrl,
    };
  });
}

export type DraftBoardMatrix = {
  columns: DraftBoardColumn[];
  cells: (DraftBoardPickRow | null)[][];
  leagueSize: number;
  maxRound: number;
};

/** 1-based index of pick within its round (before snake reversal). */
export function pickIndexInRound(pickNo: number, leagueSize: number): number {
  if (leagueSize < 1) return 1;
  return ((pickNo - 1) % leagueSize) + 1;
}

/** Display slot within round for snake drafts (1.01, 2.12, etc.). */
export function snakePickInRound(round: number, pickNo: number, leagueSize: number): number {
  const idx = pickIndexInRound(pickNo, leagueSize);
  if (round % 2 === 0) return leagueSize - idx + 1;
  return idx;
}

/** Draft round implied by overall pick number (snake drafts). */
export function roundFromPickNo(pickNo: number, teamsInDraft: number): number {
  return Math.ceil(pickNo / Math.max(teamsInDraft, 1));
}

/** Prefer pick_no-derived round so grid rows match the table when Sleeper round drifts. */
export function effectiveDraftRound(
  pickNo: number,
  teamsInDraft: number,
  roundField: number,
): number {
  const fromPickNo = roundFromPickNo(pickNo, teamsInDraft);
  if (roundField < 1) return fromPickNo;
  if (Math.abs(roundField - fromPickNo) <= 1) return fromPickNo;
  return fromPickNo;
}

/** 1-based Sleeper draft board column for this pick. */
export function draftSlotForPick(
  pick: Pick<DraftBoardPickRow, "pick_no" | "round" | "draft_slot">,
  teamsInDraft: number,
): number {
  if (pick.draft_slot != null && pick.draft_slot >= 1) return pick.draft_slot;
  const round = effectiveDraftRound(pick.pick_no, teamsInDraft, pick.round);
  return snakePickInRound(round, pick.pick_no, teamsInDraft);
}

/** 0-based column index on the draft board grid. */
export function columnIndexForPick(
  pick: Pick<DraftBoardPickRow, "pick_no" | "round" | "draft_slot">,
  teamsInDraft: number,
): number {
  return draftSlotForPick(pick, teamsInDraft) - 1;
}

/** Round.pick label, e.g. 1.03 or 2.12 */
export function formatDraftSlot(round: number, pickNo: number, leagueSize: number): string {
  const slot = snakePickInRound(round, pickNo, leagueSize);
  return `${round}.${String(slot).padStart(2, "0")}`;
}

export function formatDraftSlotForPick(
  pick: Pick<DraftBoardPickRow, "pick_no" | "round" | "draft_slot">,
  teamsInDraft: number,
): string {
  const round = effectiveDraftRound(pick.pick_no, teamsInDraft, pick.round);
  const slot = draftSlotForPick(pick, teamsInDraft);
  return `${round}.${String(slot).padStart(2, "0")}`;
}

export function buildDraftBoardMatrix(
  picks: DraftBoardPickRow[],
  teamsInDraft: number,
  managers?: Record<string, { roster_id: number; name: string; avatarUrl?: string }>,
  slotHeaders?: DraftSlotColumnHeader[],
): DraftBoardMatrix {
  const cols = Math.max(
    teamsInDraft,
    picks.length > 0 ? Math.max(...picks.map((p) => draftSlotForPick(p, teamsInDraft))) : 1,
    1,
  );

  const maxPickNo = picks.length > 0 ? Math.max(...picks.map((p) => p.pick_no)) : 0;
  const maxRound = Math.max(
    picks.length > 0
      ? Math.max(
          ...picks.map((p) => effectiveDraftRound(p.pick_no, teamsInDraft, p.round)),
        )
      : 0,
    maxPickNo > 0 ? roundFromPickNo(maxPickNo, teamsInDraft) : 0,
  );

  const columns: DraftBoardColumn[] =
    slotHeaders ??
    buildSlotColumnHeaders(teamsInDraft, [], picks, new Map(), managers);

  const cells: (DraftBoardPickRow | null)[][] = Array.from({ length: maxRound }, () =>
    Array.from({ length: cols }, () => null),
  );

  for (const pick of picks) {
    const col = columnIndexForPick(pick, teamsInDraft);
    const row = roundFromPickNo(pick.pick_no, teamsInDraft) - 1;
    if (row >= 0 && row < cells.length && col >= 0 && col < cols) {
      const existing = cells[row]![col];
      if (existing == null || pick.pick_no < existing.pick_no) {
        cells[row]![col] = pick;
      }
    }
  }

  return { columns, cells, leagueSize: cols, maxRound };
}
