/**
 * Trace optimal projected lineup for one roster/week.
 * Usage: npx tsx scripts/trace-optimal-lineup.ts --league_id=ID --roster=1 --week=2
 */
import {
  fetchSleeperLeague,
  fetchSleeperLeagueRosters,
  fetchSleeperLeagueUsers,
  rosterDisplayName,
} from "@/lib/sleeper-league-fetch";
import { leagueContextFromSleeper } from "@/lib/league-context-from-sleeper";
import { fetchSleeperWeeklyProjectionsWithHints } from "@/lib/season-predictions/fetch-sleeper-projections";
import {
  activeLineupPlayerIds,
  collectActiveLineupPlayerIds,
} from "@/lib/season-predictions/roster-pool";
import {
  buildRosterPositionIndexFromProfile,
  toLineupPositionLookup,
} from "@/lib/season-predictions/player-positions";
import {
  optimizeProjectedLineupScore,
  parseStartingSlots,
  playerEligibleForSlot,
  type LineupPlayer,
  type LineupSlot,
} from "@/lib/season-predictions/lineup-optimizer";

function slotSortKey(slot: LineupSlot): number {
  switch (slot.kind) {
    case "QB":
      return 0;
    case "TE":
      return 1;
    case "K":
      return 2;
    case "DEF":
      return 3;
    case "RB":
      return 4;
    case "WR":
      return 5;
    case "REC_FLEX":
      return 6;
    case "WRRB_FLEX":
      return 7;
    case "FLEX":
      return 8;
    case "SUPER_FLEX":
      return 9;
    case "IDP":
      return 10;
    default:
      return 11;
  }
}

function buildLineupPlayers(
  rosterPlayerIds: string[] | null | undefined,
  projections: Map<string, number>,
  positionLookup: Map<string, import("@/lib/sleeper-ranking").SkillPosition[]>,
  rawPositionLookup: Map<string, string | null>,
): LineupPlayer[] {
  if (!rosterPlayerIds?.length) return [];
  const out: LineupPlayer[] = [];
  for (const playerId of rosterPlayerIds) {
    if (!playerId) continue;
    const positions = positionLookup.get(playerId) ?? [];
    const rawPosition = rawPositionLookup.get(playerId) ?? null;
    const points = projections.get(playerId) ?? 0;
    if (points <= 0) continue;
    out.push({ playerId, points, positions, rawPosition });
  }
  return out;
}
import { rosterWeekScore } from "@/lib/season-predictions/scoring";
import { fetchSleeperNflState } from "@/lib/season-predictions/nfl-state";

function parseArgs(argv: string[]): { leagueId: string; rosterId: number; week: number } {
  let leagueId = "";
  let rosterId = 1;
  let week = 1;
  for (const raw of argv) {
    if (raw.startsWith("--league_id=")) leagueId = raw.slice("--league_id=".length).trim();
    if (raw.startsWith("--roster=")) rosterId = Number(raw.slice("--roster=".length));
    if (raw.startsWith("--week=")) week = Number(raw.slice("--week=".length));
  }
  if (!leagueId) {
    console.error("Usage: --league_id=... --roster=1 --week=2");
    process.exit(1);
  }
  return { leagueId, rosterId, week };
}

function assignLineupDfsWithLineup(
  slots: LineupSlot[],
  players: LineupPlayer[],
  slotIndex: number,
  used: Set<string>,
  current: Map<number, string>,
): { score: number; lineup: Map<number, string> } {
  if (slotIndex >= slots.length) {
    return { score: 0, lineup: new Map(current) };
  }

  const slot = slots[slotIndex]!;
  let best = assignLineupDfsWithLineup(slots, players, slotIndex + 1, used, current);

  const candidates = players
    .filter((p) => !used.has(p.playerId) && playerEligibleForSlot(p, slot))
    .sort((a, b) => b.points - a.points);

  for (const p of candidates) {
    used.add(p.playerId);
    current.set(slotIndex, p.playerId);
    const next = assignLineupDfsWithLineup(slots, players, slotIndex + 1, used, current);
    const total = p.points + next.score;
    if (total > best.score) {
      best = { score: total, lineup: new Map(next.lineup) };
    }
    used.delete(p.playerId);
    current.delete(slotIndex);
  }

  return best;
}

