import { effectiveMatchupPoints } from "@/lib/league-history-aggregate";
import type { SeasonPredictionsLineupMode } from "@/lib/season-predictions/lineup-mode";
import {
  optimizeProjectedLineupScore,
  pragmaticProjectedLineupScore,
  type LineupSlot,
} from "@/lib/season-predictions/lineup-optimizer";
import type { SleeperMatchup } from "@/lib/sleeper-league-types";
import type { SkillPosition } from "@/lib/sleeper-ranking";

export type RosterWeekScoreContext = {
  lineupMode: SeasonPredictionsLineupMode;
  rosterPositions: string[];
  startingSlots: LineupSlot[];
  positionLookup: Map<string, SkillPosition[]>;
  rawPositionLookup: Map<string, string | null>;
};

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
  lineupPool: string[] | null | undefined,
  projections: Map<string, number>,
  lineupContext?: RosterWeekScoreContext,
): { score: number; usedActuals: boolean } {
  if (rosterWeekUsesActuals(week, currentWeek, matchupRow)) {
    return {
      score: matchupRow ? effectiveMatchupPoints(matchupRow) : 0,
      usedActuals: true,
    };
  }

  if (!lineupContext) {
    return { score: 0, usedActuals: false };
  }

  const slotStarters = matchupRow?.starters ?? rosterStarters ?? null;
  const pool = lineupPool?.filter(Boolean) ?? [];

  if (lineupContext.lineupMode === "pragmatic") {
    return {
      score: pragmaticProjectedLineupScore(
        lineupContext.rosterPositions,
        slotStarters,
        pool,
        projections,
        lineupContext.positionLookup,
        lineupContext.rawPositionLookup,
      ),
      usedActuals: false,
    };
  }

  return {
    score: optimizeProjectedLineupScore(
      pool,
      projections,
      lineupContext.startingSlots,
      lineupContext.positionLookup,
      lineupContext.rawPositionLookup,
    ),
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
