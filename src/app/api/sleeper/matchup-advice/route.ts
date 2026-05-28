import { after, NextRequest, NextResponse } from "next/server";
import {
  buildMatchupAdvicePayload,
  matchupAdviceProjectionSeason,
} from "@/lib/matchup-advice/build-payload";
import {
  isMatchupAdviceWeekAllowed,
  matchupAdviceDefaultWeek,
  matchupAdviceProjectionPrefetchWeeks,
} from "@/lib/matchup-advice/projection-prefetch-weeks";
import { prefetchProjectionWeekRows } from "@/lib/season-predictions/fetch-sleeper-projections";
import { fetchSleeperNflState } from "@/lib/season-predictions/nfl-state";
import {
  fetchSleeperLeague,
  regularSeasonWeekLimit,
} from "@/lib/sleeper-league-fetch";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const leagueId = request.nextUrl.searchParams.get("league_id")?.trim();
  const rosterIdRaw = request.nextUrl.searchParams.get("roster_id")?.trim();
  const weekRaw = request.nextUrl.searchParams.get("week")?.trim();

  if (!leagueId || !rosterIdRaw) {
    return NextResponse.json({ error: "league_id and roster_id are required" }, { status: 400 });
  }

  const rosterId = Number(rosterIdRaw);
  if (!Number.isFinite(rosterId)) {
    return NextResponse.json({ error: "roster_id must be a number" }, { status: 400 });
  }

  try {
    const [league, nflState] = await Promise.all([
      fetchSleeperLeague(leagueId),
      fetchSleeperNflState(),
    ]);

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const regularSeasonWeeks = regularSeasonWeekLimit(league);
    const defaultWeek = matchupAdviceDefaultWeek(nflState, regularSeasonWeeks);
    const week = weekRaw ? Number(weekRaw) : defaultWeek;

    if (!Number.isFinite(week) || week < 1 || week > regularSeasonWeeks) {
      return NextResponse.json(
        { error: `week must be between 1 and ${regularSeasonWeeks}` },
        { status: 400 },
      );
    }

    if (!isMatchupAdviceWeekAllowed(nflState, week, regularSeasonWeeks)) {
      return NextResponse.json(
        { error: "This week is outside the available projection window for matchup advice." },
        { status: 400 },
      );
    }

    const payload = await buildMatchupAdvicePayload(leagueId, rosterId, week, {
      league,
      nflState,
    });
    if (!payload) {
      return NextResponse.json({ error: "Could not build matchup advice" }, { status: 502 });
    }

    const projectionSeason = matchupAdviceProjectionSeason(league, nflState);
    const prefetchWeeks = matchupAdviceProjectionPrefetchWeeks(nflState, week, regularSeasonWeeks);
    after(() => {
      void prefetchProjectionWeekRows(projectionSeason, prefetchWeeks);
    });

    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to build matchup advice";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
