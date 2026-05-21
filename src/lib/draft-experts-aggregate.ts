import { tradeValueFromSleeperSignals } from "@/lib/sleeper-ranking";
import type { SleeperDraft, SleeperDraftPick } from "@/lib/sleeper-league-types";
import type { SleeperNflPlayer } from "@/lib/sleeper-types";

export const STARTUP_ROUNDS_THRESHOLD = 10;
export const STARTUP_PICKS_PER_TEAM_MULTIPLIER = 8;
export const MIN_PICKS_FOR_EFFECTIVENESS = 3;
export const BUST_EARLY_PICK_MULTIPLIER = 3;
export const STEAL_BUST_CAP = 25;

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
  expectedValue: number;
  delta: number;
};

export type ManagerEffectivenessRow = {
  roster_id: number;
  name: string;
  avgDelta: number;
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
  expectedValue: number;
  delta: number;
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

/**
 * Expected value at draft slot from pick number (lower pick_no = higher expectation).
 * Uses same scale as tradeValueFromSleeperSignals output.
 */
export function expectedValueAtPickNo(pickNo: number, leagueSize: number): number {
  const slot = Math.max(1, pickNo);
  const teams = Math.max(4, leagueSize);
  const totalSlots = teams * 5;
  const t = (slot - 1) / Math.max(1, totalSlots - 1);
  const top = tradeValueFromSleeperSignals(12, 0);
  const floor = tradeValueFromSleeperSignals(900, 0);
  return Math.round(top + (floor - top) * Math.min(1, t));
}

export function enrichPick(
  pick: SleeperDraftPick,
  season: string,
  draftId: string,
  managerName: string,
  player: SleeperNflPlayer | null,
  trendingAdds: number,
  leagueSize: number,
): EnrichedPick | null {
  if (!pick.player_id || pick.player_id === "0") return null;
  if (!player) return null;

  const sr =
    typeof player.search_rank === "number" && Number.isFinite(player.search_rank) && player.search_rank > 0
      ? player.search_rank
      : null;
  const currentValue = tradeValueFromSleeperSignals(sr, trendingAdds);
  const expectedValue = expectedValueAtPickNo(pick.pick_no, leagueSize);
  const delta = currentValue - expectedValue;

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
    expectedValue,
    delta,
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
    list.push(p.delta);
    byRoster.set(p.roster_id, list);
  }

  const rows: ManagerEffectivenessRow[] = [];
  for (const [roster_id, deltas] of byRoster) {
    if (deltas.length < minPicks) continue;
    const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    rows.push({
      roster_id,
      name: nameByRoster.get(roster_id) ?? `Roster ${roster_id}`,
      avgDelta: Math.round(avgDelta * 10) / 10,
      pickCount: deltas.length,
    });
  }

  return rows.sort((a, b) => b.avgDelta - a.avgDelta || a.name.localeCompare(b.name));
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

export function buildSteals(picks: EnrichedPick[], cap = STEAL_BUST_CAP): StealBustRow[] {
  return [...picks]
    .filter((p) => p.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, cap)
    .map(toStealBustRow);
}

export function buildBusts(
  picks: EnrichedPick[],
  leagueSize: number,
  cap = STEAL_BUST_CAP,
): StealBustRow[] {
  const earlyCap = leagueSize * BUST_EARLY_PICK_MULTIPLIER;
  return [...picks]
    .filter((p) => p.delta < 0 && p.pick_no <= earlyCap)
    .sort((a, b) => a.delta - b.delta)
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
    expectedValue: p.expectedValue,
    delta: p.delta,
  };
}
