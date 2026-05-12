"use client";

import { useCallback, useEffect, useState } from "react";
import type { SleeperRankingRow } from "@/lib/sleeper-ranking";

const TABS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"] as const;

type Tab = (typeof TABS)[number];

type ApiResponse = {
  position: string;
  limit: number;
  rows: SleeperRankingRow[];
  meta?: { valueNote?: string; sort?: string };
  error?: string;
};

export function RankingsExplorer() {
  const [tab, setTab] = useState<Tab>("QB");
  const [rows, setRows] = useState<SleeperRankingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (position: Tab) => {
    setError(null);
    setRows(null);
    try {
      const res = await fetch(`/api/rankings?position=${position}&limit=150`, { cache: "no-store" });
      const body = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setRows(body.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rankings");
      setRows(null);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Position filter"
        className="flex flex-wrap gap-2"
      >
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 px-3 rounded-[var(--dash-radius-sm)] text-sm font-medium border transition-colors ${
              tab === t
                ? "bg-dash-primary text-dash-text border-dash-primary"
                : "bg-black/25 text-dash-text/85 border-white/15 hover:bg-white/5"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error ? (
        <div
          role="alert"
          className="dash-glass-panel rounded-[var(--dash-radius-md)] p-4 border border-dash-danger/30 text-dash-danger text-sm"
        >
          {error}
        </div>
      ) : null}

      {!error && rows === null ? (
        <p className="text-sm text-dash-text/60">Loading Sleeper rankings…</p>
      ) : null}

      {rows && rows.length > 0 ? (
        <div className="dash-glass-panel rounded-[var(--dash-radius-md)] ring-1 ring-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto max-h-[min(70vh,720px)] overflow-y-auto">
            <table className="w-full text-sm text-left min-w-[640px]">
              <thead className="sticky top-0 z-[1] bg-dash-surface-elevated/95 backdrop-blur-sm border-b border-white/10">
                <tr>
                  <th scope="col" className="px-3 py-3 font-semibold text-dash-text/90 w-12">
                    #
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold text-dash-text/90">
                    Player
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold text-dash-text/90">
                    Pos
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold text-dash-text/90">
                    Team
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold text-dash-text/90 text-right">
                    Sleeper search rank
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold text-dash-text/90 text-right">
                    Trending adds
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold text-dash-text/90 text-right">
                    Heuristic value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rows.map((r) => (
                  <tr key={r.sleeperPlayerId} className="hover:bg-white/[0.04]">
                    <td className="px-3 py-2.5 font-mono text-dash-text/70 tabular-nums">{r.rank}</td>
                    <td className="px-3 py-2.5 font-medium text-dash-text">{r.name}</td>
                    <td className="px-3 py-2.5 font-mono text-dash-text/75">{r.position}</td>
                    <td className="px-3 py-2.5 font-mono text-dash-text/75">{r.team}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-dash-text/80">
                      {r.search_rank ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-dash-text/80">
                      {r.trending_adds}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-dash-text">
                      {r.value.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {rows && rows.length === 0 ? (
        <p className="text-sm text-dash-text/60">No players in this slice.</p>
      ) : null}

      <footer className="text-xs text-dash-text/50 space-y-1 max-w-3xl leading-relaxed">
        <p>
          Order uses Sleeper&apos;s <strong className="text-dash-text/70">search_rank</strong> (lower tends to mean
          more in-app search activity) and <strong className="text-dash-text/70">trending adds</strong> from{" "}
          <code className="text-dash-text/65">/players/nfl/trending/add</code> (72h lookback in our API). This is a
          practical proxy, not a Sleeper-published dynasty ADP list.
        </p>
        <p>
          Official reference:{" "}
          <a href="https://docs.sleeper.com" className="text-dash-primary hover:underline" target="_blank" rel="noreferrer">
            docs.sleeper.com
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
