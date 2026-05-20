import { NextRequest, NextResponse } from "next/server";
import {
  currentNflSeasonYears,
  fetchSleeperUserLeagues,
  isDynastyLeague,
} from "@/lib/sleeper-league-fetch";
import type { SleeperLeague } from "@/lib/sleeper-league-types";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  const seasons = currentNflSeasonYears();
  const lists = await Promise.all(seasons.map((s) => fetchSleeperUserLeagues(userId, s)));
  const byId = new Map<string, SleeperLeague>();
  for (const list of lists) {
    for (const league of list) {
      if (!byId.has(league.league_id)) byId.set(league.league_id, league);
    }
  }

  const leagues = [...byId.values()]
    .filter(isDynastyLeague)
    .map((l) => ({
      league_id: l.league_id,
      name: l.name,
      season: l.season,
      status: l.status,
      total_rosters: l.total_rosters,
    }))
    .sort((a, b) => Number(b.season) - Number(a.season) || a.name.localeCompare(b.name));

  return NextResponse.json({ leagues, seasonsQueried: seasons });
}
