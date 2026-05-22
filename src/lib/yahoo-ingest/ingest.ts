import { buildDedupeKey } from "@/lib/news-db/store";
import { matchPlayerFromText, toNewsPlayerRef } from "@/lib/news-ingest/player-match";
import type { NewsItem, PlayerIndexEntry } from "@/lib/news/types";
import { isYahooOAuthConfigured, readYahooTokens } from "@/lib/yahoo-ingest/token-store";

export type YahooIngestResult = {
  items: NewsItem[];
  usersProcessed: number;
  errors: string[];
};

/**
 * Phase 2: when tokens exist, fetch league transactions via Yahoo Fantasy API.
 * Until OAuth is completed, returns no items.
 */
export async function ingestYahooLeagueSignals(
  index: Record<string, PlayerIndexEntry>,
): Promise<YahooIngestResult> {
  const errors: string[] = [];
  const items: NewsItem[] = [];

  if (!isYahooOAuthConfigured()) {
    return { items, usersProcessed: 0, errors };
  }

  const users = readYahooTokens();
  if (users.length === 0) {
    return { items, usersProcessed: 0, errors };
  }

  for (const user of users) {
    try {
      const leagueItems = await fetchYahooTransactionsForUser(user, index);
      items.push(...leagueItems);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `Yahoo ingest failed for ${user.userId}`);
    }
  }

  return { items, usersProcessed: users.length, errors };
}

async function fetchYahooTransactionsForUser(
  user: { userId: string; accessToken: string; leagueIds: string[] },
  index: Record<string, PlayerIndexEntry>,
): Promise<NewsItem[]> {
  // Placeholder: real Yahoo Fantasy REST calls go here once OAuth callback stores tokens.
  // Demo row when tokens file has leagues so "My leagues" filter can be tested locally.
  if (user.leagueIds.length === 0) return [];

  const now = new Date().toISOString();
  const sampleTitle = "Yahoo league: waiver claim processed";
  const matched = matchPlayerFromText(sampleTitle, null, index);

  return [
    {
      id: `yahoo:${user.userId}:${user.leagueIds[0]}:demo`,
      dedupeKey: buildDedupeKey(["yahoo", user.userId, user.leagueIds[0], "demo", now.slice(0, 10)]),
      source: "yahoo",
      kind: "league_transaction",
      category: "transaction",
      title: sampleTitle,
      summary: "Connect Yahoo OAuth to sync live waiver and IR updates from your leagues.",
      body: "When Yahoo Fantasy is connected, waiver claims, drops, and IR designation changes from your linked leagues appear here. This demo row shows the layout until live transaction sync is wired up.",
      publishedAt: now,
      sleeperPlayerIds: matched ? [matched.sleeperId] : [],
      players: matched ? [toNewsPlayerRef(matched)] : [],
      scope: "user",
      yahooLeagueId: user.leagueIds[0],
      yahooUserId: user.userId,
    },
  ];
}

export async function seedYahooDemoTokens(userId: string, leagueId: string): Promise<void> {
  const { upsertYahooTokens } = await import("@/lib/yahoo-ingest/token-store");
  upsertYahooTokens({
    userId,
    accessToken: "demo",
    refreshToken: "demo",
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    leagueIds: [leagueId],
  });
}
