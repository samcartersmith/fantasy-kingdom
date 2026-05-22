"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import {
  categoryBadgeClass,
  categoryLabel,
  kindLabel,
  sourceBadgeClass,
  sourceLabel,
  trendRowClass,
} from "@/lib/news/feed-labels";
import { formatPublishedLong, itemHasReadableDetail } from "@/lib/news/feed-detail";
import { isSpecificFantasyProsArticleUrl } from "@/lib/news-ingest/resolve-fantasypros-url";
import type { NewsItem } from "@/lib/news/types";

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Props = {
  item: NewsItem;
};

export function NewsFeedItem({ item }: Props) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const cat = categoryLabel(item.category);
  const articleUrl =
    item.url?.startsWith("http") && (item.source !== "fantasypros" || isSpecificFantasyProsArticleUrl(item.url))
      ? item.url
      : undefined;
  const isHeadline = item.kind === "headline";
  const openArticleDirect = Boolean(articleUrl && isHeadline);
  const canExpand = itemHasReadableDetail(item) && !openArticleDirect;
  const preview = item.summary ?? item.body?.slice(0, 160);

  return (
    <article
      className={[
        "news-feed-item rounded-[var(--dash-radius-md)] border border-white/12 px-4 py-4 sm:px-5",
        item.kind === "trending_add" || item.kind === "trending_drop" ? trendRowClass(item.kind) : "",
        expanded ? "news-feed-item--expanded" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={[
            "news-source-badge text-[10px] font-bold uppercase tracking-[0.14em] px-2 py-1 rounded-[var(--dash-radius-sm)] border",
            sourceBadgeClass(item.source),
          ].join(" ")}
        >
          {sourceLabel(item.source)}
        </span>
        {cat ? (
          <span
            className={[
              "news-category-badge text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-1 rounded-[var(--dash-radius-sm)] border",
              categoryBadgeClass(item.category),
            ].join(" ")}
          >
            {cat}
          </span>
        ) : (
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dash-text/50">
            {kindLabel(item.kind)}
          </span>
        )}
        <time className="text-xs text-dash-text/55 ml-auto tabular-nums" dateTime={item.publishedAt}>
          {formatRelativeTime(item.publishedAt)}
        </time>
      </div>

      <h2 className="text-base sm:text-lg font-semibold text-dash-text leading-snug mb-2">
        {articleUrl && !expanded ? (
          <a
            href={articleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--home-accent)] motion-safe:transition-colors duration-150"
          >
            {item.title}
          </a>
        ) : (
          item.title
        )}
      </h2>

      {preview && !expanded ? (
        <p className="text-sm text-dash-text/75 leading-relaxed mb-3 max-w-[65ch] line-clamp-2">{preview}</p>
      ) : null}

      {item.players.length > 0 ? (
        <ul className="flex flex-wrap gap-2 mb-3" aria-label="Linked players">
          {item.players.map((p) => (
            <li key={p.sleeperId}>
              <Link
                href="/rankings"
                className="news-player-chip inline-flex items-center gap-2 min-h-9 pl-1 pr-3 rounded-full border border-white/15 bg-white/[0.04] hover:border-[var(--home-accent)]/50 motion-safe:transition-colors duration-150"
              >
                <Image
                  src={p.imageUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="rounded-full bg-black/30"
                  unoptimized
                />
                <span className="text-xs font-medium text-dash-text">
                  {p.name}
                  <span className="text-dash-text/55 font-normal">
                    {" "}
                    · {p.position} · {p.team}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {openArticleDirect || canExpand ? (
        <div className="flex flex-wrap items-center gap-3">
          {openArticleDirect ? (
            <a
              href={articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="news-read-more inline-flex min-h-10 items-center px-3 rounded-[var(--dash-radius-sm)] text-xs font-bold uppercase tracking-[0.1em] border border-dash-primary/40 bg-dash-primary/10 text-dash-primary hover:bg-dash-primary/20 motion-safe:transition-colors duration-150"
            >
              Read article ↗
            </a>
          ) : (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setExpanded((v) => !v)}
              className="news-read-more min-h-10 px-3 rounded-[var(--dash-radius-sm)] text-xs font-bold uppercase tracking-[0.1em] border border-white/20 text-dash-text hover:border-dash-primary/50 hover:text-dash-primary motion-safe:transition-colors duration-150"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
          {canExpand && articleUrl && expanded ? (
            <a
              href={articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-dash-primary hover:text-[var(--home-accent)] motion-safe:transition-colors duration-150"
            >
              Open full article ↗
            </a>
          ) : null}
        </div>
      ) : null}

      {expanded ? (
        <div
          id={panelId}
          className="news-feed-detail mt-4 pt-4 border-t border-white/12 max-w-[65ch]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dash-text/50 mb-2">
            {formatPublishedLong(item.publishedAt)}
          </p>

          {item.body ? (
            <p className="text-sm text-dash-text/85 leading-relaxed mb-4">{item.body}</p>
          ) : null}

          {item.meta?.trendCount != null ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm mb-4">
              <dt className="text-dash-text/55">Activity</dt>
              <dd className="text-dash-text font-medium tabular-nums">
                {item.meta.trendCount} {item.meta.trendType === "drop" ? "drops" : "adds"} (1h lookback)
              </dd>
              <dt className="text-dash-text/55">Source</dt>
              <dd className="text-dash-text">{sourceLabel(item.source)} trending endpoint</dd>
            </dl>
          ) : null}

          {item.signals && item.signals.length > 1 ? (
            <p className="text-sm text-dash-text/70 mb-4">
              Also flagged on {item.signals.map((s) => sourceLabel(s.source)).join(", ")}.
            </p>
          ) : null}

          {articleUrl ? (
            <a
              href={articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center px-4 rounded-[var(--dash-radius-sm)] bg-dash-primary text-dash-text text-[11px] font-bold uppercase tracking-[0.1em] hover:bg-dash-secondary motion-safe:transition-colors duration-150"
            >
              Read on FantasyPros
            </a>
          ) : item.kind.startsWith("trending") && item.players[0] ? (
            <Link
              href="/rankings"
              className="inline-flex min-h-11 items-center justify-center px-4 rounded-[var(--dash-radius-sm)] border border-white/20 text-[11px] font-bold uppercase tracking-[0.1em] text-dash-text hover:border-dash-primary/50 motion-safe:transition-colors duration-150"
            >
              View rankings
            </Link>
          ) : null}
        </div>
      ) : null}

      {!expanded && item.signals && item.signals.length > 1 ? (
        <p className="mt-3 text-[11px] text-dash-text/50">
          Also flagged on {item.signals.map((s) => sourceLabel(s.source)).join(", ")}
        </p>
      ) : null}
    </article>
  );
}
