import type { SleeperBracketMatch, SleeperMatchup } from "@/lib/sleeper-league-types";

export type ManagerRow = {
  roster_id: number;
  name: string;
};

export type ChampionshipRow = {
  roster_id: number;
  name: string;
  count: number;
  seasons: string[];
};

export type WinLossRow = {
  roster_id: number;
  name: string;
  wins: number;
  losses: number;
  ties: number;
};

export type PointsRow = {
  roster_id: number;
  name: string;
  points: number;
};

export type NuclearWeekRow = {
  roster_id: number;
  name: string;
  points: number;
  week: number;
  season: string;
};

export type PlayoffAppearanceRow = {
  roster_id: number;
  name: string;
  count: number;
};

export type FirstRoundPickRow = {
  roster_id: number;
  name: string;
  count: number;
};

export type LeagueHistoryCharts = {
  championships: ChampionshipRow[];
  regularSeasonWins: WinLossRow[];
  allTimePoints: PointsRow[];
  nuclearWeeks: NuclearWeekRow[];
  playoffAppearances: PlayoffAppearanceRow[];
  firstRoundPicks: FirstRoundPickRow[];
};

export function resolveChampionFromBracket(bracket: SleeperBracketMatch[]): number | null {
  if (bracket.length === 0) return null;
  const withWinner = bracket.filter((m) => m.w != null && Number.isFinite(m.w));
  if (withWinner.length === 0) return null;
  const finalRound = Math.max(...withWinner.map((m) => m.r));
  const finals = withWinner.filter((m) => m.r === finalRound);
  const championship = finals.find((m) => m.p === 1) ?? finals[finals.length - 1];
  return championship?.w ?? null;
}

export function rosterIdsInBracket(bracket: SleeperBracketMatch[]): Set<number> {
  const ids = new Set<number>();
  for (const m of bracket) {
    if (typeof m.t1 === "number") ids.add(m.t1);
    if (typeof m.t2 === "number") ids.add(m.t2);
    if (m.w != null) ids.add(m.w);
    if (m.l != null) ids.add(m.l);
  }
  return ids;
}

type MatchupPair = { a: SleeperMatchup; b: SleeperMatchup };

export function pairMatchups(rows: SleeperMatchup[]): MatchupPair[] {
  const byMatchId = new Map<number, SleeperMatchup[]>();
  for (const row of rows) {
    const list = byMatchId.get(row.matchup_id) ?? [];
    list.push(row);
    byMatchId.set(row.matchup_id, list);
  }
  const pairs: MatchupPair[] = [];
  for (const group of byMatchId.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        pairs.push({ a: group[i]!, b: group[j]! });
      }
    }
  }
  return pairs;
}

export function effectiveMatchupPoints(m: SleeperMatchup): number {
  const custom = m.custom_points;
  if (typeof custom === "number" && Number.isFinite(custom)) return custom;
  return typeof m.points === "number" && Number.isFinite(m.points) ? m.points : 0;
}

export function accumulateMatchupWeek(
  pairs: MatchupPair[],
  wins: Map<number, number>,
  losses: Map<number, number>,
  ties: Map<number, number>,
  points: Map<number, number>,
  nuclearCandidates: NuclearWeekRow[],
  season: string,
  week: number,
  nameByRoster: Map<number, string>,
): void {
  for (const { a, b } of pairs) {
    const pa = effectiveMatchupPoints(a);
    const pb = effectiveMatchupPoints(b);
    points.set(a.roster_id, (points.get(a.roster_id) ?? 0) + pa);
    points.set(b.roster_id, (points.get(b.roster_id) ?? 0) + pb);

    nuclearCandidates.push({
      roster_id: a.roster_id,
      name: nameByRoster.get(a.roster_id) ?? `Roster ${a.roster_id}`,
      points: pa,
      week,
      season,
    });
    nuclearCandidates.push({
      roster_id: b.roster_id,
      name: nameByRoster.get(b.roster_id) ?? `Roster ${b.roster_id}`,
      points: pb,
      week,
      season,
    });

    if (pa > pb) {
      wins.set(a.roster_id, (wins.get(a.roster_id) ?? 0) + 1);
      losses.set(b.roster_id, (losses.get(b.roster_id) ?? 0) + 1);
    } else if (pb > pa) {
      wins.set(b.roster_id, (wins.get(b.roster_id) ?? 0) + 1);
      losses.set(a.roster_id, (losses.get(a.roster_id) ?? 0) + 1);
    } else {
      ties.set(a.roster_id, (ties.get(a.roster_id) ?? 0) + 1);
      ties.set(b.roster_id, (ties.get(b.roster_id) ?? 0) + 1);
    }
  }
}

export function mergeChampionship(
  championships: Map<number, { count: number; seasons: string[] }>,
  rosterId: number,
  season: string,
): void {
  const cur = championships.get(rosterId) ?? { count: 0, seasons: [] };
  cur.count += 1;
  cur.seasons.push(season);
  championships.set(rosterId, cur);
}

export function buildChartsFromAccumulators(
  nameByRoster: Map<number, string>,
  championships: Map<number, { count: number; seasons: string[] }>,
  wins: Map<number, number>,
  losses: Map<number, number>,
  ties: Map<number, number>,
  points: Map<number, number>,
  nuclearCandidates: NuclearWeekRow[],
  playoffAppearances: Map<number, number>,
  firstRoundPicks: Map<number, number>,
): LeagueHistoryCharts {
  const allRosterIds = new Set<number>([
    ...nameByRoster.keys(),
    ...championships.keys(),
    ...wins.keys(),
    ...points.keys(),
  ]);

  const championshipsRows: ChampionshipRow[] = [...championships.entries()]
    .map(([roster_id, { count, seasons }]) => ({
      roster_id,
      name: nameByRoster.get(roster_id) ?? `Roster ${roster_id}`,
      count,
      seasons: [...seasons].sort((a, b) => Number(b) - Number(a)),
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const regularSeasonWins: WinLossRow[] = [...allRosterIds]
    .map((roster_id) => ({
      roster_id,
      name: nameByRoster.get(roster_id) ?? `Roster ${roster_id}`,
      wins: wins.get(roster_id) ?? 0,
      losses: losses.get(roster_id) ?? 0,
      ties: ties.get(roster_id) ?? 0,
    }))
    .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));

  const allTimePoints: PointsRow[] = [...allRosterIds]
    .map((roster_id) => ({
      roster_id,
      name: nameByRoster.get(roster_id) ?? `Roster ${roster_id}`,
      points: Math.round((points.get(roster_id) ?? 0) * 10) / 10,
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  const nuclearWeeks = [...nuclearCandidates]
    .sort((a, b) => b.points - a.points || Number(b.season) - Number(a.season))
    .slice(0, 10);

  const playoffAppearanceRows: PlayoffAppearanceRow[] = [...playoffAppearances.entries()]
    .map(([roster_id, count]) => ({
      roster_id,
      name: nameByRoster.get(roster_id) ?? `Roster ${roster_id}`,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const firstRoundPickRows: FirstRoundPickRow[] = [...firstRoundPicks.entries()]
    .map(([roster_id, count]) => ({
      roster_id,
      name: nameByRoster.get(roster_id) ?? `Roster ${roster_id}`,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    championships: championshipsRows,
    regularSeasonWins,
    allTimePoints,
    nuclearWeeks,
    playoffAppearances: playoffAppearanceRows,
    firstRoundPicks: firstRoundPickRows,
  };
}
