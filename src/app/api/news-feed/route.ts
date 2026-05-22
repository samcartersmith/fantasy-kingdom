import { NextRequest, NextResponse } from "next/server";
import { queryNewsFeed, readNewsStore } from "@/lib/news-db/store";
import { runNewsIngest } from "@/lib/news-ingest/run-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limitRaw = Number(searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 50;
  const category = searchParams.get("category");
  const playerId = searchParams.get("player_id");
  const scopeParam = searchParams.get("scope") ?? "all";
  const scope =
    scopeParam === "public" || scopeParam === "user" || scopeParam === "all" ? scopeParam : "all";
  const yahooUserId = searchParams.get("yahoo_user_id");

  let store = readNewsStore();
  if (store.items.length === 0) {
    await runNewsIngest();
    store = readNewsStore();
  }

  const items = queryNewsFeed({
    limit,
    category,
    playerId,
    scope,
    yahooUserId,
  });

  return NextResponse.json({
    items,
    meta: {
      count: items.length,
      limit,
      lastIngestAt: store.meta.lastIngestAt,
      playerIndexUpdatedAt: store.meta.playerIndexUpdatedAt,
      totalStored: store.items.length,
    },
  });
}
