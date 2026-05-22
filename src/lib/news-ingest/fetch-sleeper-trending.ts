import {
  NEWS_TRENDING_LIMIT,
  NEWS_TRENDING_LOOKBACK_HOURS,
  sleeperTrendingAddsUrl,
  sleeperTrendingDropsUrl,
} from "@/lib/sleeper-constants";
import type { SleeperTrendingRow } from "@/lib/sleeper-types";

const UA = "FantasyKingdom/1.0 (news-ingest; +https://github.com/fantasy-kingdom)";

async function fetchTrendingRows(url: string): Promise<SleeperTrendingRow[]> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as SleeperTrendingRow[];
  return Array.isArray(rows) ? rows : [];
}

export async function fetchNewsTrendingAdds(
  limit = NEWS_TRENDING_LIMIT,
  lookbackHours = NEWS_TRENDING_LOOKBACK_HOURS,
): Promise<SleeperTrendingRow[]> {
  return fetchTrendingRows(sleeperTrendingAddsUrl(limit, lookbackHours));
}

export async function fetchNewsTrendingDrops(
  limit = NEWS_TRENDING_LIMIT,
  lookbackHours = NEWS_TRENDING_LOOKBACK_HOURS,
): Promise<SleeperTrendingRow[]> {
  return fetchTrendingRows(sleeperTrendingDropsUrl(limit, lookbackHours));
}
