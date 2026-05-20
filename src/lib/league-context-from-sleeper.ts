import type { SleeperLeague } from "@/lib/sleeper-league-types";
import type { LeagueContext, LeagueSize, PprMode } from "@/lib/trade-model/types";
import { DEFAULT_STARTING_SLOTS } from "@/lib/trade-model/types";

function parsePprFromScoring(scoring: Record<string, number>): PprMode {
  const rec = scoring.rec;
  if (rec === undefined || rec === null) return 1;
  if (rec >= 0.9) return 1;
  if (rec >= 0.4) return 0.5;
  return 0;
}

function parseLeagueSize(total: number): LeagueSize {
  if (total === 8 || total === 10 || total === 12 || total === 14) return total;
  if (total < 10) return 8;
  if (total < 12) return 10;
  if (total < 14) return 12;
  return 14;
}

function countPositionSlots(positions: string[], token: string): 1 | 2 | 3 | 4 {
  const n = positions.filter((p) => p === token).length;
  if (n >= 4) return 4;
  if (n === 3) return 3;
  if (n === 2) return 2;
  return 1;
}

export function leagueContextFromSleeper(league: SleeperLeague): LeagueContext {
  const positions = league.roster_positions ?? [];
  const hasSuperflex = positions.some((p) => p === "SUPER_FLEX" || p === "QB_FLEX");
  return {
    superflex: hasSuperflex,
    ppr: parsePprFromScoring(league.scoring_settings ?? {}),
    leagueSize: parseLeagueSize(league.total_rosters ?? 12),
    startQb: countPositionSlots(positions, "QB"),
    startRb: countPositionSlots(positions, "RB"),
    startWr: countPositionSlots(positions, "WR"),
    startTe: countPositionSlots(positions, "TE"),
    startFlex: countPositionSlots(positions, "FLEX"),
  };
}

export function formatLeagueContextLabel(ctx: LeagueContext): string {
  const ppr = ctx.ppr === 1 ? "PPR" : ctx.ppr === 0.5 ? "Half PPR" : "Standard";
  const sf = ctx.superflex ? "Superflex" : "1QB";
  return `${ctx.leagueSize}-team · ${ppr} · ${sf}`;
}

export function defaultLeagueContext(): LeagueContext {
  return {
    superflex: false,
    ppr: 1,
    leagueSize: 12,
    startQb: DEFAULT_STARTING_SLOTS.startQb,
    startRb: DEFAULT_STARTING_SLOTS.startRb,
    startWr: DEFAULT_STARTING_SLOTS.startWr,
    startTe: DEFAULT_STARTING_SLOTS.startTe,
    startFlex: DEFAULT_STARTING_SLOTS.startFlex,
  };
}
