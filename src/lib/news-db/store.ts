import { createHash, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { repairFantasyProsNewsItemUrl } from "@/lib/news-ingest/resolve-fantasypros-url";
import type {
  IngestRunRecord,
  NewsItem,
  NewsStoreSnapshot,
  PlayerIndexEntry,
} from "@/lib/news/types";

function withRepairedUrls(items: NewsItem[]): NewsItem[] {
  return items.map((item) => {
    if (item.source !== "fantasypros") return item;
    const url = repairFantasyProsNewsItemUrl(item);
    if (url === item.url) return item;
    return { ...item, url };
  });
}

const STORE_VERSION = 1 as const;

function storeDir(): string {
  const override = process.env.NEWS_STORE_DIR?.trim();
  if (override) return path.isAbsolute(override) ? override : path.join(process.cwd(), override);
  return path.join(process.cwd(), ".data", "news");
}

function storePath(): string {
  return path.join(storeDir(), "store.json");
}

function emptyStore(): NewsStoreSnapshot {
  return {
    version: STORE_VERSION,
    items: [],
    playerIndex: {},
    ingestRuns: [],
    meta: {
      playerIndexUpdatedAt: null,
      lastIngestAt: null,
    },
  };
}

function ensureDir(): void {
  fs.mkdirSync(storeDir(), { recursive: true });
}

export function readNewsStore(): NewsStoreSnapshot {
  const file = storePath();
  if (!fs.existsSync(file)) return emptyStore();
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as NewsStoreSnapshot;
    if (raw?.version !== STORE_VERSION || !Array.isArray(raw.items)) return emptyStore();
    return raw;
  } catch {
    return emptyStore();
  }
}

export function writeNewsStore(snapshot: NewsStoreSnapshot): void {
  ensureDir();
  const file = storePath();
  const tmp = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, file);
}

export function upsertNewsItems(
  incoming: NewsItem[],
): { inserted: number; deduped: number; store: NewsStoreSnapshot } {
  const store = readNewsStore();
  const byDedupe = new Map(store.items.map((i) => [i.dedupeKey, i]));
  let inserted = 0;
  let deduped = 0;

  for (const item of incoming) {
    const existing = byDedupe.get(item.dedupeKey);
    if (!existing) {
      byDedupe.set(item.dedupeKey, item);
      inserted++;
      continue;
    }
    deduped++;
    const mergedSignals = mergeSignals(existing.signals, item.signals);
    byDedupe.set(item.dedupeKey, {
      ...existing,
      ...item,
      id: existing.id,
      signals: mergedSignals,
      players: item.players.length > 0 ? item.players : existing.players,
      sleeperPlayerIds:
        item.sleeperPlayerIds.length > 0 ? item.sleeperPlayerIds : existing.sleeperPlayerIds,
    });
  }

  const items = [...byDedupe.values()].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  const next: NewsStoreSnapshot = {
    ...store,
    items: items.slice(0, 500),
    meta: { ...store.meta, lastIngestAt: new Date().toISOString() },
  };
  writeNewsStore(next);
  return { inserted, deduped, store: next };
}

function mergeSignals(
  a: NewsItem["signals"],
  b: NewsItem["signals"],
): NewsItem["signals"] | undefined {
  const all = [...(a ?? []), ...(b ?? [])];
  if (all.length === 0) return undefined;
  const seen = new Set<string>();
  const out: NonNullable<NewsItem["signals"]> = [];
  for (const s of all) {
    const k = `${s.source}:${s.kind}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

export function replacePlayerIndex(entries: Record<string, PlayerIndexEntry>): void {
  const store = readNewsStore();
  const next: NewsStoreSnapshot = {
    ...store,
    playerIndex: entries,
    meta: {
      ...store.meta,
      playerIndexUpdatedAt: new Date().toISOString(),
    },
  };
  writeNewsStore(next);
}

export function getPlayerIndex(): Record<string, PlayerIndexEntry> {
  return readNewsStore().playerIndex;
}

export function shouldRefreshPlayerIndex(maxAgeHours = 24): boolean {
  const ts = readNewsStore().meta.playerIndexUpdatedAt;
  if (!ts) return true;
  const ageMs = Date.now() - new Date(ts).getTime();
  return ageMs >= maxAgeHours * 60 * 60 * 1000;
}

export function appendIngestRun(run: IngestRunRecord): void {
  const store = readNewsStore();
  const ingestRuns = [run, ...store.ingestRuns].slice(0, 50);
  writeNewsStore({ ...store, ingestRuns });
}

export function queryNewsFeed(opts: {
  limit: number;
  category?: string | null;
  playerId?: string | null;
  scope?: "all" | "public" | "user";
  yahooUserId?: string | null;
}): NewsItem[] {
  const { limit, category, playerId, scope = "all", yahooUserId } = opts;
  let items = readNewsStore().items;

  if (scope === "public") {
    items = items.filter((i) => i.scope === "public");
  } else if (scope === "user") {
    items = items.filter((i) => i.scope === "user");
    if (yahooUserId) {
      items = items.filter((i) => !i.yahooUserId || i.yahooUserId === yahooUserId);
    }
  }

  if (category && category !== "all") {
    const c = category.toLowerCase();
    items = items.filter((i) => (i.category ?? "").toLowerCase() === c);
  }

  if (playerId) {
    const pid = String(playerId);
    items = items.filter((i) => i.sleeperPlayerIds.includes(pid));
  }

  return withRepairedUrls(items.slice(0, limit));
}

export function buildDedupeKey(parts: (string | number | null | undefined)[]): string {
  const raw = parts.map((p) => String(p ?? "").trim().toLowerCase()).join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}
