/**
 * Season predictions diagnostic — same Sleeper fetch + buildSeasonPredictionsPayload as production.
 *
 *   npx tsx scripts/debug-season-predictions.ts --league_id=YOUR_ID --compare-modes
 *   npx tsx scripts/debug-season-predictions.ts --league_id=YOUR_ID --mode=optimal --week=9
 *   npx tsx scripts/debug-season-predictions.ts --league_id=YOUR_ID --team="My Team" --audit-positions
 *
 * Requires network. No Sleeper login.
 */
import { buildSeasonPredictionsPayload } from "@/lib/season-predictions/build-payload";
import {
  playerEligibleForSlot,
  zipSlotAlignedStarters,
  type LineupSlot,
} from "@/lib/season-predictions/lineup-optimizer";
import { fetchProjectionWeeksParallel } from "@/lib/season-predictions/fetch-sleeper-projections";
import { fetchSleeperNflState } from "@/lib/season-predictions/nfl-state";
import {
  buildRosterPositionIndexFromProfile,
  toLineupPositionLookup,
} from "@/lib/season-predictions/player-positions";
import {
  activeLineupPlayerIds,
  collectActiveLineupPlayerIds,
} from "@/lib/season-predictions/roster-pool";
import { rosterWeekUsesActuals } from "@/lib/season-predictions/scoring";
import type { SeasonPredictionMatchup, SeasonPredictionsPayload } from "@/lib/season-predictions/types";
import { leagueContextFromSleeper } from "@/lib/league-context-from-sleeper";
import {
  fetchSeasonRegularMatchups,
  fetchSleeperLeague,
  fetchSleeperLeagueRosters,
  regularSeasonWeekLimit,
} from "@/lib/sleeper-league-fetch";
import type { SleeperRoster } from "@/lib/sleeper-league-types";

type CliArgs = {
  leagueId: string;
  compareModes: boolean;
  mode: "pragmatic" | "optimal";
  week: number | null;
  team: string | null;
  rosterId: number | null;
  auditPositions: boolean;
  json: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  let leagueId = "";
  let compareModes = false;
  let mode: "pragmatic" | "optimal" = "pragmatic";
  let week: number | null = null;
  let team: string | null = null;
  let rosterId: number | null = null;
  let auditPositions = false;
  let json = false;

  for (const raw of argv) {
    if (raw === "--compare-modes") compareModes = true;
    else if (raw === "--audit-positions") auditPositions = true;
    else if (raw === "--json") json = true;
    else if (raw.startsWith("--league_id=")) leagueId = raw.slice("--league_id=".length).trim();
    else if (raw.startsWith("--mode=")) {
      const v = raw.slice("--mode=".length).trim().toLowerCase();
      mode = v === "optimal" ? "optimal" : "pragmatic";
    } else if (raw.startsWith("--week=")) {
      const n = Number(raw.slice("--week=".length));
      if (Number.isFinite(n) && n > 0) week = n;
    } else if (raw.startsWith("--team=")) team = raw.slice("--team=".length).trim();
    else if (raw.startsWith("--roster=")) {
      const n = Number(raw.slice("--roster=".length));
      if (Number.isFinite(n)) rosterId = n;
    }
  }

  return { leagueId, compareModes, mode, week, team, rosterId, auditPositions, json };
}

function usage(): never {
  console.error(`Usage:
  npx tsx scripts/debug-season-predictions.ts --league_id=ID [--compare-modes]
  Options:
    --mode=pragmatic|optimal   Single mode (default pragmatic)
    --compare-modes            Build pragmatic + optimal and diff PF / projection weeks
    --week=N                   Limit week-level output
    --team=NAME                Filter by team or owner display name (substring)
    --roster=ID                Filter by roster_id
    --audit-positions          List pool players missing skill position hints
    --json                     Machine-readable summary on stdout`);
  process.exit(1);
}

function rosterScoreForWeek(
  matchups: SeasonPredictionMatchup[],
  rosterId: number,
  week: number,
): number | null {
  for (const m of matchups) {
    if (m.week !== week) continue;
    if (m.rosterA === rosterId) return m.scoreA;
    if (m.rosterB === rosterId) return m.scoreB;
  }
  return null;
}

