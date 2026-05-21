"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CatalogAsset,
  CatalogSkillPosition,
  LineItem,
} from "@/lib/trade-types";
import type { StartingSlotCounts } from "@/lib/trade-model/types";
import { DEFAULT_STARTING_SLOTS } from "@/lib/trade-model/types";
import {
  SUPERFLEX_QB_MULTIPLIER,
  catalogPlayerHasSkillPosition,
  catalogPositionIncludesQb,
  effectiveValue,
} from "@/lib/trade-types";
import { filterTradeCatalogSuggestions } from "@/lib/trade-catalog-filter";
import { PlayerHeadshot } from "@/components/trade/PlayerHeadshot";
import { TradeFeaturedLinks } from "@/components/trade/TradeFeaturedLinks";
import { TradeEvaluateModal } from "@/components/trade/TradeEvaluateModal";
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

/** League / PPR selects — softer edge than glass panels; chevron via `.dash-trade-select` in globals.css */
const selectFieldClass =
  "dash-trade-select min-h-11 w-auto max-w-full min-w-0 cursor-pointer rounded-[var(--dash-radius-sm)] border border-white/15 py-2 text-sm text-dash-text";

const btnPress =
  "cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97]";

function StarterSlotRow({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: StartingSlotCounts["startQb"];
  onChange: (v: StartingSlotCounts["startQb"]) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="text-sm font-medium text-dash-text/85">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) =>
          onChange(Number(e.target.value) as StartingSlotCounts["startQb"])
        }
        className={`${selectFieldClass} min-w-[4.5rem]`}
      >
        {START_SLOT_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}

const CATALOG_TABS = ["Picks", "QB", "RB", "WR", "TE"] as const;
type CatalogTab = (typeof CATALOG_TABS)[number];

const START_SLOT_OPTIONS = [1, 2, 3, 4] as const;

