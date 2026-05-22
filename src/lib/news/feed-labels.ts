import type { NewsCategory, NewsKind, NewsSource } from "@/lib/news/types";

export function sourceLabel(source: NewsSource): string {
  switch (source) {
    case "fantasypros":
      return "FantasyPros";
    case "sleeper":
      return "Sleeper";
    case "yahoo":
      return "Yahoo";
    default:
      return source;
  }
}

export function categoryLabel(category: NewsCategory): string | null {
  if (!category) return null;
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function kindLabel(kind: NewsKind): string {
  switch (kind) {
    case "headline":
      return "Headline";
    case "trending_add":
      return "Trending add";
    case "trending_drop":
      return "Trending drop";
    case "league_transaction":
      return "League";
    default:
      return kind;
  }
}

/** Semantic badge classes (product register, restrained palette). */
export function categoryBadgeClass(category: NewsCategory): string {
  switch (category) {
    case "injury":
      return "news-badge--injury";
    case "breaking":
      return "news-badge--breaking";
    case "transaction":
      return "news-badge--transaction";
    case "rumor":
      return "news-badge--rumor";
    case "trending":
      return "news-badge--trending";
    default:
      return "news-badge--neutral";
  }
}

export function sourceBadgeClass(source: NewsSource): string {
  switch (source) {
    case "fantasypros":
      return "news-source--fp";
    case "sleeper":
      return "news-source--sleeper";
    case "yahoo":
      return "news-source--yahoo";
    default:
      return "news-source--neutral";
  }
}

export function trendRowClass(kind: NewsKind): string {
  return kind === "trending_drop" ? "news-row--drop" : "news-row--add";
}