function filterRosters(
  payload: SeasonPredictionsPayload,
  team: string | null,
  rosterId: number | null,
): number[] {
  const ids = payload.rows.map((r) => r.rosterId);
  if (rosterId != null) return ids.filter((id) => id === rosterId);
  if (!team) return ids;
  const needle = team.toLowerCase();
  return ids.filter((id) => {
    const row = payload.rows.find((r) => r.rosterId === id);
    if (!row) return false;
    return (
      row.teamName.toLowerCase().includes(needle) ||
      row.ownerDisplayName.toLowerCase().includes(needle)
    );
  });
}

function printLeagueSummary(payload: SeasonPredictionsPayload): void {
  const { league, meta } = payload;
  console.log(`League: ${league.name} (${league.league_id}) — ${league.season} [${league.status}]`);
  console.log(
    `Context: ${meta.leagueContextLabel} | NFL week ${meta.currentWeek} | RS weeks ${meta.regularSeasonWeeks} | projection weeks fetched ${meta.projectionWeeksFetched}`,
  );
  console.log(`Mode: ${meta.lineupMode} (${meta.methodologyVersion})`);
  console.log(meta.valueNote);
  console.log("");
}

function printStandings(payload: SeasonPredictionsPayload, rosterIds: number[]): void {
  console.log("Roster | Record | PF | PA");
  for (const row of payload.rows) {
    if (!rosterIds.includes(row.rosterId)) continue;
    console.log(
      `${row.teamName} (${row.rosterId}) | ${row.projectedRecord} | ${row.pointsFor} | ${row.pointsAgainst}`,
    );
  }
  console.log("");
}

type WeekRegression = {
  rosterId: number;
  teamName: string;
  week: number;
  pragmatic: number;
  optimal: number;
  delta: number;
};

function findOptimalBelowPragmatic(
  pragmatic: SeasonPredictionsPayload,
  optimal: SeasonPredictionsPayload,
  rosterIds: number[],
  weekFilter: number | null,
): WeekRegression[] {
  const out: WeekRegression[] = [];
  const nameByRoster = new Map(pragmatic.rows.map((r) => [r.rosterId, r.teamName]));

  const weeks = new Set<number>();
  for (const m of pragmatic.matchups) weeks.add(m.week);

  for (const week of [...weeks].sort((a, b) => a - b)) {
    if (weekFilter != null && week !== weekFilter) continue;
    const mP = pragmatic.matchups.find((m) => m.week === week);
    const mO = optimal.matchups.find((m) => m.week === week);
    if (!mP || !mO || mP.usedActuals) continue;

    for (const rosterId of rosterIds) {
      const p = rosterScoreForWeek(pragmatic.matchups, rosterId, week);
      const o = rosterScoreForWeek(optimal.matchups, rosterId, week);
      if (p == null || o == null) continue;
      if (o + 1e-6 < p) {
        out.push({
          rosterId,
          teamName: nameByRoster.get(rosterId) ?? `Roster ${rosterId}`,
          week,
          pragmatic: p,
          optimal: o,
          delta: Math.round((o - p) * 10) / 10,
        });
      }
    }
  }
  return out;
}

function pfDelta(
  pragmatic: SeasonPredictionsPayload,
  optimal: SeasonPredictionsPayload,
  rosterId: number,
): number {
  const pRow = pragmatic.rows.find((r) => r.rosterId === rosterId);
  const oRow = optimal.rows.find((r) => r.rosterId === rosterId);
  if (!pRow || !oRow) return 0;
  return Math.round((oRow.pointsFor - pRow.pointsFor) * 10) / 10;
}

function auditPragmaticStarters(
  leagueRosterPositions: string[],
  roster: SleeperRoster,
  positionLookup: Map<string, import("@/lib/sleeper-ranking").SkillPosition[]>,
  rawPositionLookup: Map<string, string | null>,
): string[] {
  const issues: string[] = [];
  const aligned = zipSlotAlignedStarters(leagueRosterPositions, roster.starters);
  const used = new Set<string>();

  for (let i = 0; i < aligned.length; i++) {
    const { slot, playerId } = aligned[i]!;
    if (!playerId) continue;
    const positions = positionLookup.get(playerId) ?? [];
    const rawPosition = rawPositionLookup.get(playerId) ?? null;
    const player = {
      playerId,
      points: 0,
      positions,
      rawPosition,
    };

    if (used.has(playerId)) {
      issues.push(`duplicate starter player ${playerId} in slot ${slotLabel(slot)}`);
      continue;
    }
    if (!playerEligibleForSlot(player, slot)) {
      issues.push(
        `illegal starter ${playerId} for ${slotLabel(slot)} (skill=${positions.join("/") || "—"}, raw=${rawPosition ?? "—"})`,
      );
      continue;
    }
    used.add(playerId);
  }
  return issues;
}

