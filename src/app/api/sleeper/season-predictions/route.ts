import { NextRequest, NextResponse } from "next/server";
import { buildSeasonPredictionsPayload } from "@/lib/season-predictions/build-payload";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const leagueId = request.nextUrl.searchParams.get("league_id")?.trim();
  if (!leagueId) {
    return NextResponse.json({ error: "league_id is required" }, { status: 400 });
  }

  try {
    const payload = await buildSeasonPredictionsPayload(leagueId);
    if (!payload) {
      return NextResponse.json({ error: "League or roster data not found" }, { status: 404 });
    }
    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to build season predictions";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
