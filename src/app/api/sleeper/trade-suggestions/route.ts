import { NextRequest, NextResponse } from "next/server";
import { catalogBySleeperPlayerId, getModeledPlayerCatalog } from "@/lib/get-modeled-catalog";
import { leagueContextFromSleeper } from "@/lib/league-context-from-sleeper";
import {
  findTradeSuggestions,
  TRADE_SUGGESTIONS_VALUE_NOTE,
} from "@/lib/trade-suggestions";
import type { CatalogAsset } from "@/lib/trade-types";
import {
  fetchSleeperLeague,
  fetchSleeperLeagueRosters,
  fetchSleeperLeagueTradedPicks,
  fetchSleeperLeagueUsers,
} from "@/lib/sleeper-league-fetch";

function catalogByAssetId(assets: CatalogAsset[]): Map<string, CatalogAsset> {
  return new Map(assets.map((a) => [a.id, a]));
}

function parseLimit(raw: string | null): number {
  const n = Number(raw ?? "1");
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(3, Math.floor(n));
}

function parseOffset(raw: string | null): number {
  const n = Number(raw ?? "0");
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(2, Math.floor(n));
}

export async function GET(request: NextRequest) {
  const leagueId = request.nextUrl.searchParams.get("league_id")?.trim();
  const rosterIdRaw = request.nextUrl.searchParams.get("roster_id")?.trim();
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const offset = parseOffset(request.nextUrl.searchParams.get("offset"));
  const excludeRaw = request.nextUrl.searchParams.get("exclude")?.trim();
  const excludeIds = excludeRaw
    ? excludeRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  if (!leagueId || !rosterIdRaw) {
    return NextResponse.json({ error: "league_id and roster_id are required" }, { status: 400 });
  }

  const rosterId = Number(rosterIdRaw);
  if (!Number.isFinite(rosterId)) {
    return NextResponse.json({ error: "roster_id must be a number" }, { status: 400 });
  }

  const [league, rosters, users, tradedPicks] = await Promise.all([
    fetchSleeperLeague(leagueId),
    fetchSleeperLeagueRosters(leagueId),
    fetchSleeperLeagueUsers(leagueId),
    fetchSleeperLeagueTradedPicks(leagueId),
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
  const pickCatalogById = catalogByAssetId(
    catalogResult.assets.filter((a) => a.kind === "pick"),
  );

  const owner = users.find((u) => u.user_id === roster.owner_id);
  const teamName =
    owner?.metadata?.team_name?.trim() ||
    owner?.display_name?.trim() ||
    `Roster ${roster.roster_id}`;

  const { suggestions, totalCandidates } = findTradeSuggestions({
    targetRosterId: rosterId,
    rosters,
    users,
    catalogById: catalogMap,
    pickCatalogById,
    tradedPicks,
    startSlots: {
      qb: leagueContext.startQb,
      rb: leagueContext.startRb,
      wr: leagueContext.startWr,
      te: leagueContext.startTe,
    },
    limit,
    offset,
    excludeIds,
  });

  return NextResponse.json({
    team: { roster_id: roster.roster_id, name: teamName },
    suggestions,
    meta: {
      totalCandidates,
      limit,
      offset,
      valueNote: TRADE_SUGGESTIONS_VALUE_NOTE,
    },
  });
}
