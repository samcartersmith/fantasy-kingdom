"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogAsset, LineItem } from "@/lib/trade-types";
import {
  SUPERFLEX_QB_MULTIPLIER,
  catalogPositionIncludesQb,
  effectiveValue,
} from "@/lib/trade-types";
import { formatEvaluationTeaser } from "@/lib/trade-evaluation-format";
import { PlayerHeadshot } from "@/components/trade/PlayerHeadshot";
import { TeamSide } from "@/components/trade/TeamSide";
import { TotalsSummary } from "@/components/trade/TotalsSummary";

type TradeCatalogMeta = {
  pickCount?: number;
  playerCount?: number;
  tradeModelVersion?: string;
  leagueFormatApplied?: boolean;
  legacyHeuristic?: boolean;
  curatedSnapshotAsOf?: string;
  fantasyProfileSnapshotAsOf?: string;
  fantasyProfileSource?: string;
  valueBasis?: string;
};

type TradeCatalogResponse = {
  assets: CatalogAsset[];
  meta?: TradeCatalogMeta;
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

const selectFieldClass =
  "min-h-11 w-full min-w-[8.5rem] cursor-pointer rounded-[var(--dash-radius-sm)] border border-white/15 bg-black/35 px-3 py-2 text-sm text-dash-text";

const btnPress =
  "cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97]";

export function TradeCalculator() {
  const nextLineId = useLineId();
  const [superflex, setSuperflex] = useState(false);
  const [leagueSize, setLeagueSize] = useState<8 | 10 | 12 | 14>(12);
  const [ppr, setPpr] = useState<1 | 0.5 | 0>(1);
  const [query, setQuery] = useState("");
  const [team1, setTeam1] = useState<LineItem[]>([]);
  const [team2, setTeam2] = useState<LineItem[]>([]);

  const [catalog, setCatalog] = useState<CatalogAsset[] | null>(null);
  const [catalogMeta, setCatalogMeta] = useState<TradeCatalogMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flashTicks, setFlashTicks] = useState<Record<1 | 2, number>>({ 1: 0, 2: 0 });
  const [addAnnounced, setAddAnnounced] = useState("");

  const leagueFormatApplied = catalogMeta?.leagueFormatApplied === true;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const params = new URLSearchParams();
        params.set("superflex", superflex ? "1" : "0");
        params.set("ppr", String(ppr));
        params.set("league_size", String(leagueSize));
        const res = await fetch(`/api/trade-catalog?${params.toString()}`, { cache: "no-store" });
        const body = (await res.json()) as TradeCatalogResponse & { error?: string };
        if (!res.ok) {
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        if (!body.assets?.length) {
          throw new Error("Empty catalog response");
        }
        if (!cancelled) {
          setCatalog(body.assets);
          setCatalogMeta(body.meta ?? null);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load catalog");
          setCatalog(null);
          setCatalogMeta(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [superflex, ppr, leagueSize]);

  const effOpts = useMemo(
    () => ({ superflex, leagueFormatApplied }),
    [superflex, leagueFormatApplied],
  );

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
    (side: 1 | 2, assetId: string, displayName: string) => {
      const line: LineItem = { lineId: nextLineId(), assetId };
      if (side === 1) setTeam1((prev) => [...prev, line]);
      else setTeam2((prev) => [...prev, line]);
      setFlashTicks((prev) => ({ ...prev, [side]: prev[side] + 1 }));
      setAddAnnounced(`Added ${displayName} to Team ${side}.`);
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
      lines.reduce((acc, { asset }) => acc + effectiveValue(asset, effOpts), 0),
    [effOpts],
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
        className="dash-glass-panel rounded-[var(--dash-radius-md)] p-8 flex flex-col items-center gap-3"
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
      <p id="trade-add-status" className="sr-only" aria-live="polite" aria-atomic="true">
        {addAnnounced}
      </p>

      <TotalsSummary total1={total1} total2={total2} />

      <div className="dash-glass-panel rounded-[var(--dash-radius-md)] p-4 sm:p-5 space-y-3">
        <div className="flex flex-col gap-4 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:gap-6 flex-1">
            <div className="space-y-1.5 min-w-0 sm:min-w-[9rem]">
              <label htmlFor="trade-league-size" className="text-sm font-medium text-dash-text/85">
                League size
              </label>
              <select
                id="trade-league-size"
                value={leagueSize}
                onChange={(e) => setLeagueSize(Number(e.target.value) as 8 | 10 | 12 | 14)}
                className={selectFieldClass}
              >
                <option value={8}>8 teams</option>
                <option value={10}>10 teams</option>
                <option value={12}>12 teams</option>
                <option value={14}>14 teams</option>
              </select>
            </div>
            <div className="space-y-1.5 min-w-0 sm:min-w-[10.5rem]">
              <label htmlFor="trade-ppr" className="text-sm font-medium text-dash-text/85">
                PPR
              </label>
              <select
                id="trade-ppr"
                value={String(ppr)}
                onChange={(e) => setPpr(Number(e.target.value) as 1 | 0.5 | 0)}
                className={selectFieldClass}
              >
                <option value={1}>Full PPR (1.0)</option>
                <option value={0.5}>Half PPR (0.5)</option>
                <option value={0}>Non-PPR (0)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <span id="trade-superflex-label" className="block text-sm font-medium text-dash-text/85">
                Superflex
              </span>
              <div className="flex items-center gap-3 min-h-11">
                <button
                  type="button"
                  role="switch"
                  aria-checked={superflex}
                  aria-labelledby="trade-superflex-label"
                  onClick={() => setSuperflex((v) => !v)}
                  className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface ${
                    superflex ? "bg-dash-primary" : "bg-white/25"
                  }`}
                >
                  <span
                    className={`pointer-events-none absolute top-1 left-1 block h-5 w-5 rounded-full bg-white shadow motion-safe:transition-transform motion-safe:duration-150 ${
                      superflex ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-xs text-dash-text/55 max-w-[14rem] leading-snug">
                  {leagueFormatApplied
                    ? `When on, QB values include the ×${SUPERFLEX_QB_MULTIPLIER} superflex premium in the catalog from the server.`
                    : `QB values ×${SUPERFLEX_QB_MULTIPLIER} when on (applied client-side for legacy catalog).`}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={clearAll}
            className={`${btnPress} min-h-11 text-sm font-medium px-4 rounded-[var(--dash-radius-sm)] border border-white/20 text-dash-text hover:bg-white/5 transition-colors self-start xl:self-auto`}
          >
            Clear both sides
          </button>
        </div>
        <p className="text-xs text-dash-text/50 leading-relaxed">
          {leagueSize}-team · {ppr === 1 ? "Full PPR" : ppr === 0.5 ? "Half PPR" : "Non-PPR"}
          {leagueFormatApplied
            ? " — these settings are sent to the server so trade points match your league format."
            : " — display context only; legacy catalog uses Sleeper buzz with client-side superflex for QBs."}
        </p>
        {catalogMeta?.tradeModelVersion ? (
          <p className="text-xs text-dash-text/55 leading-relaxed">
            Fair-trade model {catalogMeta.tradeModelVersion}
            {catalogMeta.curatedSnapshotAsOf ? ` · curated tables as of ${catalogMeta.curatedSnapshotAsOf}` : ""}
            {catalogMeta.fantasyProfileSnapshotAsOf
              ? ` · fantasy stat snapshot ${catalogMeta.fantasyProfileSnapshotAsOf}`
              : ""}
            .
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <TeamSide
          side={1}
          title="Team 1"
          description="Assets on this side of the trade."
          lines={t1Resolved}
          superflex={superflex}
          leagueFormatApplied={leagueFormatApplied}
          flashTick={flashTicks[1]}
          onRemove={(lineId) => removeFrom(1, lineId)}
        />
        <TeamSide
          side={2}
          title="Team 2"
          description="Assets on this side of the trade."
          lines={t2Resolved}
          superflex={superflex}
          leagueFormatApplied={leagueFormatApplied}
          flashTick={flashTicks[2]}
          onRemove={(lineId) => removeFrom(2, lineId)}
        />
      </div>

      <section
        aria-labelledby="trade-search-heading"
        className="dash-glass-panel rounded-[var(--dash-radius-md)] p-4 sm:p-6 space-y-4"
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
              <div className="min-w-0 flex-1 flex items-start gap-3">
                {asset.kind === "player" ? (
                  <PlayerHeadshot imageUrl={asset.imageUrl} name={asset.name} />
                ) : null}
                <div className="min-w-0 flex-1">
                <p className="font-medium text-dash-text truncate">{asset.name}</p>
                <p className="text-xs font-mono text-dash-text/60">
                  {asset.kind === "pick"
                    ? "Draft pick"
                    : `${asset.position} · ${asset.team}`}{" "}
                  · trade pts {effectiveValue(asset, effOpts).toLocaleString()}
                  {asset.kind === "player" ? (
                    <span className="text-dash-text/45">
                      {" "}
                      · Sleeper search rank {asset.sleeperSearchRank ?? "—"} · adds {asset.sleeperTrendingAdds ?? 0}
                    </span>
                  ) : null}
                  {!leagueFormatApplied &&
                  superflex &&
                  asset.kind === "player" &&
                  catalogPositionIncludesQb(asset.position) ? (
                    <span className="text-dash-text/45"> (base {asset.value.toLocaleString()})</span>
                  ) : null}
                </p>
                {asset.evaluation ? (
                  <p className="text-[10px] text-dash-text/50 leading-snug mt-0.5">
                    {formatEvaluationTeaser(asset.evaluation)}
                  </p>
                ) : null}
                </div>
              </div>
              <div className="flex flex-wrap shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => addTo(1, asset.id, asset.name)}
                  className={`${btnPress} min-h-11 text-xs font-semibold px-3 rounded-[var(--dash-radius-sm)] bg-dash-primary text-dash-text hover:bg-dash-primary/90 transition-colors`}
                >
                  Add to team 1
                </button>
                <button
                  type="button"
                  onClick={() => addTo(2, asset.id, asset.name)}
                  className={`${btnPress} min-h-11 text-xs font-semibold px-3 rounded-[var(--dash-radius-sm)] border border-dash-secondary/60 bg-dash-secondary/40 text-dash-text hover:bg-dash-secondary/60 transition-colors`}
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
    </div>
  );
}
