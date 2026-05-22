export type NewsSource = "fantasypros" | "sleeper" | "yahoo";

export type NewsKind = "headline" | "trending_add" | "trending_drop" | "league_transaction";

export type NewsCategory =
  | "injury"
  | "breaking"
  | "rumor"
  | "transaction"
  | "recap"
  | "trending"
  | null;

export type NewsFeedScope = "public" | "user";

export type NewsSignal = {
  source: NewsSource;
  kind: string;
};

export type NewsPlayerRef = {
  sleeperId: string;
  name: string;
  team: string;
  position: string;
  imageUrl: string;
};

export type NewsItem = {
  id: string;
  dedupeKey: string;
  source: NewsSource;
  kind: NewsKind;
  category: NewsCategory;
  title: string;
  /** Short preview in the feed list (line-clamp). */
  summary?: string;
  /** Full plain-text body shown when the item is expanded. */
  body?: string;
  url?: string;
  publishedAt: string;
  sleeperPlayerIds: string[];
  players: NewsPlayerRef[];
  signals?: NewsSignal[];
  scope: NewsFeedScope;
  yahooLeagueId?: string;
  yahooUserId?: string;
  meta?: {
    trendCount?: number;
    trendType?: "add" | "drop";
    fpId?: number;
  };
};

export type PlayerIndexEntry = {
  sleeperId: string;
  name: string;
  team: string;
  position: string;
  gsisId?: string;
  imageUrl: string;
  searchKeys: string[];
  updatedAt: string;
};

export type IngestRunRecord = {
  id: string;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  stats: IngestStats;
  errors: string[];
};

export type IngestStats = {
  playerIndexCount: number;
  playerIndexRefreshed: boolean;
  fantasyProsFetched: number;
  fantasyProsInserted: number;
  fantasyProsDeduped: number;
  trendingAddFetched: number;
  trendingDropFetched: number;
  trendingInserted: number;
  trendingDeduped: number;
  yahooUsersProcessed: number;
  yahooInserted: number;
  unmatchedPlayerNames: string[];
};

export type NewsStoreSnapshot = {
  version: 1;
  items: NewsItem[];
  playerIndex: Record<string, PlayerIndexEntry>;
  ingestRuns: IngestRunRecord[];
  meta: {
    playerIndexUpdatedAt: string | null;
    lastIngestAt: string | null;
  };
};

export type FantasyProsNewsItem = {
  id?: number;
  created?: string;
  created_formated?: string;
  team_id?: string;
  title?: string;
  sport_id?: string;
  category?: string;
  link?: string;
  desc?: string;
  fpid?: number;
  player_id?: number;
};

export type FantasyProsNewsResponse = {
  sport?: string;
  count?: number;
  items?: FantasyProsNewsItem[];
};
