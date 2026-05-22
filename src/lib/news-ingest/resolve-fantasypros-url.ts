import type { FantasyProsNewsItem } from "@/lib/news/types";

/** True when URL points at a single article, not the generic news index. */
export function isSpecificFantasyProsArticleUrl(url: string): boolean {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    if (!u.hostname.includes("fantasypros.com")) return false;
    const path = u.pathname.toLowerCase();
    if (path.endsWith("/news.php") || path === "/nfl/news.php" || path === "/news.php") {
      return false;
    }
    return /\/news\/\d+/.test(path);
  } catch {
    return false;
  }
}

function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function sportSegment(sportId?: string): string {
  const s = (sportId ?? "NFL").trim().toLowerCase();
  return s === "mlb" ? "mlb" : s === "nba" ? "nba" : "nfl";
}

function normalizeHttpUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

function extractArticleUrlsFromDesc(desc?: string): string[] {
  if (!desc) return [];
  const out: string[] = [];
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(desc)) !== null) {
    const href = m[1]?.trim();
    if (href && href.includes("fantasypros.com")) out.push(normalizeHttpUrl(href));
  }
  return out;
}

function buildArticleUrl(id: number, title: string, sportId?: string): string {
  const sport = sportSegment(sportId);
  return `https://www.fantasypros.com/${sport}/news/${id}/${slugFromTitle(title)}.php`;
}

/**
 * FantasyPros sometimes returns a generic `link` (e.g. …/news.php). Prefer per-article URLs
 * from `desc` anchors, then build from numeric `id` + title slug (matches FP URL shape).
 */
export function resolveFantasyProsArticleUrl(raw: FantasyProsNewsItem): string | undefined {
  const title = (raw.title ?? "").trim();
  const id = typeof raw.id === "number" && Number.isFinite(raw.id) ? raw.id : null;

  if (raw.link?.trim()) {
    const normalized = normalizeHttpUrl(raw.link);
    if (isSpecificFantasyProsArticleUrl(normalized)) return normalized;
  }

  for (const href of extractArticleUrlsFromDesc(raw.desc)) {
    if (isSpecificFantasyProsArticleUrl(href)) return href;
  }

  if (id != null && title) return buildArticleUrl(id, title, raw.sport_id);

  return undefined;
}

/** Repair stored feed rows that still have a generic FantasyPros index URL. */
export function repairFantasyProsNewsItemUrl(item: {
  source: string;
  url?: string;
  title: string;
  meta?: { fpId?: number };
}): string | undefined {
  if (item.source !== "fantasypros") return item.url;
  if (item.url && isSpecificFantasyProsArticleUrl(item.url)) return item.url;
  const fpId = item.meta?.fpId;
  if (typeof fpId === "number" && item.title.trim()) {
    return buildArticleUrl(fpId, item.title);
  }
  return item.url;
}
