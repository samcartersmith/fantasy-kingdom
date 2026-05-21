import {
  BUST_RATIO_THRESHOLD,
  expectedSlotPoints,
  gradeVsSlotRatio,
  STEAL_RATIO_THRESHOLD,
  vsSlotExcess,
} from "@/lib/draft-slot-value";
import type { DraftPlayerTradeValueResolver } from "@/lib/draft-player-trade-value";
import type { SleeperDraft, SleeperDraftPick } from "@/lib/sleeper-league-types";
import type { SleeperNflPlayer } from "@/lib/sleeper-types";

export const STARTUP_ROUNDS_THRESHOLD = 10;
export const STARTUP_PICKS_PER_TEAM_MULTIPLIER = 8;
export const MIN_PICKS_FOR_EFFECTIVENESS = 3;
export const STEAL_BUST_CAP = 25;

/** Steals must be outside the first-round premium window (picks 1–6). */
export const STEAL_MIN_PICK_NO = 7;
/** Busts only count for picks in the first two rounds of a 12-team draft (pick 24 or earlier). */
export const BUST_MAX_PICK_NO = 24;

export type DraftWithPicks = {
  draft: SleeperDraft;
  picks: SleeperDraftPick[];
};

export type ClassifiedDraft = {
  draft_id: string;
  season: string;
  league_id?: string;
  isStartup: boolean;
  pickCount: number;
  maxRound: number;
  teams: number;
};

export type EnrichedPick = {
  pick_no: number;
  round: number;
  roster_id: number;
  managerName: string;
  playerId: string;
  playerName: string;
  position: string;
  season: string;
  draft_id: string;
  currentValue: number;
  slotPoints: number;
  vsSlotRatio: number;
  vsSlotExcess: number;
};

export type ManagerEffectivenessRow = {
  roster_id: number;
  name: string;
  avgVsSlotRatio: number;
  pickCount: number;
};

export type ManagerPickCountRow = {
  roster_id: number;
  name: string;
  pickCount: number;
};

export type StealBustRow = {
  season: string;
  pick_no: number;
  round: number;
  roster_id: number;
  managerName: string;
  playerId: string;
  playerName: string;
  position: string;
  currentValue: number;
  slotPoints: number;
  vsSlotRatio: number;
};

export function teamCountFromDraft(draft: SleeperDraft, picks: SleeperDraftPick[]): number {
  const fromSettings = draft.settings?.teams;
  if (typeof fromSettings === "number" && fromSettings > 0) return fromSettings;
  const rosters = new Set(picks.map((p) => p.roster_id));
  return Math.max(1, rosters.size);
}

export function maxRoundFromPicks(picks: SleeperDraftPick[]): number {
  if (picks.length === 0) return 0;
  return Math.max(...picks.map((p) => p.round));
}

/** Classify startup vs annual rookie draft using round count heuristics. */
export function isStartupDraft(draft: SleeperDraft, picks: SleeperDraftPick[]): boolean {
  const teams = teamCountFromDraft(draft, picks);
  const roundsSetting = draft.settings?.rounds;
  if (typeof roundsSetting === "number" && roundsSetting >= STARTUP_ROUNDS_THRESHOLD) {
    return true;
  }
  const maxRound = maxRoundFromPicks(picks);
  if (maxRound >= STARTUP_ROUNDS_THRESHOLD) return true;
  if (picks.length > teams * STARTUP_PICKS_PER_TEAM_MULTIPLIER) return true;
  return false;
}

/** Prefer the non-startup draft when a season has multiple drafts. */
export function selectAnnualDraftForSeason(
  candidates: DraftWithPicks[],
): { included: DraftWithPicks | null; excluded: ClassifiedDraft[] } {
  const classified = candidates.map(({ draft, picks }) => {
    const startup = isStartupDraft(draft, picks);
    return {
      draft,
      picks,
      meta: {
        draft_id: draft.draft_id,
        season: draft.season,
        isStartup: startup,
        pickCount: picks.length,
        maxRound: maxRoundFromPicks(picks),
        teams: teamCountFromDraft(draft, picks),
      },
    };
  });

  const excluded: ClassifiedDraft[] = classified.filter((c) => c.meta.isStartup).map((c) => c.meta);
  const annual = classified.filter((c) => !c.meta.isStartup);

  if (annual.length === 0) {
    return { included: null, excluded };
  }

  const best = annual.reduce((a, b) => (a.picks.length <= b.picks.length ? a : b));

  for (const c of annual) {
    if (c.meta.draft_id !== best.meta.draft_id) {
      excluded.push(c.meta);
    }
  }

  return {
    included: { draft: best.draft, picks: best.picks },
    excluded,
  };
}

