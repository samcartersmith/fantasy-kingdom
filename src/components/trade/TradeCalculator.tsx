"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogAsset, LineItem } from "@/lib/trade-types";
import { SUPERFLEX_QB_MULTIPLIER, effectiveValue } from "@/lib/trade-types";
import { TeamSide } from "@/components/trade/TeamSide";
import { TotalsSummary } from "@/components/trade/TotalsSummary";

type TradeCatalogResponse = {
  assets: CatalogAsset[];
  meta?: { pickCount?: number; playerCount?: number };
};

function useLineId() {
  const ref = useRef(0);
  return useCallback(() => {
    ref.current += 1;
    return `line-${ref.current}`;
  }, []);
}

function buildAssetMap(assets: CatalogAsset[]): Map<string, CatalogAsset> {
  return new Map(assets.map((a) => [a.id, a]));
}

export function TradeCalculator() {
  const nextLineId = useLineId();
  const [superflex, setSuperflex] = useState(false);
  const [query, setQuery] = useState("");
  const [team1, setTeam1] = useState<LineItem[]>([]);
  const [team2, setTeam2] = useState<LineItem[]>([]);

  const [catalog, setCatalog] = useState<CatalogAsset[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const res = await fetch("/api/trade-catalog", { cache: "no-store" });
        const body = (await res.json()) as TradeCatalogResponse & { error?: string };
        if (!res.ok) {
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        if (!body.assets?.length) {
          throw new Error("Empty catalog response");
        }
        if (!cancelled) setCatalog(body.assets);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load catalog");
          setCatalog(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const assetById = useMemo(() => (catalog ? buildAssetMap(catalog) : new Map<string, CatalogAsset>()), [catalog]);

  const filtered = useMemo(() => {
    if (!catalog?.length) return [];
    const q = query.trim().toLowerCase();
    if (!q) {
      return catalog.filter((a) => a.kind === "pick");
    }
    const matches = catalog.filter((a) => {
      const blob = [a.name, a.position, a.team, a.kind]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
    matches.sort((a, b) => {
      const ap = a.kind === "pick" ? 0 : 1;
      const bp = b.kind === "pick" ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.name.localeCompare(b.name);
    });
    return matches.slice(0, 40);
  }, [catalog, query]);

  const addTo = useCallback(
    (side: 1 | 2, assetId: string) => {
      const line: LineItem = { lineId: nextLineId(), assetId };
      if (side === 1) setTeam1((prev) => [...prev, line]);
      else setTeam2((prev) => [...prev, line]);
    },
    [nextLineId],
  );

  const removeFrom = useCallback((side: 1 | 2, lineId: string) => {
    if (side === 1) setTeam1((prev) => prev.filter((l) => l.lineId !== lineId));
    else setTeam2((prev) => prev.filter((l) => l.lineId !== lineId));
  }, []);

  const clearAll = useCallback(() => {
    setTeam1([]);
    setTeam2([]);
  }, []);

  const resolveLines = useCallback(
    (lines: LineItem[]) =>
      lines
        .map((l) => {
          const asset = assetById.get(l.assetId);
          return asset ? { line: l, asset } : null;
        })
        .filter(Boolean) as { line: LineItem; asset: CatalogAsset }[],
    [assetById],
  );

  const t1Resolved = resolveLines(team1);
  const t2Resolved = resolveLines(team2);

  const sum = useCallback(
    (lines: { asset: CatalogAsset }[]) =>
      lines.reduce(
        (acc, { asset }) => acc + effectiveValue(asset, { superflex }),
        0,
      ),
    [superflex],
  );

  const total1 = sum(t1Resolved);
  const total2 = sum(t2Resolved);

  if (loadError) {
    return (
      <div
        role="alert"
        className="dash-glass-panel rounded-[var(--dash-radius-md)] p-6 ring-1 ring-dash-danger/40 border border-dash-danger/30"
      >
        <p className="font-semibold text-dash-danger">Could not load player data</p>
        <p className="text-sm text-dash-text/75 mt-2">{loadError}</p>
        <p className="text-xs text-dash-text/55 mt-3">
          The catalog is built from the Sleeper read-only API. Check your network or try again later.
        </p>
      </div>
    );
  }

  if (!catalog) {
    return (
      <div
        className="dash-glass-panel rounded-[var(--dash-radius-md)] p-8 ring-1 ring-white/[0.06] flex flex-col items-center gap-3"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="h-8 w-8 border-2 border-dash-primary border-t-transparent rounded-full motion-safe:animate-spin" />
        <p className="text-sm text-dash-text/70">Loading NFL players from Sleeper…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-xs text-dash-text/55">
        Players and teams come from the{" "}
        <a
          href="https://docs.sleeper.com"
          className="text-dash-primary hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Sleeper API
        </a>{" "}
        (cached ~24h). Trade values use the same Sleeper-derived heuristic as{" "}
        <a href="/rankings" className="text-dash-primary hover:underline">
          rankings
        </a>{" "}
        (search rank + trending adds — not a market dollar).
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 dash-glass-panel rounded-[var(--dash-radius-md)] p-4 sm:p-5 ring-1 ring-white/[0.06]">
        <div className="flex items-start gap-3 min-h-11">
          <input
            id="superflex-toggle"
            type="checkbox"
            checked={superflex}
            onChange={(e) => setSuperflex(e.target.checked)}
            className="mt-1 size-5 shrink-0 rounded border-white/30 bg-black/30 text-dash-primary focus:ring-2 focus:ring-dash-primary focus:ring-offset-2 focus:ring-offset-dash-surface"
          />
          <label htmlFor="superflex-toggle" className="text-sm font-medium cursor-pointer select-none text-dash-text">
            Superflex mode
            <span className="block text-xs font-normal text-dash-text/60 mt-0.5">
              QB values multiplied by {SUPERFLEX_QB_MULTIPLIER} for demo heuristic only.
            </span>
          </label>
        </div>
        <button
          type="button"
          onClick={clearAll}
          className="self-start sm:self-auto min-h-11 text-sm font-medium px-4 rounded-[var(--dash-radius-sm)] border border-white/20 text-dash-text hover:bg-white/5 transition-colors"
        >
          Clear both sides
        </button>
      </div>

      <section
        aria-labelledby="trade-search-heading"
        className="dash-glass-panel rounded-[var(--dash-radius-md)] p-4 sm:p-6 space-y-4 ring-1 ring-white/[0.06]"
      >
        <h2 id="trade-search-heading" className="text-base font-semibold text-dash-text">
          Add players or picks
        </h2>
        <div className="space-y-2">
          <label htmlFor="trade-asset-search" className="text-sm font-medium text-dash-text/85">
            Search catalog
          </label>
          <input
            id="trade-asset-search"
            type="search"
            autoComplete="off"
            placeholder="Search NFL players or picks (e.g. Allen, 2026 1st)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full min-h-11 rounded-[var(--dash-radius-sm)] border border-white/15 bg-black/35 px-3 py-2 text-sm text-dash-text placeholder:text-dash-text/40"
          />
        </div>
        {!query.trim() ? (
          <p className="text-xs text-dash-text/55">Showing local draft picks — type to search Sleeper NFL players.</p>
        ) : null}
        <ul
          className="divide-y divide-white/10 rounded-[var(--dash-radius-sm)] border border-white/10 overflow-hidden max-h-[min(480px,50vh)] overflow-y-auto"
          role="list"
        >
          {filtered.map((asset) => (
            <li
              key={asset.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 py-3 bg-black/20 hover:bg-white/[0.06] transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-dash-text truncate">{asset.name}</p>
                <p className="text-xs font-mono text-dash-text/60">
                  {asset.kind === "pick"
                    ? "Draft pick"
                    : `${asset.position} · ${asset.team}`}{" "}
                  · value {asset.value.toLocaleString()}
                  {asset.kind === "player" ? (
                    <span className="text-dash-text/45">
                      {" "}
                      · Sleeper search rank {asset.sleeperSearchRank ?? "—"} · adds {asset.sleeperTrendingAdds ?? 0}
                    </span>
                  ) : null}
                  {superflex && asset.position === "QB" ? (
                    <span className="text-dash-success">
                      {" "}
                      → eff. {effectiveValue(asset, { superflex }).toLocaleString()}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => addTo(1, asset.id)}
                  className="min-h-11 text-xs font-semibold px-3 rounded-[var(--dash-radius-sm)] bg-dash-primary text-dash-text hover:bg-dash-primary/90 transition-colors"
                >
                  Add to team 1
                </button>
                <button
                  type="button"
                  onClick={() => addTo(2, asset.id)}
                  className="min-h-11 text-xs font-semibold px-3 rounded-[var(--dash-radius-sm)] border border-dash-secondary/60 bg-dash-secondary/40 text-dash-text hover:bg-dash-secondary/60 transition-colors"
                >
                  Add to team 2
                </button>
              </div>
            </li>
          ))}
        </ul>
        {filtered.length === 0 ? (
          <p className="text-sm text-dash-text/60">No matches. Try another search.</p>
        ) : null}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <TeamSide
          side={1}
          title="Team 1"
          description="Assets on this side of the trade."
          lines={t1Resolved}
          superflex={superflex}
          onRemove={(lineId) => removeFrom(1, lineId)}
        />
        <TeamSide
          side={2}
          title="Team 2"
          description="Assets on this side of the trade."
          lines={t2Resolved}
          superflex={superflex}
          onRemove={(lineId) => removeFrom(2, lineId)}
        />
      </div>

      <TotalsSummary total1={total1} total2={total2} />
    </div>
  );
}