function optimizeLineupWithAssignments(
  pool: string[],
  projections: Map<string, number>,
  startingSlots: LineupSlot[],
  positionLookup: Map<string, import("@/lib/sleeper-ranking").SkillPosition[]>,
  rawLookup: Map<string, string | null>,
): { score: number; assignments: { slot: LineupSlot; playerId: string | null; pts: number }[] } {
  const players = buildLineupPlayers(pool, projections, positionLookup, rawLookup);
  const orderedSlots = [...startingSlots].sort((a, b) => slotSortKey(a) - slotSortKey(b));
  const { score, lineup } = assignLineupDfsWithLineup(orderedSlots, players, 0, new Set(), new Map());

  const assignments = orderedSlots.map((slot, i) => {
    const playerId = lineup.get(i) ?? null;
    return {
      slot,
      playerId,
      pts: playerId ? (projections.get(playerId) ?? 0) : 0,
    };
  });

  return { score, assignments };
}

const TEAM_DEF_NAMES: Record<string, string> = {
  SF: "49ers DEF",
  JAX: "Jaguars DEF",
  KC: "Chiefs DEF",
};

async function fetchPlayerNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const id of ids) {
    if (TEAM_DEF_NAMES[id]) names.set(id, TEAM_DEF_NAMES[id]);
  }
  return names;
}

async function main() {
  const { leagueId, rosterId, week } = parseArgs(process.argv.slice(2));

  const [league, rosters, users, nflState] = await Promise.all([
    fetchSleeperLeague(leagueId),
    fetchSleeperLeagueRosters(leagueId),
    fetchSleeperLeagueUsers(leagueId),
    fetchSleeperNflState(),
  ]);
  const roster = rosters.find((r) => r.roster_id === rosterId);
  if (!league || !roster) {
    console.error("League or roster not found");
    process.exit(2);
  }

  const ctx = leagueContextFromSleeper(league);
  const season = league.season || nflState?.league_season || "2026";
  const pool = activeLineupPlayerIds(roster);
  const activeIds = collectActiveLineupPlayerIds(rosters);
  const proj = await fetchSleeperWeeklyProjectionsWithHints(season, week, {
    ppr: ctx.ppr,
    scoringSettings: league.scoring_settings ?? {},
    relevantPlayerIds: activeIds,
  });
  const posIndex = buildRosterPositionIndexFromProfile(
    activeIds,
    proj.positionHints,
    proj.rawPositionHints,
  );
  const posLookup = toLineupPositionLookup(posIndex);
  const rawLookup = posIndex.rawPositionByPlayerId;
  const slots = parseStartingSlots(league.roster_positions);

  const { score, assignments } = optimizeLineupWithAssignments(
    pool,
    proj.projections,
    slots,
    posLookup,
    rawLookup,
  );
  const optimizerOnly = optimizeProjectedLineupScore(
    pool,
    proj.projections,
    slots,
    posLookup,
    rawLookup,
  );

  const lineupContext = {
    lineupMode: "optimal" as const,
    rosterPositions: league.roster_positions ?? [],
    startingSlots: slots,
    positionLookup: posLookup,
    rawPositionLookup: rawLookup,
  };
  const viaScoring = rosterWeekScore(week, nflState?.week ?? 0, undefined, roster.starters, pool, proj.projections, lineupContext);

  const ids = assignments.map((a) => a.playerId).filter(Boolean) as string[];
  const names = await fetchPlayerNames(ids);

  console.log(`Team: ${rosterDisplayName(rosterId, users, rosters)} (roster ${rosterId})`);
  console.log(`Week ${week} | Half PPR projections | season ${season}`);
  const rounded = Math.round(score * 10) / 10;
  console.log(`Optimal score (rounded, as shown in UI): ${rounded}`);
  console.log(`Traced optimal score (raw): ${score}`);
  console.log(`optimizeProjectedLineupScore: ${optimizerOnly}`);
  console.log(`rosterWeekScore path: ${viaScoring.score}`);
  console.log("");

  console.log("Optimal lineup (DFS slot order):");
  let sum = 0;
  for (const { slot, playerId, pts } of assignments) {
    sum += pts;
    const label = playerId
      ? `${names.get(playerId) ?? playerId} (${playerId})`
      : "(empty)";
    const skill = playerId ? (posLookup.get(playerId) ?? []).join("/") || "—" : "";
    console.log(
      `  ${slot.kind.padEnd(12)} ${label.padEnd(36)} ${pts.toFixed(2)} pts  [${skill}]`,
    );
  }
  console.log(`  ${"TOTAL".padEnd(12)} ${"".padEnd(36)} ${sum.toFixed(2)} pts`);
  console.log("");

  console.log("Sleeper listed starters (week-agnostic):");
  const starters = roster.starters ?? [];
  for (let i = 0; i < (league.roster_positions?.length ?? 0); i++) {
    const pos = league.roster_positions![i];
    if (pos === "BN" || pos === "IR" || pos === "TAXI") continue;
    const id = starters[i];
    if (!id) continue;
    const pts = proj.projections.get(id) ?? 0;
    console.log(`  ${pos}: ${names.get(id) ?? id} — ${pts.toFixed(2)} proj`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