function slotLabel(slot: LineupSlot): string {
  return slot.kind;
}

async function runPositionAudit(leagueId: string, rosterIds: number[]): Promise<void> {
  const [league, rosters, nflState] = await Promise.all([
    fetchSleeperLeague(leagueId),
    fetchSleeperLeagueRosters(leagueId),
    fetchSleeperNflState(),
  ]);
  if (!league) {
    console.error("League not found");
    return;
  }

  const leagueContext = leagueContextFromSleeper(league);
  const regularSeasonWeeks = regularSeasonWeekLimit(league);
  const currentWeek = Math.max(0, nflState?.week ?? 0);
  const projectionSeason =
    league.season || nflState?.league_season || nflState?.season || String(new Date().getFullYear());
  const activePlayerIds = collectActiveLineupPlayerIds(rosters);

  const matchupsByWeek = await fetchSeasonRegularMatchups(leagueId, regularSeasonWeeks);
  const projectionWeeks: number[] = [];
  for (let week = 1; week <= regularSeasonWeeks; week++) {
    const rows = matchupsByWeek.get(week);
    if (!rows?.length) continue;
    const byRoster = new Map(rows.map((r) => [r.roster_id, r]));
    for (const roster of rosters) {
      const row = byRoster.get(roster.roster_id);
      if (!rosterWeekUsesActuals(week, currentWeek, row)) {
        projectionWeeks.push(week);
        break;
      }
    }
  }

  const projectionFetch = await fetchProjectionWeeksParallel(projectionWeeks, projectionSeason, {
    concurrency: 4,
    relevantPlayerIds: activePlayerIds,
    scoringSettings: league.scoring_settings ?? {},
    ppr: leagueContext.ppr,
  });

  const positionIndex = buildRosterPositionIndexFromProfile(
    activePlayerIds,
    projectionFetch.mergedPositionHints,
    projectionFetch.mergedRawHints,
  );
  const positionLookup = toLineupPositionLookup(positionIndex);
  const rosterPositions = league.roster_positions ?? [];

  console.log("--- Position audit (active lineup pool) ---");
  for (const roster of rosters) {
    if (rosterIds.length && !rosterIds.includes(roster.roster_id)) continue;
    const pool = activeLineupPlayerIds(roster);
    const missing: string[] = [];

    for (const id of pool) {
      const skill = positionIndex.skillByPlayerId.get(id) ?? [];
      const raw = positionIndex.rawPositionByPlayerId.get(id) ?? null;
      if (skill.length === 0 && !raw) missing.push(id);
    }

    const starterIssues = auditPragmaticStarters(
      rosterPositions,
      roster,
      positionLookup,
      positionIndex.rawPositionByPlayerId,
    );

    if (missing.length || starterIssues.length) {
      console.log(`\nRoster ${roster.roster_id}:`);
      if (missing.length) {
        console.log(`  Missing position hints (${missing.length}): ${missing.slice(0, 12).join(", ")}${missing.length > 12 ? "…" : ""}`);
      }
      for (const issue of starterIssues) console.log(`  Sleeper starter: ${issue}`);
    }
  }
  console.log("");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.leagueId) usage();

  const modes: Array<"pragmatic" | "optimal"> = args.compareModes
    ? ["pragmatic", "optimal"]
    : [args.mode];

  const payloads: Partial<Record<"pragmatic" | "optimal", SeasonPredictionsPayload>> = {};

  for (const mode of modes) {
    const payload = await buildSeasonPredictionsPayload(args.leagueId, { lineupMode: mode });
    if (!payload) {
      console.error("Failed to load league or rosters (404). Check league_id.");
      process.exit(2);
    }
    payloads[mode] = payload;
  }

  const primary = payloads[modes[modes.length - 1]!]!;
  let rosterIds = filterRosters(primary, args.team, args.rosterId);
  if (args.team && rosterIds.length === 0) {
    console.error(`No roster matched --team=${args.team}`);
    process.exit(2);
  }

  if (args.json) {
    const summary = {
      leagueId: args.leagueId,
      compareModes: args.compareModes,
      meta: primary.meta,
      rows: primary.rows.filter((r) => !rosterIds.length || rosterIds.includes(r.rosterId)),
      compare:
        args.compareModes && payloads.pragmatic && payloads.optimal
          ? rosterIds.map((id) => ({
              rosterId: id,
              pfDelta: pfDelta(payloads.pragmatic!, payloads.optimal!, id),
            }))
          : undefined,
    };
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (args.compareModes && payloads.pragmatic && payloads.optimal) {
    printLeagueSummary(payloads.pragmatic);
    console.log("--- Standings: pragmatic (default) ---");
    printStandings(payloads.pragmatic, rosterIds.length ? rosterIds : payloads.pragmatic.rows.map((r) => r.rosterId));
    console.log("--- Standings: optimal ---");
    printStandings(payloads.optimal, rosterIds.length ? rosterIds : payloads.optimal.rows.map((r) => r.rosterId));

    console.log("--- PF delta (optimal − pragmatic) ---");
    const allIds = rosterIds.length
      ? rosterIds
      : payloads.pragmatic.rows.map((r) => r.rosterId);
    for (const id of allIds) {
      const row = payloads.pragmatic.rows.find((r) => r.rosterId === id)!;
      const delta = pfDelta(payloads.pragmatic, payloads.optimal, id);
      const flag = delta < -0.05 ? " ⚠ optimal PF lower" : "";
      console.log(`${row.teamName} (${id}): ${delta >= 0 ? "+" : ""}${delta}${flag}`);
    }
    console.log("");

    const regressions = findOptimalBelowPragmatic(
      payloads.pragmatic,
      payloads.optimal,
      allIds,
      args.week,
    );
    if (regressions.length) {
      console.log("--- ⚠ Optimal score < pragmatic (projection weeks only) ---");
      for (const r of regressions) {
        console.log(
          `Week ${r.week} | ${r.teamName} (${r.rosterId}): pragmatic ${r.pragmatic} → optimal ${r.optimal} (${r.delta})`,
        );
      }
      console.log("");
    } else {
      console.log("No projection weeks where optimal < pragmatic for filtered rosters.\n");
    }

    if (args.week != null) {
      console.log(`--- Week ${args.week} scores (projection weeks: optimal vs pragmatic) ---`);
      const mP = payloads.pragmatic.matchups.find((m) => m.week === args.week);
      if (mP?.usedActuals) {
        console.log("Week uses actual Sleeper scores (modes should match).\n");
      } else {
        for (const id of allIds) {
          const p = rosterScoreForWeek(payloads.pragmatic.matchups, id, args.week);
          const o = rosterScoreForWeek(payloads.optimal.matchups, id, args.week);
          const row = payloads.pragmatic.rows.find((r) => r.rosterId === id);
          if (p == null || o == null) continue;
          console.log(
            `${row?.teamName ?? id}: pragmatic ${p} | optimal ${o} | Δ ${Math.round((o - p) * 10) / 10}`,
          );
        }
        console.log("");
      }
    }
  } else {
    printLeagueSummary(primary);
    printStandings(primary, rosterIds.length ? rosterIds : primary.rows.map((r) => r.rosterId));

    if (args.week != null) {
      console.log(`--- Week ${args.week} matchups ---`);
      for (const m of primary.matchups.filter((x) => x.week === args.week)) {
        const show =
          !rosterIds.length || rosterIds.includes(m.rosterA) || rosterIds.includes(m.rosterB);
        if (!show) continue;
        console.log(
          `${m.teamNameA} ${m.scoreA} vs ${m.teamNameB} ${m.scoreB}${m.usedActuals ? " (actuals)" : " (projected)"}`,
        );
      }
      console.log("");
    }
  }

  if (args.auditPositions) {
    await runPositionAudit(args.leagueId, rosterIds);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
