import {
  accumulateMatchupWeek,
  buildChartsFromAccumulators,
  mergeChampionship,
  pairMatchups,
  resolveChampionFromBracket,
  rosterIdsInBracket,
  type LeagueHistoryCharts,
  type ManagerRow,
  type NuclearWeekRow,
} from "@/lib/league-history-aggregate";
import {
  fetchLeagueHistoryChain,
  fetchSeasonRegularMatchups,
  fetchSleeperDraftPicks,
  fetchSleeperLeague,
  fetchSleeperLeagueDrafts,
  fetchSleeperLeagueRosters,
  fetchSleeperLeagueUsers,
  fetchSleeperWinnersBracket,
  regularSeasonWeekLimit,
  rosterDisplayName,
} from "@/lib/sleeper-league-fetch";

export type LeagueHistoryPayload = {
  league: {
    name: string;
    currentSeason: string;
    seasons: { league_id: string; season: string }[];
  };
  managers: Record<string, ManagerRow>;
  charts: LeagueHistoryCharts;
  meta: {
    seasonsScanned: number;
    weeksFetched: number;
    dataNote: string;
  };
};

export async function buildLeagueHistoryPayload(startLeagueId: string): Promise<LeagueHistoryPayload | null> {
  const startLeague = await fetchSleeperLeague(startLeagueId);
  if (!startLeague) return null;

  const chain = await fetchLeagueHistoryChain(startLeagueId);
  const nameByRoster = new Map<number, string>();
  const championships = new Map<number, { count: number; seasons: string[] }>();
  const wins = new Map<number, number>();
  const losses = new Map<number, number>();
  const ties = new Map<number, number>();
  const points = new Map<number, number>();
  const nuclearCandidates: NuclearWeekRow[] = [];
  const playoffAppearances = new Map<number, number>();
  const firstRoundPicks = new Map<number, number>();
  let weeksFetched = 0;

  for (const seasonEntry of chain) {
    const league = await fetchSleeperLeague(seasonEntry.league_id);
    if (!league) continue;

    const [users, rosters, bracket, drafts] = await Promise.all([
      fetchSleeperLeagueUsers(seasonEntry.league_id),
      fetchSleeperLeagueRosters(seasonEntry.league_id),
      fetchSleeperWinnersBracket(seasonEntry.league_id),
      fetchSleeperLeagueDrafts(seasonEntry.league_id),
    ]);

    for (const r of rosters) {
      if (!nameByRoster.has(r.roster_id)) {
        nameByRoster.set(r.roster_id, rosterDisplayName(r.roster_id, users, rosters));
      }
    }

    const championId = resolveChampionFromBracket(bracket);
    if (championId != null) {
      mergeChampionship(championships, championId, seasonEntry.season);
    }

    for (const rid of rosterIdsInBracket(bracket)) {
      playoffAppearances.set(rid, (playoffAppearances.get(rid) ?? 0) + 1);
    }

    for (const draft of drafts) {
      const picks = await fetchSleeperDraftPicks(draft.draft_id);
      for (const pick of picks) {
        if (pick.round === 1) {
          firstRoundPicks.set(pick.roster_id, (firstRoundPicks.get(pick.roster_id) ?? 0) + 1);
        }
      }
    }

    const maxWeek = regularSeasonWeekLimit(league);
    const matchupsByWeek = await fetchSeasonRegularMatchups(seasonEntry.league_id, maxWeek);
    for (const [week, rows] of matchupsByWeek) {
      weeksFetched += 1;
      const pairs = pairMatchups(rows);
      accumulateMatchupWeek(
        pairs,
        wins,
        losses,
        ties,
        points,
        nuclearCandidates,
        seasonEntry.season,
        week,
        nameByRoster,
      );
    }
  }

  const charts = buildChartsFromAccumulators(
    nameByRoster,
    championships,
    wins,
    losses,
    ties,
    points,
    nuclearCandidates,
    playoffAppearances,
    firstRoundPicks,
  );

  const managers: Record<string, ManagerRow> = {};
  for (const [roster_id, name] of nameByRoster) {
    managers[String(roster_id)] = { roster_id, name };
  }

  return {
    league: {
      name: startLeague.name,
      currentSeason: startLeague.season,
      seasons: chain.map((s) => ({ league_id: s.league_id, season: s.season })),
    },
    managers,
    charts,
    meta: {
      seasonsScanned: chain.length,
      weeksFetched,
      dataNote:
        "Stats from Sleeper public matchups and playoff brackets. Team weekly scores only (Sleeper does not expose per-player weekly points in matchups). Championships use the final winners bracket when recorded.",
    },
  };
}
