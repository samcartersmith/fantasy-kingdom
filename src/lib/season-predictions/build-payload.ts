import { pairMatchups } from "@/lib/league-history-aggregate";
import {
  formatLeagueContextLabel,
  leagueContextFromSleeper,
} from "@/lib/league-context-from-sleeper";
import { fetchProjectionWeeksParallel } from "@/lib/season-predictions/fetch-sleeper-projections";
import {
  methodologyVersionForMode,
  parseLineupMode,
  valueNoteForMode,
  type SeasonPredictionsLineupMode,
} from "@/lib/season-predictions/lineup-mode";
import { parseStartingSlots } from "@/lib/season-predictions/lineup-optimizer";
import { fetchSleeperNflState } from "@/lib/season-predictions/nfl-state";
import {
  buildRosterPositionIndexFromProfile,
  toLineupPositionLookup,
} from "@/lib/season-predictions/player-positions";
import {
  activeLineupPlayerIds,
  collectActiveLineupPlayerIds,
} from "@/lib/season-predictions/roster-pool";
import {
  applyHeadToHeadResult,
  emptyWeekOutcome,
  formatProjectedRecord,
  rosterWeekScore,
  rosterWeekUsesActuals,
} from "@/lib/season-predictions/scoring";
import type {
  SeasonPredictionMatchup,
  SeasonPredictionRow,
  SeasonPredictionsPayload,
} from "@/lib/season-predictions/types";
import {
  fetchSeasonRegularMatchups,
  fetchSleeperLeague,
  fetchSleeperLeagueRosters,
  fetchSleeperLeagueUsers,
  regularSeasonWeekLimit,
  rosterAvatarUrl,
  rosterDisplayName,
} from "@/lib/sleeper-league-fetch";
import type { SleeperLeagueUser, SleeperMatchup, SleeperRoster } from "@/lib/sleeper-league-types";

export type BuildSeasonPredictionsOptions = {
  lineupMode?: SeasonPredictionsLineupMode;
};

function ownerDisplayName(roster: SleeperRoster, users: SleeperLeagueUser[]): string {
  const owner = users.find((u) => u.user_id === roster.owner_id);
  return owner?.display_name?.trim() || owner?.metadata?.team_name?.trim() || "—";
}

function matchupByRoster(rows: SleeperMatchup[]): Map<number, SleeperMatchup> {
  const map = new Map<number, SleeperMatchup>();
  for (const row of rows) {
    map.set(row.roster_id, row);
  }
  return map;
}

function weekNeedsProjections(
  week: number,
  currentWeek: number,
  rows: SleeperMatchup[],
  rosters: SleeperRoster[],
): boolean {
  const byRoster = matchupByRoster(rows);
  for (const roster of rosters) {
    const row = byRoster.get(roster.roster_id);
    if (!rosterWeekUsesActuals(week, currentWeek, row)) return true;
  }
  return false;
}

function collectProjectionWeeks(
  matchupsByWeek: Map<number, SleeperMatchup[]>,
  regularSeasonWeeks: number,
  currentWeek: number,
  rosters: SleeperRoster[],
): number[] {
  const weeks: number[] = [];
  for (let week = 1; week <= regularSeasonWeeks; week++) {
    const rows = matchupsByWeek.get(week);
    if (!rows?.length) continue;
    if (weekNeedsProjections(week, currentWeek, rows, rosters)) weeks.push(week);
  }
  return weeks;
}

