import type { NewsItem } from "@/lib/news/types";

export function itemHasReadableDetail(item: NewsItem): boolean {
  if (item.body && item.body.length > 0) return true;
  if (item.url?.startsWith("http")) return true;
  if (item.meta?.trendCount != null) return true;
  if (item.signals && item.signals.length > 0) return true;
  return Boolean(item.summary && item.summary.length > 0);
}

export function formatPublishedLong(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
