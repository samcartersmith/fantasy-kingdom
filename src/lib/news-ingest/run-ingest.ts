import { randomUUID } from "crypto";
import {
  appendIngestRun,
  getPlayerIndex,
  replacePlayerIndex,
  shouldRefreshPlayerIndex,
  upsertNewsItems,
} from "@/lib/news-db/store";
import { fetchFantasyProsNews } from "@/lib/news-ingest/fetch-fantasypros";
import {
  fetchNewsTrendingAdds,
  fetchNewsTrendingDrops,
} from "@/lib/news-ingest/fetch-sleeper-trending";
import { normalizeFantasyProsItems, normalizeTrendingRows } from "@/lib/news-ingest/normalize";
import { buildPlayerIndexFromSleeperMap } from "@/lib/news-ingest/player-match";
import { ingestYahooLeagueSignals } from "@/lib/yahoo-ingest/ingest";
import type { IngestRunRecord, IngestStats, NewsItem } from "@/lib/news/types";
import { fetchSleeperNflPlayersMap } from "@/lib/sleeper-fetch";

export type RunIngestResult = {
  ok: boolean;
  stats: IngestStats;
  errors: string[];
  runId: string;
};

export async function runNewsIngest(): Promise<RunIngestResult> {
  const startedAt = new Date().toISOString();
  const runId = randomUUID();
  const errors: string[] = [];
  const stats: IngestStats = {
    playerIndexCount: 0,
    playerIndexRefreshed: false,
    fantasyProsFetched: 0,
    fantasyProsInserted: 0,
    fantasyProsDeduped: 0,
    trendingAddFetched: 0,
    trendingDropFetched: 0,
    trendingInserted: 0,
    trendingDeduped: 0,
    yahooUsersProcessed: 0,
    yahooInserted: 0,
    unmatchedPlayerNames: [],
  };

  let index = getPlayerIndex();

  if (shouldRefreshPlayerIndex(24)) {
    const playersResult = await fetchSleeperNflPlayersMap();
    if (playersResult.ok) {
      index = buildPlayerIndexFromSleeperMap(playersResult.data);
      replacePlayerIndex(index);
      stats.playerIndexRefreshed = true;
      stats.playerIndexCount = Object.keys(index).length;
    } else {
      errors.push(`Sleeper players/nfl failed: ${playersResult.status}`);
    }
  } else {
    stats.playerIndexCount = Object.keys(index).length;
  }

  const fpItems: NewsItem[] = [];
  const trendItems: NewsItem[] = [];
  const yahooItems: NewsItem[] = [];

  const fp = await fetchFantasyProsNews();
  if (fp.ok) {
    const rows = fp.data.items ?? [];
    stats.fantasyProsFetched = rows.length;
    const { items, unmatched } = normalizeFantasyProsItems(rows, index);
    stats.unmatchedPlayerNames = unmatched.slice(0, 20);
    fpItems.push(...items);
    if (fp.fromFixture) errors.push("Using FantasyPros fixture (set FANTASYPROS_API_KEY for live headlines)");
  } else {
    errors.push(fp.error);
  }

  const [adds, drops] = await Promise.all([fetchNewsTrendingAdds(), fetchNewsTrendingDrops()]);
  stats.trendingAddFetched = adds.length;
  stats.trendingDropFetched = drops.length;
  trendItems.push(...normalizeTrendingRows(adds, "add", index));
  trendItems.push(...normalizeTrendingRows(drops, "drop", index));

  const yahoo = await ingestYahooLeagueSignals(index);
  stats.yahooUsersProcessed = yahoo.usersProcessed;
  yahooItems.push(...yahoo.items);
  errors.push(...yahoo.errors);

  const fpUpsert = upsertNewsItems(fpItems);
  stats.fantasyProsInserted = fpUpsert.inserted;
  stats.fantasyProsDeduped = fpUpsert.deduped;

  const trendUpsert = upsertNewsItems(trendItems);
  stats.trendingInserted = trendUpsert.inserted;
  stats.trendingDeduped = trendUpsert.deduped;

  const yahooUpsert = upsertNewsItems(yahooItems);
  stats.yahooInserted = yahooUpsert.inserted;

  const finishedAt = new Date().toISOString();
  const totalItems = fpItems.length + trendItems.length + yahooItems.length;
  const ok =
    errors.filter((e) => !e.startsWith("Using FantasyPros fixture")).length === 0 || totalItems > 0;

  const run: IngestRunRecord = {
    id: runId,
    startedAt,
    finishedAt,
    ok,
    stats,
    errors,
  };
  appendIngestRun(run);

  return { ok, stats, errors, runId };
}
