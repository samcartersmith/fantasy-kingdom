import { pairMatchups } from "@/lib/league-history-aggregate";
import {
  formatLeagueContextLabel,
  leagueContextFromSleeper,
} from "@/lib/league-context-from-sleeper";
import {
  buildMatchupAdvice,
  winProbabilityFromProjections,
  type AdvicePlayerLookup,
} from "@/lib/matchup-advice/advice-engine";
import type {
  MatchupPairedRow,
  MatchupPlayerStatus,
  MatchupPlayerTile,
  MatchupAdvicePayload,
  MatchupTeamSummary,
} from "@/lib/matchup-advice/types";
import {
  fetchSleeperWeeklyProjectionRows,
  parseSleeperWeeklyProjectionsFromRows,
  type ProjectionPlayerMeta,
} from "@/lib/season-predictions/fetch-sleeper-projections";
import { hasLeagueScoringSettings } from "@/lib/season-predictions/league-projection-points";
import {
  matchupAdviceAvailableWeeks,
  matchupAdviceWeekScopeNote,
} from "@/lib/matchup-advice/projection-prefetch-weeks";
import {
  optimizeProjectedLineupAssignments,
  parseStartingSlots,
  slotLabel,
  zipSlotAlignedStarters,
} from "@/lib/season-predictions/lineup-optimizer";
import { fetchSleeperNflState } from "@/lib/season-predictions/nfl-state";
import type { SleeperNflState } from "@/lib/season-predictions/nfl-state";
import {
  buildRosterPositionIndexFromProfile,
  toLineupPositionLookup,
} from "@/lib/season-predictions/player-positions";
import {
  formatProjectedRecord,
  rosterWeekUsesActuals,
} from "@/lib/season-predictions/scoring";
import {
  fetchSleeperLeague,
  fetchSleeperLeagueMatchups,
  fetchSleeperLeagueRosters,
  fetchSleeperLeagueUsers,
  regularSeasonWeekLimit,
  rosterAvatarUrl,
  rosterDisplayName,
  rosterOwner,
} from "@/lib/sleeper-league-fetch";
import type { SleeperLeague, SleeperLeagueUser, SleeperMatchup, SleeperRoster } from "@/lib/sleeper-league-types";

function shortPlayerName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]![0]}. ${parts[parts.length - 1]}`;
}

function headshotUrl(playerId: string): string {
  return `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`;
}

function benchPlayerIds(roster: SleeperRoster, starterIds: Set<string>): string[] {
  return (roster.players ?? []).filter((id) => id && id !== "0" && !starterIds.has(id));
}

function starterIdsFromMatchup(
  roster: SleeperRoster,
  matchup: SleeperMatchup | undefined,
): Set<string> {
  const ids = new Set<string>();
  for (const id of matchup?.starters ?? roster.starters ?? []) {
    if (id && id !== "0") ids.add(id);
  }
  return ids;
}

function playerActualPoints(
  playerId: string,
  matchup: SleeperMatchup | undefined,
): number | null {
  const pts = matchup?.players_points?.[playerId];
  if (typeof pts === "number" && Number.isFinite(pts)) return pts;
  return null;
}

function formatGameLabel(meta: ProjectionPlayerMeta | undefined): string | null {
  if (!meta) return null;
  const { gameDate, opponent, position, nflTeam } = meta;
  let datePart = "";
  if (gameDate) {
    const d = new Date(`${gameDate}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      datePart = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "numeric",
        day: "numeric",
      });
    } else {
      datePart = gameDate;
    }
  }
  const vsPart = opponent ? `@ ${opponent}` : null;
  if (datePart && vsPart) return `${datePart} ${vsPart}`;
  if (vsPart) return vsPart;
  if (position && nflTeam) return `${position} · ${nflTeam}`;
  return nflTeam ?? position;
}

function resolvePlayerStatus(
  projected: number | null,
  actual: number | null,
  usesActuals: boolean,
  meta: ProjectionPlayerMeta | undefined,
): { status: MatchupPlayerStatus; statusLabel: string } {
  if (usesActuals && actual != null) {
    return { status: "played", statusLabel: "Final" };
  }
  if (meta?.sleeperStatus && meta.sleeperStatus !== "Active") {
    return { status: "out", statusLabel: meta.sleeperStatus };
  }
  if (projected == null || projected <= 0) {
    return { status: "bye", statusLabel: "Bye / out" };
  }
  return { status: "yet_to_play", statusLabel: "Yet to play" };
}

