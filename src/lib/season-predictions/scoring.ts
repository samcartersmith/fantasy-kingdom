import { effectiveMatchupPoints } from "@/lib/league-history-aggregate";
import {
  starterPlayerIds,
  sumRosterProjectionPoints,
} from "@/lib/season-predictions/fetch-sleeper-projections";
import type { SleeperMatchup } from "@/lib/sleeper-league-types";

export function hasRecordedMatchupScore(m: SleeperMatchup): boolean {
  const custom = m.custom_points;
  if (typeof custom === "number" && Number.isFinite(custom)) return true;
  const pts = m.points;
  return typeof pts === "number" && Number.isFinite(pts) && pts > 0;
}

/**
 * Use Sleeper actuals when the NFL week has finished or this matchup has a real score.
 * During offseason (currentWeek 0), only scored matchups count as actuals.
 */
export function rosterWeekUsesActuals(
  week: number,
  currentWeek: number,
  matchupRow: SleeperMatchup | undefined,
): boolean {
  if (matchupRow && hasRecordedMatchupScore(matchupRow)) return true;
  if (currentWeek > 0 && week < currentWeek) return true;
  return false;
}

export function rosterWeekScore(
  week: number,
  currentWeek: number,
  matchupRow: SleeperMatchup | undefined,
  rosterStarters: string[] | null | undefined,
  rosterPlayers: string[] | null | undefined,
  projections: Map<string, number>,
): { score: number; usedActuals: boolean } {
  if (rosterWeekUsesActuals(week, currentWeek, matchupRow)) {
    return {
      score: matchupRow ? effectiveMatchupPoints(matchupRow) : 0,
      usedActuals: true,
    };
  }
  const lineup = starterPlayerIds(matchupRow, rosterStarters, rosterPlayers);
  return {
    score: sumRosterProjectionPoints(lineup, projections),
    usedActuals: false,
  };
}

export type WeekOutcome = {
  wins: Map<number, number>;
  losses: Map<number, number>;
  ties: Map<number, number>;
  pointsFor: Map<number, number>;
  pointsAgainst: Map<number, number>;
};

export function applyHeadToHeadResult(
  rosterA: number,
  rosterB: number,
  scoreA: number,
  scoreB: number,
  acc: WeekOutcome,
): number | null {
  acc.pointsFor.set(rosterA, (acc.pointsFor.get(rosterA) ?? 0) + scoreA);
  acc.pointsFor.set(rosterB, (acc.pointsFor.get(rosterB) ?? 0) + scoreB);
  acc.pointsAgainst.set(rosterA, (acc.pointsAgainst.get(rosterA) ?? 0) + scoreB);
  acc.pointsAgainst.set(rosterB, (acc.pointsAgainst.get(rosterB) ?? 0) + scoreA);

  if (scoreA > scoreB) {
    acc.wins.set(rosterA, (acc.wins.get(rosterA) ?? 0) + 1);
    acc.losses.set(rosterB, (acc.losses.get(rosterB) ?? 0) + 1);
    return rosterA;
  }
  if (scoreB > scoreA) {
    acc.wins.set(rosterB, (acc.wins.get(rosterB) ?? 0) + 1);
    acc.losses.set(rosterA, (acc.losses.get(rosterA) ?? 0) + 1);
    return rosterB;
  }
  acc.ties.set(rosterA, (acc.ties.get(rosterA) ?? 0) + 1);
  acc.ties.set(rosterB, (acc.ties.get(rosterB) ?? 0) + 1);
  return null;
}

export function emptyWeekOutcome(): WeekOutcome {
  return {
    wins: new Map(),
    losses: new Map(),
    ties: new Map(),
    pointsFor: new Map(),
    pointsAgainst: new Map(),
  };
}

export function formatProjectedRecord(wins: number, losses: number, ties: number): string {
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}
