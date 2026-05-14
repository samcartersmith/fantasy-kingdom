import { NextRequest, NextResponse } from "next/server";
import curatedSnapshotJson from "@/data/trade-model/curated-snapshot.json";
import fantasyProfileJson from "@/data/trade-model/player-fantasy-profile.json";
import { applyPickFairTradeModel, getLocalPickAssets } from "@/lib/catalog";
import { buildFpAnchors } from "@/lib/trade-model/fp-baseline";
import type { FantasyProfilePayload } from "@/lib/trade-model/fp-baseline";
import { createCuratedProviders } from "@/lib/trade-model/providers";
import type { CuratedTradeSnapshot, LeagueContext, LeagueSize, PprMode } from "@/lib/trade-model/types";
import { TRADE_MODEL_VERSION } from "@/lib/trade-model/types";
import { fetchSleeperNflPlayersMap, fetchSleeperTrendingAdds } from "@/lib/sleeper-fetch";
import { SLEEPER_NFL_PLAYERS_URL, SLEEPER_PLAYERS_REVALIDATE_SECONDS } from "@/lib/sleeper-constants";
import { sleeperPlayersMapToCatalog, sleeperPlayersMapToCatalogModeled } from "@/lib/sleeper-map";

/** Keep in sync with `SLEEPER_PLAYERS_REVALIDATE_SECONDS` in `sleeper-constants.ts`. */
export const revalidate = 86_400;

const curatedSnapshot = curatedSnapshotJson as CuratedTradeSnapshot;
const fantasyProfilePayload = fantasyProfileJson as FantasyProfilePayload;

function parseLeagueSize(raw: string | null): LeagueSize {
  const n = Number(raw);
  if (n === 8 || n === 10 || n === 12 || n === 14) return n;
  return 12;
}

function parsePpr(raw: string | null): PprMode {
  if (raw === "0") return 0;
  if (raw === "0.5") return 0.5;
  return 1;
}

function parseLeagueContext(searchParams: URLSearchParams): LeagueContext {
  return {
    superflex: searchParams.get("superflex") === "1",
    ppr: parsePpr(searchParams.get("ppr")),
    leagueSize: parseLeagueSize(searchParams.get("league_size")),
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const legacy = searchParams.get("legacy") === "1";
    const league = parseLeagueContext(searchParams);

    const [playersResult, trendingAdds] = await Promise.all([
      fetchSleeperNflPlayersMap(),
      fetchSleeperTrendingAdds(120, 72),
    ]);

    if (!playersResult.ok) {
      return NextResponse.json(
        {
          error: `Sleeper API returned ${playersResult.status}`,
          details: playersResult.body.slice(0, 500),
        },
        { status: 502 },
      );
    }

    let players;
    let picks = getLocalPickAssets();
    let meta: Record<string, unknown>;

    if (legacy) {
      players = sleeperPlayersMapToCatalog(playersResult.data, trendingAdds);
      meta = {
        pickCount: picks.length,
        playerCount: players.length,
        sleeperUrl: SLEEPER_NFL_PLAYERS_URL,
        revalidateSeconds: SLEEPER_PLAYERS_REVALIDATE_SECONDS,
        legacyHeuristic: true,
        leagueFormatApplied: false,
        valueBasis:
          "Legacy: Sleeper search_rank + trending adds only (see /rankings). Superflex bump is applied client-side.",
      };
    } else {
      const providers = createCuratedProviders(curatedSnapshot);
      const anchors = buildFpAnchors(fantasyProfilePayload.profiles, league.ppr);
      const fp = {
        snapshotAsOf: fantasyProfilePayload.snapshotAsOf,
        profiles: fantasyProfilePayload.profiles,
        anchors,
      };
      players = sleeperPlayersMapToCatalogModeled(playersResult.data, trendingAdds, providers, league, fp);
      picks = applyPickFairTradeModel(picks, providers);
      meta = {
        pickCount: picks.length,
        playerCount: players.length,
        sleeperUrl: SLEEPER_NFL_PLAYERS_URL,
        revalidateSeconds: SLEEPER_PLAYERS_REVALIDATE_SECONDS,
        tradeModelVersion: TRADE_MODEL_VERSION,
        leagueFormatApplied: true,
        legacyHeuristic: false,
        curatedSnapshotAsOf: curatedSnapshot.snapshotAsOf,
        fantasyProfileSnapshotAsOf: fantasyProfilePayload.snapshotAsOf,
        fantasyProfileSource: fantasyProfilePayload.source,
        leagueContext: league,
        valueBasis:
          "Fair-trade model v2: fantasy points spine (Sleeper season stats snapshot, positional + global blend) plus smaller curated and age nudges. Sleeper buzz is a capped sentiment tweak. Superflex and PPR are baked into server values for the requested league context.",
      };
    }

    const assets = [...picks, ...players];

    return NextResponse.json({
      assets,
      meta,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