export function TradeCalculator() {
  const nextLineId = useLineId();
  const [superflex, setSuperflex] = useState(false);
  const [leagueSize, setLeagueSize] = useState<8 | 10 | 12 | 14>(12);
  const [ppr, setPpr] = useState<1 | 0.5 | 0>(1);
  const [starters, setStarters] = useState<StartingSlotCounts>(() => ({
    ...DEFAULT_STARTING_SLOTS,
  }));
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [evaluateModalOpen, setEvaluateModalOpen] = useState(false);
  const [startersDraft, setStartersDraft] = useState<StartingSlotCounts>(
    () => ({ ...DEFAULT_STARTING_SLOTS }),
  );
  const rosterDialogRef = useRef<HTMLDivElement>(null);
  const evaluateDialogRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [catalogTab, setCatalogTab] = useState<CatalogTab>("Picks");
  const [team1, setTeam1] = useState<LineItem[]>([]);
  const [team2, setTeam2] = useState<LineItem[]>([]);

  const [catalog, setCatalog] = useState<CatalogAsset[] | null>(null);
  const [catalogMeta, setCatalogMeta] = useState<TradeCatalogMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flashTicks, setFlashTicks] = useState<Record<1 | 2, number>>({
    1: 0,
    2: 0,
  });
  const [addAnnounced, setAddAnnounced] = useState("");

  const leagueFormatApplied = catalogMeta?.leagueFormatApplied === true;

  useEffect(() => {
    if (!rosterModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRosterModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rosterModalOpen]);

  useEffect(() => {
    if (!evaluateModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEvaluateModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [evaluateModalOpen]);

  useEffect(() => {
    if (!rosterModalOpen) return;
    const id = window.requestAnimationFrame(() => {
      const root = rosterDialogRef.current;
      if (!root) return;
      const focusable = root.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [rosterModalOpen]);

  useEffect(() => {
    if (!evaluateModalOpen) return;
    const id = window.requestAnimationFrame(() => {
      const root = evaluateDialogRef.current;
      if (!root) return;
      const focusable = root.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [evaluateModalOpen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const params = new URLSearchParams();
        params.set("superflex", superflex ? "1" : "0");
        params.set("ppr", String(ppr));
        params.set("league_size", String(leagueSize));
        params.set("start_qb", String(starters.startQb));
        params.set("start_rb", String(starters.startRb));
        params.set("start_wr", String(starters.startWr));
        params.set("start_te", String(starters.startTe));
        params.set("start_flex", String(starters.startFlex));
        const res = await fetch(`/api/trade-catalog?${params.toString()}`, {
          cache: "no-store",
        });
        const body = (await res.json()) as TradeCatalogResponse & {
          error?: string;
        };
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
          setLoadError(
            e instanceof Error ? e.message : "Failed to load catalog",
          );
          setCatalog(null);
          setCatalogMeta(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [superflex, ppr, leagueSize, starters]);

  const effOpts = useMemo(
    () => ({ superflex, leagueFormatApplied }),
    [superflex, leagueFormatApplied],
  );

  const assetById = useMemo(
    () => (catalog ? buildAssetMap(catalog) : new Map<string, CatalogAsset>()),
    [catalog],
  );

  const catalogForTab = useMemo(() => {
    if (!catalog?.length) return [];
    if (catalogTab === "Picks") {
      return catalog.filter((a) => a.kind === "pick");
    }
    const skill = catalogTab as CatalogSkillPosition;
    return catalog.filter(
      (a) =>
        a.kind === "player" && catalogPlayerHasSkillPosition(a.position, skill),
    );
  }, [catalog, catalogTab]);

  const filtered = useMemo(
    () =>
      catalogForTab.length
        ? filterTradeCatalogSuggestions(catalogForTab, query, effOpts)
        : [],
    [catalogForTab, query, effOpts],
  );

  const catalogTabEmptyHint = useMemo(() => {
    switch (catalogTab) {
      case "Picks":
        return "Draft picks — type to filter.";
      case "QB":
        return "QBs sorted by trade points — type to search.";
      case "RB":
        return "RBs sorted by trade points — type to search.";
      case "WR":
        return "WRs sorted by trade points — type to search.";
      case "TE":
        return "TEs sorted by trade points — type to search.";
      default:
        return "Type to search within this tab.";
    }
  }, [catalogTab]);

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

  const openRosterModal = useCallback(() => {
    setStartersDraft({ ...starters });
    setRosterModalOpen(true);
  }, [starters]);

  const applyRosterDraft = useCallback(() => {
    setStarters({ ...startersDraft });
    setRosterModalOpen(false);
  }, [startersDraft]);

  const cancelRosterModal = useCallback(() => {
    setRosterModalOpen(false);
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

  const assignedAssetIds = useMemo(
    () =>
      new Set<string>([
        ...team1.map((l) => l.assetId),
        ...team2.map((l) => l.assetId),
      ]),
    [team1, team2],
  );

  const sum = useCallback(
    (lines: { asset: CatalogAsset }[]) =>
      lines.reduce((acc, { asset }) => acc + effectiveValue(asset, effOpts), 0),
    [effOpts],
  );

  const total1 = sum(t1Resolved);
  const total2 = sum(t2Resolved);

  const canEvaluateTrade = team1.length > 0 && team2.length > 0;

  useEffect(() => {
    if (!canEvaluateTrade && evaluateModalOpen) setEvaluateModalOpen(false);
  }, [canEvaluateTrade, evaluateModalOpen]);

  if (loadError) {
    return (
      <div
        role="alert"
        className="dash-glass-panel rounded-[var(--dash-radius-md)] p-6 ring-1 ring-dash-danger/40 border border-dash-danger/30"
      >
        <p className="font-semibold text-dash-danger">
          Could not load player data
        </p>
        <p className="text-sm text-dash-text/75 mt-2">{loadError}</p>
        <p className="text-xs text-dash-text/55 mt-3">
          The catalog is built from the Sleeper read-only API. Check your
          network or try again later.
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
        <p className="text-sm text-dash-text/70">
          Loading NFL players from Sleeper…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p
        id="trade-add-status"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {addAnnounced}
      </p>

      <div className="2xl:grid 2xl:grid-cols-[minmax(0,1fr)_16rem] 2xl:gap-8 2xl:items-start">
        <div className="min-w-0 w-full max-w-[72rem] justify-self-start space-y-8 mx-auto 2xl:mx-0">
          <TotalsSummary
            total1={total1}
            total2={total2}
            evaluateAction={
              canEvaluateTrade ? (
                <button
                  type="button"
                  onClick={() => setEvaluateModalOpen(true)}
                  className={`${btnPress} w-full sm:w-auto min-h-11 text-sm font-semibold px-4 rounded-[var(--dash-radius-sm)] border border-dash-primary/50 bg-dash-primary/20 text-dash-text hover:bg-dash-primary/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface`}
                >
                  Evaluate Trade
                </button>
              ) : null
            }
          />
          <div className="dash-glass-panel rounded-[var(--dash-radius-md)] p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <label
                    htmlFor="trade-league-size"
                    className="text-sm font-medium text-dash-text/85 shrink-0"
                  >
                    League size
                  </label>
                  <select
                    id="trade-league-size"
                    value={leagueSize}
                    onChange={(e) =>
                      setLeagueSize(Number(e.target.value) as 8 | 10 | 12 | 14)
                    }
                    className={selectFieldClass}
                  >
                    <option value={8}>8 teams</option>
                    <option value={10}>10 teams</option>
                    <option value={12}>12 teams</option>
                    <option value={14}>14 teams</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <label
                    htmlFor="trade-ppr"
                    className="text-sm font-medium text-dash-text/85 shrink-0"
                  >
                    PPR
                  </label>
                  <select
                    id="trade-ppr"
                    value={String(ppr)}
                    onChange={(e) =>
                      setPpr(Number(e.target.value) as 1 | 0.5 | 0)
                    }
                    className={selectFieldClass}
                  >
                    <option value={1}>Full PPR (1.0)</option>
                    <option value={0.5}>Half PPR (0.5)</option>
                    <option value={0}>Non-PPR (0)</option>
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 min-w-0">
                  <span
                    id="trade-superflex-label"
                    className="text-sm font-medium text-dash-text/85 shrink-0"
                  >
                    Superflex
                  </span>
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
                  {!leagueFormatApplied ? (
                    <span className="text-xs text-dash-text/55 leading-snug min-w-0 max-w-full sm:max-w-[14rem]">
                      {`QB values ×${SUPERFLEX_QB_MULTIPLIER} when on (applied client-side for legacy catalog).`}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={openRosterModal}
                  className={`${btnPress} min-h-11 text-sm font-medium px-3 rounded-[var(--dash-radius-sm)] border border-white/15 text-dash-text hover:bg-white/5 transition-colors shrink-0 self-start sm:self-center`}
                >
                  Roster
                </button>
              </div>
              <button
                type="button"
                onClick={clearAll}
                className={`${btnPress} min-h-11 text-sm font-medium px-4 rounded-[var(--dash-radius-sm)] border border-white/15 text-dash-text hover:bg-white/5 transition-colors self-start lg:self-center shrink-0`}
              >
                Clear both sides
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            <TeamSide
              side={1}
              title="Team 1"
              catalog={catalog}
              lines={t1Resolved}
              superflex={superflex}
              leagueFormatApplied={leagueFormatApplied}
              excludeAssetIds={assignedAssetIds}
              flashTick={flashTicks[1]}
              onAddAsset={(asset: CatalogAsset) =>
                addTo(1, asset.id, asset.name)
              }
              onRemove={(lineId) => removeFrom(1, lineId)}
            />
            <TeamSide
              side={2}
              title="Team 2"
              catalog={catalog}
              lines={t2Resolved}
              superflex={superflex}
              leagueFormatApplied={leagueFormatApplied}
              excludeAssetIds={assignedAssetIds}
              flashTick={flashTicks[2]}
              onAddAsset={(asset: CatalogAsset) =>
                addTo(2, asset.id, asset.name)
              }
              onRemove={(lineId) => removeFrom(2, lineId)}
            />
          </div>

          <section
            aria-labelledby="trade-search-heading"
            className="dash-glass-panel rounded-[var(--dash-radius-md)] p-4 sm:p-6 space-y-4"
          >
            <h2
              id="trade-search-heading"
              className="dash-heading-section text-dash-text"
            >
              Add players or picks
            </h2>
            <div
              role="tablist"
              aria-label="Catalog filter"
              className="flex flex-wrap gap-2"
            >
              {CATALOG_TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  id={`trade-catalog-tab-${t}`}
                  aria-selected={catalogTab === t}
                  aria-controls="trade-catalog-results"
                  onClick={() => setCatalogTab(t)}
                  className={`min-h-11 px-3 rounded-[var(--dash-radius-sm)] text-sm font-medium border cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97] ${
                    catalogTab === t
                      ? "bg-dash-primary text-dash-text border-dash-primary"
                      : "bg-black/25 text-dash-text/85 border-white/15 hover:bg-white/5"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <label
                htmlFor="trade-asset-search"
                className="text-sm font-medium text-dash-text/85"
              >
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
            <ul
              id="trade-catalog-results"
              className="dash-scrollbar divide-y divide-white/10 rounded-[var(--dash-radius-sm)] border border-white/10 overflow-hidden max-h-[min(480px,50vh)] overflow-y-scroll bg-black/25"
              role="list"
            >
              {filtered.map((asset) => (
                <li
                  key={asset.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 py-3 bg-black/20 hover:bg-white/[0.06] transition-colors"
                >
                  <div className="min-w-0 flex-1 flex items-start gap-3">
                    {asset.kind === "player" ? (
                      <PlayerHeadshot
                        imageUrl={asset.imageUrl}
                        name={asset.name}
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-dash-text truncate">
                        {asset.name}
                      </p>
                      <p className="text-xs font-mono text-dash-text/60">
                        {asset.kind === "pick"
                          ? "Draft pick"
                          : `${asset.position} · ${asset.team}${
                              typeof asset.age === "number" &&
                              Number.isFinite(asset.age)
                                ? ` · age ${asset.age}`
                                : ""
                            }`}{" "}
                        · trade pts{" "}
                        {effectiveValue(asset, effOpts).toLocaleString()}
                        {asset.kind === "player" ? (
                          <span className="text-dash-text/45">
                            {" "}
                            · Sleeper search rank{" "}
                            {asset.sleeperSearchRank ?? "—"} · adds{" "}
                            {asset.sleeperTrendingAdds ?? 0}
                          </span>
                        ) : null}
                        {!leagueFormatApplied &&
                        superflex &&
                        asset.kind === "player" &&
                        catalogPositionIncludesQb(asset.position) ? (
                          <span className="text-dash-text/45">
                            {" "}
                            (base {asset.value.toLocaleString()})
                          </span>
                        ) : null}
                      </p>
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
            {!query.trim() && filtered.length > 0 ? (
              <p className="text-xs text-dash-text/55">{catalogTabEmptyHint}</p>
            ) : null}
            {filtered.length === 0 && query.trim() ? (
              <p className="text-sm text-dash-text/60">
                No matches. Try another search.
              </p>
            ) : null}
            {filtered.length === 0 && !query.trim() ? (
              <p className="text-xs text-dash-text/55">Nothing in this tab.</p>
            ) : null}
          </section>
        </div>

        <div className="mt-8 shrink-0 2xl:mt-0 2xl:sticky 2xl:top-20 2xl:self-start">
          <TradeFeaturedLinks />
        </div>
      </div>

      <TradeEvaluateModal
        open={evaluateModalOpen}
        onClose={() => setEvaluateModalOpen(false)}
        panelRef={evaluateDialogRef}
        team1Title="Team 1"
        team2Title="Team 2"
        side1Lines={t1Resolved}
        side2Lines={t2Resolved}
        total1={total1}
        total2={total2}
        effOpts={effOpts}
        catalog={catalog}
        excludeAssetIds={assignedAssetIds}
      />

      {rosterModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55"
          role="presentation"
          onClick={cancelRosterModal}
        >
          <div
            ref={rosterDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="trade-roster-title"
            className="max-w-md w-full bg-dash-surface-elevated p-5 sm:p-6 rounded-[var(--dash-radius-md)] border border-white/15 shadow-xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="trade-roster-title"
              className="dash-heading-section text-dash-text mb-2"
            >
              Starting lineup (per team)
            </h2>
            <p className="text-xs text-dash-text/60 mb-4">
              Counts are sent to the trade catalog API for VBD-style scarcity.
              Each slot is 1–4 starters.
            </p>
            <div className="divide-y divide-white/10 border-y border-white/10 mb-5">
              <StarterSlotRow
                id="trade-start-qb"
                label="QB"
                value={startersDraft.startQb}
                onChange={(v) =>
                  setStartersDraft((s) => ({ ...s, startQb: v }))
                }
              />
              <StarterSlotRow
                id="trade-start-rb"
                label="RB"
                value={startersDraft.startRb}
                onChange={(v) =>
                  setStartersDraft((s) => ({ ...s, startRb: v }))
                }
              />
              <StarterSlotRow
                id="trade-start-wr"
                label="WR"
                value={startersDraft.startWr}
                onChange={(v) =>
                  setStartersDraft((s) => ({ ...s, startWr: v }))
                }
              />
              <StarterSlotRow
                id="trade-start-te"
                label="TE"
                value={startersDraft.startTe}
                onChange={(v) =>
                  setStartersDraft((s) => ({ ...s, startTe: v }))
                }
              />
              <StarterSlotRow
                id="trade-start-flex"
                label="FLEX (RB/WR/TE)"
                value={startersDraft.startFlex}
                onChange={(v) =>
                  setStartersDraft((s) => ({ ...s, startFlex: v }))
                }
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={cancelRosterModal}
                className={`${btnPress} min-h-11 text-sm font-medium px-4 rounded-[var(--dash-radius-sm)] border border-white/15 text-dash-text hover:bg-white/5 transition-colors`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyRosterDraft}
                className={`${btnPress} min-h-11 text-sm font-semibold px-4 rounded-[var(--dash-radius-sm)] bg-dash-primary text-dash-text hover:bg-dash-primary/90 transition-colors`}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
