import { NextRequest, NextResponse } from "next/server";
import { catalogBySleeperPlayerId, getModeledPlayerCatalog } from "@/lib/get-modeled-catalog";
import {
  formatLeagueContextLabel,
  leagueContextFromSleeper,
} from "@/lib/league-context-from-sleeper";
import { buildRosterGuidancePayload } from "@/lib/roster-guidance";
import {
  fetchSleeperLeague,
  fetchSleeperLeagueRosters,
  fetchSleeperLeagueUsers,
} from "@/lib/sleeper-league-fetch";

export async function GET(request: NextRequest) {
  const leagueId = request.nextUrl.searchParams.get("league_id")?.trim();
  const rosterIdRaw = request.nextUrl.searchParams.get("roster_id")?.trim();

  if (!leagueId || !rosterIdRaw) {
    return NextResponse.json({ error: "league_id and roster_id are required" }, { status: 400 });
  }

  const rosterId = Number(rosterIdRaw);
  if (!Number.isFinite(rosterId)) {
    return NextResponse.json({ error: "roster_id must be a number" }, { status: 400 });
  }

  const [league, rosters, users] = await Promise.all([
    fetchSleeperLeague(leagueId),
    fetchSleeperLeagueRosters(leagueId),
    fetchSleeperLeagueUsers(leagueId),
  ]);

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const roster = rosters.find((r) => r.roster_id === rosterId);
  if (!roster) {
    return NextResponse.json({ error: "Roster not found in league" }, { status: 404 });
  }

  const leagueContext = leagueContextFromSleeper(league);
  const catalogResult = await getModeledPlayerCatalog(leagueContext);
  if (!catalogResult.ok) {
    return NextResponse.json({ error: catalogResult.error }, { status: 502 });
  }

  const catalogMap = catalogBySleeperPlayerId(catalogResult.assets);
  const guidance = buildRosterGuidancePayload(
    roster,
    rosters,
    catalogMap,
    formatLeagueContextLabel(leagueContext),
    {
      qb: leagueContext.startQb,
      rb: leagueContext.startRb,
      wr: leagueContext.startWr,
      te: leagueContext.startTe,
    },
  );

  const owner = users.find((u) => u.user_id === roster.owner_id);
  const teamName =
    owner?.metadata?.team_name?.trim() ||
    owner?.display_name?.trim() ||
    `Roster ${roster.roster_id}`;

  const unmatched = (roster.players ?? []).filter(
    (id) => id && id !== "0" && !catalogMap.has(id),
  ).length;

  return NextResponse.json({
    league: {
      league_id: league.league_id,
      name: league.name,
      season: league.season,
      status: league.status,
    },
    team: { roster_id: roster.roster_id, name: teamName, owner_id: roster.owner_id },
    leagueContext,
    leagueContextLabel: formatLeagueContextLabel(leagueContext),
    guidance,
    meta: {
      playersOnRoster: roster.players?.length ?? 0,
      playersWithValues: guidance.players.length,
      playersUnmatched: unmatched,
      valueNote:
        "Values use the same fair-trade model as the trade calculator, with league PPR, size, and superflex from Sleeper settings.",
    },
  });
}
