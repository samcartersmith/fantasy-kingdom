import { NextRequest, NextResponse } from "next/server";
import { fetchSleeperNflPlayersMap, fetchSleeperTrendingAdds } from "@/lib/sleeper-fetch";
import { buildSleeperRankingRows } from "@/lib/sleeper-ranking";
import { SLEEPER_TRENDING_REVALIDATE_SECONDS } from "@/lib/sleeper-constants";

/** Revalidate this route when trending data is expected to refresh. */
export const revalidate = SLEEPER_TRENDING_REVALIDATE_SECONDS;

const ALLOWED = new Set(["ALL", "QB", "RB", "WR", "TE", "K", "DEF"]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pos = (searchParams.get("position") || "ALL").toUpperCase();
  const limitRaw = Number(searchParams.get("limit") || 120);
  const limit = Number.isFinite(limitRaw) ? Math.min(300, Math.max(10, Math.floor(limitRaw))) : 120;

  if (!ALLOWED.has(pos)) {
    return NextResponse.json(
      { error: "Invalid position", allowed: [...ALLOWED] },
      { status: 400 },
    );
  }

  const [playersResult, trendingAdds] = await Promise.all([
    fetchSleeperNflPlayersMap(),
    fetchSleeperTrendingAdds(120, 72),
  ]);

  if (!playersResult.ok) {
    return NextResponse.json(
      {
        error: "Sleeper players fetch failed",
        status: playersResult.status,
        details: playersResult.body.slice(0, 500),
      },
      { status: 502 },
    );
  }

  const rows = buildSleeperRankingRows(playersResult.data, trendingAdds, pos, limit);

  return NextResponse.json({
    position: pos,
    limit,
    rows,
    meta: {
      trendingLookbackHours: 72,
      trendingLimit: 120,
      sort: "Lower Sleeper search_rank first, then higher trending adds, then name.",
      valueNote:
        "Trade value is a Fantasy Kingdom heuristic from Sleeper search_rank + add activity — not an official Sleeper valuation.",
    },
  });
}
