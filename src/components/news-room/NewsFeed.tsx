"use client";

import { useCallback, useEffect, useState } from "react";
import { NewsFeedItem } from "@/components/news-room/NewsFeedItem";
import type { NewsItem } from "@/lib/news/types";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "injury", label: "Injury" },
  { id: "breaking", label: "Breaking" },
  { id: "trending", label: "Trending" },
  { id: "my-leagues", label: "My leagues" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

type ApiResponse = {
  items: NewsItem[];
  meta?: { lastIngestAt?: string | null; totalStored?: number };
  error?: string;
};

const YAHOO_USER_KEY = "fk:yahoo-news-user";

export function NewsFeed() {
  const [filter, setFilter] = useState<FilterId>("all");
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [yahooHint, setYahooHint] = useState<string | null>(null);

  const load = useCallback(async (active: FilterId) => {
    setError(null);
    setItems(null);
    setYahooHint(null);

    const params = new URLSearchParams({ limit: "50" });
    if (active === "my-leagues") {
      params.set("scope", "user");
      const uid =
        typeof localStorage !== "undefined" ? localStorage.getItem(YAHOO_USER_KEY) : null;
      if (uid) params.set("yahoo_user_id", uid);
      else setYahooHint("Connect Yahoo to see league waiver and IR signals in your feed.");
    } else if (active !== "all") {
      params.set("category", active);
    }

    try {
      const res = await fetch(`/api/news-feed?${params.toString()}`, { cache: "no-store" });
      const body = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setItems(body.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load news");
      setItems(null);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("yahoo") === "connected") {
      localStorage.setItem(YAHOO_USER_KEY, params.get("state") ?? "yahoo-user");
      window.history.replaceState({}, "", "/news-room");
      setFilter("my-leagues");
    }
  }, []);

  const connectYahoo = async () => {
    try {
      const res = await fetch("/api/yahoo/connect");
      const body = (await res.json()) as { authorizeUrl?: string; message?: string; configured?: boolean };
      if (body.authorizeUrl) {
        window.location.href = body.authorizeUrl;
        return;
      }
      setYahooHint(body.message ?? "Yahoo OAuth is not configured yet.");
    } catch {
      setYahooHint("Could not start Yahoo connect.");
    }
  };

  return (
    <div className="news-room space-y-6">
      <header className="max-w-[65ch]">
        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] text-home-muted mb-3">
          News room
        </p>
        <h1 className="home-editorial-display text-[2.25rem] sm:text-[2.75rem] lg:text-[3rem] leading-[1.08] text-dash-text mb-4">
          Dynasty wire
        </h1>
        <p className="text-base sm:text-lg text-home-muted leading-relaxed">
          Headlines from FantasyPros, Sleeper momentum, and your Yahoo leagues when connected.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="News filters"
        className="flex flex-wrap gap-2"
      >
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={[
              "news-filter-btn min-h-11 px-3 rounded-[var(--dash-radius-sm)] text-sm font-medium border cursor-pointer motion-safe:transition motion-safe:duration-150",
              filter === f.id
                ? "bg-dash-primary text-dash-text border-dash-primary"
                : "bg-black/25 text-dash-text/85 border-white/15 hover:bg-white/5",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filter === "my-leagues" ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-dash-text/70">
          <button
            type="button"
            onClick={() => void connectYahoo()}
            className="min-h-10 px-4 rounded-[var(--dash-radius-sm)] border border-dash-primary/40 text-dash-primary font-semibold hover:bg-dash-primary/10 motion-safe:transition-colors duration-150"
          >
            Connect Yahoo
          </button>
          {yahooHint ? <p role="status">{yahooHint}</p> : null}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-[var(--dash-radius-md)] p-4 border border-dash-danger/35 bg-[color-mix(in_oklch,var(--dash-danger)_8%,transparent)] text-dash-danger text-sm"
        >
          {error}
        </div>
      ) : null}

      {!error && items === null ? (
        <p className="text-sm text-dash-text/60">Loading feed…</p>
      ) : null}

      {items && items.length === 0 ? (
        <p className="text-sm text-dash-text/60">
          No items yet. Run ingest or wait for the next scheduled sync.
        </p>
      ) : null}

      {items && items.length > 0 ? (
        <div className="news-feed-list space-y-3" role="feed" aria-busy={items === null}>
          {items.map((item) => (
            <NewsFeedItem key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
