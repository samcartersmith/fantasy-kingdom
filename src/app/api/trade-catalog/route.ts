import { NextResponse } from "next/server";
import { getLocalPickAssets } from "@/lib/catalog";
import { fetchSleeperNflPlayersMap, fetchSleeperTrendingAdds } from "@/lib/sleeper-fetch";
import { SLEEPER_NFL_PLAYERS_URL, SLEEPER_PLAYERS_REVALIDATE_SECONDS } from "@/lib/sleeper-constants";
import { sleeperPlayersMapToCatalog } from "@/lib/sleeper-map";

export const revalidate = SLEEPER_PLAYERS_REVALIDATE_SECONDS;

export async function GET() {
  try {
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

    const players = sleeperPlayersMapToCatalog(playersResult.data, trendingAdds);
    const picks = getLocalPickAssets();
    const assets = [...picks, ...players];

    return NextResponse.json({
      assets,
      meta: {
        pickCount: picks.length,
        playerCount: players.length,
        sleeperUrl: SLEEPER_NFL_PLAYERS_URL,
        revalidateSeconds: SLEEPER_PLAYERS_REVALIDATE_SECONDS,
        valueBasis:
          "Heuristic from Sleeper search_rank + trending adds (see /rankings). Not a market dollar.",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