export function enrichPick(
  pick: SleeperDraftPick,
  season: string,
  draftId: string,
  managerName: string,
  player: SleeperNflPlayer | null,
  tradeValues: DraftPlayerTradeValueResolver,
  leagueSize: number,
  totalRounds: number,
): EnrichedPick | null {
  if (!pick.player_id || pick.player_id === "0") return null;
  if (!player) return null;

  const currentValue = tradeValues.getTradeCalculatorValue(pick.player_id, player);
  if (currentValue == null) return null;
  const slotPoints = expectedSlotPoints(pick.pick_no, pick.round, leagueSize, totalRounds);
  const ratio = gradeVsSlotRatio(currentValue, slotPoints);
  const excess = vsSlotExcess(ratio);

  const name =
    [player.first_name, player.last_name].filter(Boolean).join(" ").trim() || `Player ${pick.player_id}`;
  const position = player.position ?? player.fantasy_positions?.[0] ?? "—";

  return {
    pick_no: pick.pick_no,
    round: pick.round,
    roster_id: pick.roster_id,
    managerName,
    playerId: pick.player_id,
    playerName: name,
    position,
    season,
    draft_id: draftId,
    currentValue,
    slotPoints,
    vsSlotRatio: Math.round(ratio * 1000) / 1000,
    vsSlotExcess: Math.round(excess * 1000) / 1000,
  };
}

export function buildManagerEffectiveness(
  picks: EnrichedPick[],
  nameByRoster: Map<number, string>,
  minPicks = MIN_PICKS_FOR_EFFECTIVENESS,
): ManagerEffectivenessRow[] {
  const byRoster = new Map<number, number[]>();
  for (const p of picks) {
    const list = byRoster.get(p.roster_id) ?? [];
    list.push(p.vsSlotRatio);
    byRoster.set(p.roster_id, list);
  }

  const rows: ManagerEffectivenessRow[] = [];
  for (const [roster_id, ratios] of byRoster) {
    if (ratios.length < minPicks) continue;
    const avgVsSlotRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    rows.push({
      roster_id,
      name: nameByRoster.get(roster_id) ?? `Roster ${roster_id}`,
      avgVsSlotRatio: Math.round(avgVsSlotRatio * 100) / 100,
      pickCount: ratios.length,
    });
  }

  return rows.sort((a, b) => b.avgVsSlotRatio - a.avgVsSlotRatio || a.name.localeCompare(b.name));
}

export function buildMostPicks(
  picks: EnrichedPick[],
  nameByRoster: Map<number, string>,
): ManagerPickCountRow[] {
  const counts = new Map<number, number>();
  for (const p of picks) {
    counts.set(p.roster_id, (counts.get(p.roster_id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([roster_id, pickCount]) => ({
      roster_id,
      name: nameByRoster.get(roster_id) ?? `Roster ${roster_id}`,
      pickCount,
    }))
    .sort((a, b) => b.pickCount - a.pickCount || a.name.localeCompare(b.name));
}

export function isStealPick(p: Pick<EnrichedPick, "pick_no" | "vsSlotRatio">): boolean {
  return p.pick_no >= STEAL_MIN_PICK_NO && p.vsSlotRatio >= STEAL_RATIO_THRESHOLD;
}

export function isBustPick(p: Pick<EnrichedPick, "pick_no" | "vsSlotRatio">): boolean {
  return p.pick_no <= BUST_MAX_PICK_NO && p.vsSlotRatio <= BUST_RATIO_THRESHOLD;
}

export function buildSteals(picks: EnrichedPick[], cap = STEAL_BUST_CAP): StealBustRow[] {
  return [...picks]
    .filter(isStealPick)
    .sort((a, b) => b.vsSlotRatio - a.vsSlotRatio)
    .slice(0, cap)
    .map(toStealBustRow);
}

export function buildBusts(picks: EnrichedPick[], cap = STEAL_BUST_CAP): StealBustRow[] {
  return [...picks]
    .filter(isBustPick)
    .sort((a, b) => a.vsSlotRatio - b.vsSlotRatio)
    .slice(0, cap)
    .map(toStealBustRow);
}

function toStealBustRow(p: EnrichedPick): StealBustRow {
  return {
    season: p.season,
    pick_no: p.pick_no,
    round: p.round,
    roster_id: p.roster_id,
    managerName: p.managerName,
    playerId: p.playerId,
    playerName: p.playerName,
    position: p.position,
    currentValue: p.currentValue,
    slotPoints: p.slotPoints,
    vsSlotRatio: p.vsSlotRatio,
  };
}