function buildPlayerTile(
  playerId: string | null,
  playerMeta: Map<string, ProjectionPlayerMeta>,
  projections: Map<string, number>,
  matchup: SleeperMatchup | undefined,
  usesActuals: boolean,
): MatchupPlayerTile | null {
  if (!playerId) return null;
  const meta = playerMeta.get(playerId);
  const name = meta?.name ?? `Player ${playerId}`;
  const projectedRaw = projections.get(playerId);
  const projected =
    projectedRaw != null && projectedRaw > 0 ? Math.round(projectedRaw * 100) / 100 : null;
  const actual = playerActualPoints(playerId, matchup);
  const { status, statusLabel } = resolvePlayerStatus(projected, actual, usesActuals, meta);

  const position = meta?.position ?? null;
  const nflTeam = meta?.nflTeam ?? null;
  const gameLabel = formatGameLabel(meta);

  return {
    playerId,
    name,
    shortName: shortPlayerName(name),
    position,
    nflTeam,
    headshotUrl: headshotUrl(playerId),
    projectedPoints: projected,
    actualPoints: actual,
    status,
    statusLabel,
    gameLabel,
    injuryBadge: meta?.injuryBadge ?? null,
  };
}

function yetToPlaySummary(tiles: MatchupPlayerTile[]): string | null {
  const pending = tiles.filter((t) => t.status === "yet_to_play");
  if (pending.length === 0) return null;
  const counts = new Map<string, number>();
  for (const t of pending) {
    const key = t.position ?? "OTHER";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const parts: string[] = [];
  for (const [pos, count] of counts) {
    parts.push(count > 1 ? `${count} ${pos}` : pos);
  }
  return `Yet to play (${pending.length}): ${parts.join(", ")}`;
}

function findOpponentRosterId(
  yourRosterId: number,
  matchups: SleeperMatchup[],
): { opponentId: number | null; note: string | null } {
  const yours = matchups.find((m) => m.roster_id === yourRosterId);
  if (!yours) {
    return { opponentId: null, note: "No matchup found for this roster this week." };
  }

  const sameGroup = matchups.filter((m) => m.matchup_id === yours.matchup_id);
  if (sameGroup.length > 2) {
    const others = sameGroup.filter((m) => m.roster_id !== yourRosterId);
    if (others.length === 1) {
      return { opponentId: others[0]!.roster_id, note: null };
    }
    return {
      opponentId: others[0]?.roster_id ?? null,
      note: "Multi-team week; showing primary opponent.",
    };
  }

  const pairs = pairMatchups(matchups);
  for (const { a, b } of pairs) {
    if (a.roster_id === yourRosterId) return { opponentId: b.roster_id, note: null };
    if (b.roster_id === yourRosterId) return { opponentId: a.roster_id, note: null };
  }

  return { opponentId: null, note: "No head-to-head opponent this week." };
}

function buildPairedStarterRows(
  yourRoster: SleeperRoster,
  oppRoster: SleeperRoster | null,
  leagueRosterPositions: string[],
  yourMatchup: SleeperMatchup | undefined,
  oppMatchup: SleeperMatchup | undefined,
  playerMeta: Map<string, ProjectionPlayerMeta>,
  projections: Map<string, number>,
  usesActuals: boolean,
): MatchupPairedRow[] {
  const yourAligned = zipSlotAlignedStarters(
    leagueRosterPositions,
    yourMatchup?.starters ?? yourRoster.starters,
  );
  const oppAligned = oppRoster
    ? zipSlotAlignedStarters(leagueRosterPositions, oppMatchup?.starters ?? oppRoster.starters)
    : [];

  const starterRows: MatchupPairedRow[] = yourAligned.map(({ slot, playerId }, i) => ({
    slotLabel: slotLabel(slot),
    section: "starters" as const,
    left: buildPlayerTile(playerId, playerMeta, projections, yourMatchup, usesActuals),
    right: buildPlayerTile(
      oppAligned[i]?.playerId ?? null,
      playerMeta,
      projections,
      oppMatchup,
      usesActuals,
    ),
  }));

  const yourStarterSet = starterIdsFromMatchup(yourRoster, yourMatchup);
  const oppStarterSet = oppRoster ? starterIdsFromMatchup(oppRoster, oppMatchup) : new Set<string>();
  const yourBench = benchPlayerIds(yourRoster, yourStarterSet);
  const oppBench = oppRoster ? benchPlayerIds(oppRoster, oppStarterSet) : [];
  const benchLen = Math.max(yourBench.length, oppBench.length);

  const benchRows: MatchupPairedRow[] = [];
  for (let i = 0; i < benchLen; i++) {
    benchRows.push({
      slotLabel: "BN",
      section: "bench",
      left: buildPlayerTile(yourBench[i] ?? null, playerMeta, projections, yourMatchup, usesActuals),
      right: buildPlayerTile(
        oppBench[i] ?? null,
        playerMeta,
        projections,
        oppMatchup,
        usesActuals,
      ),
    });
  }

  return [...starterRows, ...benchRows];
}

function buildTeamSummary(
  rosterId: number,
  roster: SleeperRoster,
  users: SleeperLeagueUser[],
  rosters: SleeperRoster[],
  matchup: SleeperMatchup | undefined,
  projectedTotal: number,
  starterTiles: MatchupPlayerTile[],
  usesActuals: boolean,
  winProbability: number | null,
): MatchupTeamSummary {
  const owner = rosterOwner(rosterId, users, rosters);
  const actualTotal =
    usesActuals && matchup
      ? Math.round((matchup.custom_points ?? matchup.points ?? 0) * 100) / 100
      : null;

  const wins = roster.settings?.wins;
  const losses = roster.settings?.losses;
  const ties = roster.settings?.ties;
  let record = "0-0";
  if (typeof wins === "number" && typeof losses === "number") {
    record = formatProjectedRecord(wins, losses, typeof ties === "number" ? ties : 0);
  }

  return {
    rosterId,
    teamName: rosterDisplayName(rosterId, users, rosters),
    username: owner?.display_name?.trim() ?? null,
    avatarUrl: rosterAvatarUrl(rosterId, users, rosters) ?? null,
    record,
    projectedTotal: Math.round(projectedTotal * 100) / 100,
    actualTotal,
    winProbability,
    yetToPlaySummary: usesActuals ? null : yetToPlaySummary(starterTiles),
  };
}

export type BuildMatchupAdvicePrefetched = {
  league?: SleeperLeague | null;
  nflState?: SleeperNflState | null;
};

export function matchupAdviceProjectionSeason(
  league: SleeperLeague,
  nflState: SleeperNflState | null,
): string {
  return league.season || nflState?.league_season || nflState?.season || String(new Date().getFullYear());
}

export async function buildMatchupAdvicePayload(
  leagueId: string,
  rosterId: number,
  week: number,
  prefetched?: BuildMatchupAdvicePrefetched,
): Promise<MatchupAdvicePayload | null> {
  const leaguePromise =
    prefetched?.league !== undefined
      ? Promise.resolve(prefetched.league)
      : fetchSleeperLeague(leagueId);
  const nflStatePromise =
    prefetched?.nflState !== undefined
      ? Promise.resolve(prefetched.nflState)
      : fetchSleeperNflState();

  const [league, rosters, users, nflState] = await Promise.all([
    leaguePromise,
    fetchSleeperLeagueRosters(leagueId),
    fetchSleeperLeagueUsers(leagueId),
    nflStatePromise,
  ]);

  if (!league?.league_id || rosters.length === 0) return null;

  const yourRoster = rosters.find((r) => r.roster_id === rosterId);
  if (!yourRoster) return null;
  const leagueContext = leagueContextFromSleeper(league);
  const regularSeasonWeeks = regularSeasonWeekLimit(league);
  const currentWeek = Math.max(0, nflState?.week ?? 0);
  const projectionSeason = matchupAdviceProjectionSeason(league, nflState);

  const [matchups, rawProjectionRows] = await Promise.all([
    fetchSleeperLeagueMatchups(leagueId, week),
    fetchSleeperWeeklyProjectionRows(projectionSeason, week),
  ]);
  const yourMatchup = matchups.find((m) => m.roster_id === rosterId);
  const { opponentId, note: opponentNote } = findOpponentRosterId(rosterId, matchups);
  const oppRoster = opponentId != null ? rosters.find((r) => r.roster_id === opponentId) : null;
  const oppMatchup =
    opponentId != null ? matchups.find((m) => m.roster_id === opponentId) : undefined;

  const usesActuals = rosterWeekUsesActuals(week, currentWeek, yourMatchup);

  const relevantIds = new Set<string>();
  for (const r of [yourRoster, oppRoster].filter(Boolean) as SleeperRoster[]) {
    for (const id of r.players ?? []) {
      if (id && id !== "0") relevantIds.add(id);
    }
  }

  const projectionOptions = {
    ppr: leagueContext.ppr,
    scoringSettings: hasLeagueScoringSettings(league.scoring_settings)
      ? league.scoring_settings
      : undefined,
    relevantPlayerIds: relevantIds,
  };

  const weekProjections = parseSleeperWeeklyProjectionsFromRows(
    rawProjectionRows,
    projectionOptions,
    relevantIds,
  );
  const projections = weekProjections.projections;
  const playerMeta = weekProjections.playerMeta;

  const positionIndex = buildRosterPositionIndexFromProfile(
    relevantIds,
    weekProjections.positionHints,
    weekProjections.rawPositionHints,
  );
  const positionLookup = toLineupPositionLookup(positionIndex);
  const rawPositionLookup = positionIndex.rawPositionByPlayerId;

  const startingSlots = parseStartingSlots(league.roster_positions);
  const yourPool = (yourRoster.players ?? []).filter(Boolean);

  const yourProjectedTotal = usesActuals
    ? yourMatchup
      ? yourMatchup.custom_points ?? yourMatchup.points ?? 0
      : 0
    : optimizeProjectedLineupAssignments(
        yourPool,
        projections,
        startingSlots,
        positionLookup,
        rawPositionLookup,
      ).reduce((sum, a) => sum + (a.playerId ? (projections.get(a.playerId) ?? 0) : 0), 0);

  let opponentProjectedTotal: number | null = null;
  if (oppRoster) {
    opponentProjectedTotal = usesActuals
      ? oppMatchup
        ? oppMatchup.custom_points ?? oppMatchup.points ?? 0
        : 0
      : optimizeProjectedLineupAssignments(
          (oppRoster.players ?? []).filter(Boolean),
          projections,
          startingSlots,
          positionLookup,
          rawPositionLookup,
        ).reduce((sum, a) => sum + (a.playerId ? (projections.get(a.playerId) ?? 0) : 0), 0);
  }

  const winPctYour =
    opponentProjectedTotal != null
      ? winProbabilityFromProjections(yourProjectedTotal, opponentProjectedTotal)
      : null;
  const winPctOpp =
    winPctYour != null ? Math.round((100 - winPctYour) * 10) / 10 : null;

  const pairedRows = buildPairedStarterRows(
    yourRoster,
    oppRoster ?? null,
    league.roster_positions,
    yourMatchup,
    oppMatchup,
    playerMeta,
    projections,
    usesActuals,
  );

  const starterTiles = pairedRows
    .filter((r) => r.section === "starters")
    .map((r) => r.left)
    .filter((t): t is MatchupPlayerTile => t != null);

  const oppStarterTiles = pairedRows
    .filter((r) => r.section === "starters")
    .map((r) => r.right)
    .filter((t): t is MatchupPlayerTile => t != null);

  const currentAssignments = zipSlotAlignedStarters(
    league.roster_positions,
    yourMatchup?.starters ?? yourRoster.starters,
  ).map(({ slot, playerId }) => ({ slot, playerId }));

  const optimalAssignments = optimizeProjectedLineupAssignments(
    yourPool,
    projections,
    startingSlots,
    positionLookup,
    rawPositionLookup,
  );

  const playerLookup: AdvicePlayerLookup = {
    name: (id) => playerMeta.get(id)?.name ?? `Player ${id}`,
    injuryBadge: (id) => playerMeta.get(id)?.injuryBadge ?? null,
    isUnavailable: (id) => {
      const status = playerMeta.get(id)?.sleeperStatus;
      return Boolean(status && status !== "Active");
    },
  };

  const advice = usesActuals
    ? [
        {
          id: "week-complete",
          tone: "neutral" as const,
          title: "Week complete",
          body: "This week has finished. Review actual scores above; lineup suggestions apply to upcoming weeks.",
        },
      ]
    : buildMatchupAdvice({
        yourRosterId: rosterId,
        yourProjectedTotal,
        opponentProjectedTotal,
        currentAssignments,
        optimalAssignments,
        projections,
        playerLookup,
      });

  return {
    league: {
      league_id: league.league_id,
      name: league.name,
      season: league.season,
      status: league.status,
    },
    week,
    currentWeek,
    regularSeasonWeeks,
    usesActuals,
    yourTeam: buildTeamSummary(
      rosterId,
      yourRoster,
      users,
      rosters,
      yourMatchup,
      yourProjectedTotal,
      starterTiles,
      usesActuals,
      winPctYour,
    ),
    opponent: oppRoster
      ? buildTeamSummary(
          opponentId!,
          oppRoster,
          users,
          rosters,
          oppMatchup,
          opponentProjectedTotal ?? 0,
          oppStarterTiles,
          usesActuals,
          winPctOpp,
        )
      : null,
    pairedRows,
    advice,
    availableWeeks: matchupAdviceAvailableWeeks(nflState, regularSeasonWeeks),
    meta: {
      valueNote: `Projections use Sleeper weekly data with ${formatLeagueContextLabel(leagueContext)} scoring. Advice compares your listed starters to the best legal lineup from your roster.`,
      opponentNote,
      weekScopeNote: matchupAdviceWeekScopeNote(nflState),
    },
  };
}
