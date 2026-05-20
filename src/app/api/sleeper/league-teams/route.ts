import { NextRequest, NextResponse } from "next/server";
import { fetchSleeperLeague, fetchSleeperLeagueRosters, fetchSleeperLeagueUsers } from "@/lib/sleeper-league-fetch";

export async function GET(request: NextRequest) {
  const leagueId = request.nextUrl.searchParams.get("league_id")?.trim();
  if (!leagueId) {
    return NextResponse.json({ error: "league_id is required" }, { status: 400 });
  }

  const [league, rosters, users] = await Promise.all([
    fetchSleeperLeague(leagueId),
    fetchSleeperLeagueRosters(leagueId),
    fetchSleeperLeagueUsers(leagueId),
  ]);

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const userById = new Map(users.map((u) => [u.user_id, u]));
  const teams = rosters.map((r) => {
    const owner = r.owner_id ? userById.get(r.owner_id) : undefined;
    const name =
      owner?.metadata?.team_name?.trim() ||
      owner?.display_name?.trim() ||
      `Roster ${r.roster_id}`;
    return {
      roster_id: r.roster_id,
      owner_id: r.owner_id,
      name,
      player_count: (r.players ?? []).filter((id) => id && id !== "0").length,
    };
  });

  teams.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    league: {
      league_id: league.league_id,
      name: league.name,
      season: league.season,
      status: league.status,
      total_rosters: league.total_rosters,
    },
    teams,
  });
}