export async function buildSeasonPredictionsPayload(
  leagueId: string,
  options: BuildSeasonPredictionsOptions = {},
): Promise<SeasonPredictionsPayload | null> {
  const lineupMode = options.lineupMode ?? "pragmatic";

  const [league, rosters, users, nflState] = await Promise.all([
    fetchSleeperLeague(leagueId),
    fetchSleeperLeagueRosters(leagueId),
    fetchSleeperLeagueUsers(leagueId),
    fetchSleeperNflState(),
  ]);

  if (!league?.league_id || rosters.length === 0) return null;

  const leagueContext = leagueContextFromSleeper(league);
  const regularSeasonWeeks = regularSeasonWeekLimit(league);
  const currentWeek = Math.max(0, nflState?.week ?? 0);
  const projectionSeason =
    league.season || nflState?.league_season || nflState?.season || String(new Date().getFullYear());
  const startingSlots = parseStartingSlots(league.roster_positions);

  const activePlayerIds = collectActiveLineupPlayerIds(rosters);

  const matchupsByWeek = await fetchSeasonRegularMatchups(leagueId, regularSeasonWeeks);

  const projectionWeeks = collectProjectionWeeks(
    matchupsByWeek,
    regularSeasonWeeks,
    currentWeek,
    rosters,
  );

  const projectionFetch = await fetchProjectionWeeksParallel(
    projectionWeeks,
    projectionSeason,
    leagueContext.ppr,
    {
      concurrency: 4,
      relevantPlayerIds: activePlayerIds,
    },
  );

  const positionIndex = buildRosterPositionIndexFromProfile(
    activePlayerIds,
    projectionFetch.mergedPositionHints,
    projectionFetch.mergedRawHints,
  );

  const lineupContext = {
    lineupMode,
    rosterPositions: league.roster_positions ?? [],
    startingSlots,
    positionLookup: toLineupPositionLookup(positionIndex),
    rawPositionLookup: positionIndex.rawPositionByPlayerId,
  };

  const projectionCache = projectionFetch.byWeek;
  const projectionWeeksFetched = projectionWeeks.length;

  const startersByRoster = new Map<number, string[]>();
  const lineupPoolByRoster = new Map<number, string[]>();
  for (const roster of rosters) {
    startersByRoster.set(roster.roster_id, roster.starters ?? []);
    lineupPoolByRoster.set(roster.roster_id, activeLineupPlayerIds(roster));
  }

  const totals = emptyWeekOutcome();
  const matchups: SeasonPredictionMatchup[] = [];
  const nameByRoster = new Map<number, string>();

  for (const roster of rosters) {
    nameByRoster.set(
      roster.roster_id,
      rosterDisplayName(roster.roster_id, users, rosters),
    );
  }

  for (let week = 1; week <= regularSeasonWeeks; week++) {
    const rows = matchupsByWeek.get(week);
    if (!rows?.length) continue;

    const byRoster = matchupByRoster(rows);
    const projections = projectionCache.get(week) ?? new Map<string, number>();
    const pairs = pairMatchups(rows);

    for (const { a, b } of pairs) {
      const rowA = byRoster.get(a.roster_id);
      const rowB = byRoster.get(b.roster_id);

      const resultA = rosterWeekScore(
        week,
        currentWeek,
        rowA,
        startersByRoster.get(a.roster_id),
        lineupPoolByRoster.get(a.roster_id),
        projections,
        lineupContext,
      );
      const resultB = rosterWeekScore(
        week,
        currentWeek,
        rowB,
        startersByRoster.get(b.roster_id),
        lineupPoolByRoster.get(b.roster_id),
        projections,
        lineupContext,
      );

      const winnerRosterId = applyHeadToHeadResult(
        a.roster_id,
        b.roster_id,
        resultA.score,
        resultB.score,
        totals,
      );

      matchups.push({
        week,
        rosterA: a.roster_id,
        rosterB: b.roster_id,
        teamNameA: nameByRoster.get(a.roster_id) ?? `Roster ${a.roster_id}`,
        teamNameB: nameByRoster.get(b.roster_id) ?? `Roster ${b.roster_id}`,
        scoreA: Math.round(resultA.score * 10) / 10,
        scoreB: Math.round(resultB.score * 10) / 10,
        winnerRosterId,
        usedActuals: resultA.usedActuals && resultB.usedActuals,
      });
    }
  }

  const tableRows: SeasonPredictionRow[] = rosters.map((roster) => {
    const wins = totals.wins.get(roster.roster_id) ?? 0;
    const losses = totals.losses.get(roster.roster_id) ?? 0;
    const ties = totals.ties.get(roster.roster_id) ?? 0;
    const pointsFor = Math.round((totals.pointsFor.get(roster.roster_id) ?? 0) * 10) / 10;
    const pointsAgainst =
      Math.round((totals.pointsAgainst.get(roster.roster_id) ?? 0) * 10) / 10;

    return {
      rosterId: roster.roster_id,
      teamName: nameByRoster.get(roster.roster_id) ?? `Roster ${roster.roster_id}`,
      ownerDisplayName: ownerDisplayName(roster, users),
      avatarUrl: rosterAvatarUrl(roster.roster_id, users, rosters),
      projectedWins: wins,
      projectedLosses: losses,
      projectedTies: ties,
      projectedRecord: formatProjectedRecord(wins, losses, ties),
      pointsFor,
      pointsAgainst,
    };
  });

  tableRows.sort((a, b) => {
    if (b.projectedWins !== a.projectedWins) return b.projectedWins - a.projectedWins;
    return b.pointsFor - a.pointsFor;
  });

  return {
    league: {
      league_id: league.league_id,
      name: league.name,
      season: league.season,
      status: league.status,
    },
    rows: tableRows,
    matchups,
    meta: {
      methodologyVersion: methodologyVersionForMode(lineupMode),
      lineupMode,
      leagueContextLabel: formatLeagueContextLabel(leagueContext),
      season: league.season,
      currentWeek,
      regularSeasonWeeks,
      valueNote: valueNoteForMode(lineupMode, currentWeek),
      lastUpdated: new Date().toISOString(),
      projectionWeeksFetched,
    },
  };
}

export { parseLineupMode };
