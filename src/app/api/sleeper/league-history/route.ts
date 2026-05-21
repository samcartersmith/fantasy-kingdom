import { NextRequest, NextResponse } from "next/server";
import { buildLeagueHistoryPayload } from "@/lib/league-history-build";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const leagueId = request.nextUrl.searchParams.get("league_id")?.trim();
  if (!leagueId) {
    return NextResponse.json({ error: "league_id is required" }, { status: 400 });
  }

  try {
    const payload = await buildLeagueHistoryPayload(leagueId);
    if (!payload) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }
    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to build league history";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
