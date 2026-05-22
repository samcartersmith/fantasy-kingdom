import { buildDedupeKey } from "@/lib/news-db/store";
import {
  matchPlayerFromText,
  resolvePlayerBySleeperId,
  toNewsPlayerRef,
} from "@/lib/news-ingest/player-match";
import type {
  FantasyProsNewsItem,
  NewsCategory,
  NewsItem,
  NewsKind,
  PlayerIndexEntry,
} from "@/lib/news/types";
import { resolveFantasyProsArticleUrl } from "@/lib/news-ingest/resolve-fantasypros-url";
import type { SleeperTrendingRow } from "@/lib/sleeper-types";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFpCategory(raw?: string): NewsCategory {
  const c = (raw ?? "").trim().toLowerCase();
  if (c === "injury" || c === "breaking" || c === "rumor" || c === "transaction" || c === "recap") {
    return c;
  }
  return null;
}

function fpPublishedAt(item: FantasyProsNewsItem): string {
  if (item.created) {
    const d = new Date(item.created.replace(" ", "T") + "Z");
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

export function normalizeFantasyProsItems(
  items: FantasyProsNewsItem[],
  index: Record<string, PlayerIndexEntry>,
): { items: NewsItem[]; unmatched: string[] } {
  const out: NewsItem[] = [];
  const unmatched: string[] = [];

  for (const raw of items) {
    if ((raw.sport_id ?? "NFL").toUpperCase() !== "NFL") continue;
    const title = (raw.title ?? "").trim();
    if (!title) continue;

    const team = (raw.team_id ?? "").trim().toUpperCase() || null;
    const text = `${title} ${stripHtml(raw.desc ?? "")}`;
    const matched = matchPlayerFromText(text, team, index);
    if (!matched) unmatched.push(title);

    const category = parseFpCategory(raw.category);
    const fpId = raw.id;
    const publishedAt = fpPublishedAt(raw);
    const players = matched ? [toNewsPlayerRef(matched)] : [];
    const sleeperPlayerIds = matched ? [matched.sleeperId] : [];

    const body = stripHtml(raw.desc ?? "") || undefined;
    const summary = body ? (body.length > 160 ? `${body.slice(0, 157)}…` : body) : undefined;
    const articleUrl = resolveFantasyProsArticleUrl(raw);

    out.push({
      id: `fp:${fpId ?? buildDedupeKey([title, publishedAt])}`,
      dedupeKey: buildDedupeKey([
        "fantasypros",
        articleUrl ?? String(fpId ?? title),
        publishedAt.slice(0, 10),
        matched?.sleeperId,
      ]),
      source: "fantasypros",
      kind: "headline",
      category,
      title,
      summary,
      body,
      url: articleUrl,
      publishedAt,
      sleeperPlayerIds,
      players,
      scope: "public",
      meta: { fpId },
    });
  }

  return { items: out, unmatched };
}

function hourBucket(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}`;
}

export function normalizeTrendingRows(
  rows: SleeperTrendingRow[],
  type: "add" | "drop",
  index: Record<string, PlayerIndexEntry>,
): NewsItem[] {
  const now = new Date().toISOString();
  const bucket = hourBucket(now);
  const kind: NewsKind = type === "add" ? "trending_add" : "trending_drop";

  return rows
    .filter((r) => r?.player_id && typeof r.count === "number")
    .map((r) => {
      const pid = String(r.player_id);
      const entry = resolvePlayerBySleeperId(pid, index);
      const name = entry?.name ?? `Player ${pid}`;
      const count = r.count;
      const title =
        type === "add"
          ? `Trending add: ${name} (+${count} adds in 1h)`
          : `Trending drop: ${name} (+${count} drops in 1h)`;

      const body =
        type === "add"
          ? `${name} was added in ${count} Sleeper leagues over the last hour (league-wide add activity, not an official news article). Spikes often follow injury news, depth-chart moves, or waiver-wire runs.`
          : `${name} was dropped in ${count} Sleeper leagues over the last hour. Drop surges can mean roster churn, injury concern, or managers making room for adds.`;

      return {
        id: `sleeper-trend:${pid}:${type}:${bucket}`,
        dedupeKey: buildDedupeKey(["sleeper", type, pid, bucket]),
        source: "sleeper" as const,
        kind,
        category: "trending" as const,
        title,
        summary: body.slice(0, 157) + (body.length > 157 ? "…" : ""),
        body,
        publishedAt: now,
        sleeperPlayerIds: [pid],
        players: entry ? [toNewsPlayerRef(entry)] : [],
        scope: "public" as const,
        meta: { trendCount: count, trendType: type },
        signals: [{ source: "sleeper", kind }],
      };
    });
}
