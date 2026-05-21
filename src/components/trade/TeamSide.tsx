"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { CatalogAsset, LineItem } from "@/lib/trade-types";
import { catalogPositionIncludesQb, effectiveValue } from "@/lib/trade-types";
import {
  TEAM_SIDEBAR_SEARCH_MIN_PLAYER_VALUE,
  filterTradeCatalogSuggestions,
} from "@/lib/trade-catalog-filter";
import { PlayerHeadshot } from "@/components/trade/PlayerHeadshot";

type Props = {
  side: 1 | 2;
  title: string;
  catalog: CatalogAsset[];
  lines: { line: LineItem; asset: CatalogAsset }[];
  superflex: boolean;
  /** When true, `asset.value` already reflects league format from the server (no client QB bump). */
  leagueFormatApplied: boolean;
  /** Assets already on either trade side — hidden from per-team search suggestions. */
  excludeAssetIds: ReadonlySet<string>;
  onAddAsset: (asset: CatalogAsset) => void;
  onRemove: (lineId: string) => void;
  /** Increment to replay one-shot add highlight on this side. */
  flashTick?: number;
};

const teamSearchInputClass =
  "w-full min-h-10 rounded-[var(--dash-radius-sm)] border border-white/15 bg-black/35 px-3 py-2 text-sm text-dash-text placeholder:text-dash-text/40";

const suggestionListClass =
  "dash-scrollbar divide-y divide-white/10 rounded-[var(--dash-radius-sm)] border border-white/10 overflow-hidden max-h-[min(220px,32vh)] overflow-y-auto bg-black/25";

/** Stable DOM id for listbox options (asset ids may contain characters unsafe for HTML ids). */
function comboboxOptionElementId(searchId: string, assetId: string): string {
  return `${searchId}-opt-${encodeURIComponent(assetId).replace(/%/g, "_")}`;
}

export function TeamSide({
  side,
  title,
  catalog,
  lines,
  superflex,
  leagueFormatApplied,
  excludeAssetIds,
  onAddAsset,
  onRemove,
  flashTick = 0,
}: Props) {
  const headingId = `team-${side}-heading`;
  const regionLabel = `${title} trade pieces`;
  const searchId = `trade-team-${side}-search`;
  const listboxId = `${searchId}-listbox`;
  const [flashPlay, setFlashPlay] = useState(false);
  const [teamQuery, setTeamQuery] = useState("");
  const [activeOptionIndex, setActiveOptionIndex] = useState<number | null>(null);
  const activeOptionIndexRef = useRef<number | null>(null);
  activeOptionIndexRef.current = activeOptionIndex;

  useEffect(() => {
    if (flashTick === 0) return;
    setFlashPlay(false);
    const id = requestAnimationFrame(() => {
      setFlashPlay(true);
    });
    const done = window.setTimeout(() => setFlashPlay(false), 600);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(done);
    };
  }, [flashTick]);

  const effOpts = { superflex, leagueFormatApplied };

  const total = lines.reduce((acc, { asset }) => acc + effectiveValue(asset, effOpts), 0);
  const isEmpty = lines.length === 0;

  const teamSuggestions = useMemo(() => {
    const raw = filterTradeCatalogSuggestions(
      catalog,
      teamQuery,
      { superflex, leagueFormatApplied },
      {
        includeEmptyQueryDefaults: false,
        queryMatchCap: 20,
        minPlayerEffectiveValue: TEAM_SIDEBAR_SEARCH_MIN_PLAYER_VALUE,
      },
    );
    if (excludeAssetIds.size === 0) return raw;
    return raw.filter((a) => !excludeAssetIds.has(a.id));
  }, [catalog, teamQuery, superflex, leagueFormatApplied, excludeAssetIds]);

  useEffect(() => {
    setActiveOptionIndex(null);
  }, [teamQuery, teamSuggestions]);

  const listVisible = teamSuggestions.length > 0;

  const handleAddFromSearch = (asset: CatalogAsset) => {
    onAddAsset(asset);
    setTeamQuery("");
    setActiveOptionIndex(null);
  };

  useLayoutEffect(() => {
    if (activeOptionIndex === null || !listVisible) return;
    const asset = teamSuggestions[activeOptionIndex];
    if (!asset) return;
    const el = document.getElementById(comboboxOptionElementId(searchId, asset.id));
    el?.scrollIntoView({ block: "nearest" });
  }, [activeOptionIndex, listVisible, teamSuggestions, searchId]);

  const onComboboxKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = teamSuggestions.length;
    const activeIdx = activeOptionIndexRef.current;

    if (activeIdx !== null && (e.key === "Home" || e.key === "End" || e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      setActiveOptionIndex(null);
      return;
    }

    if (
      activeIdx !== null &&
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      setActiveOptionIndex(null);
      return;
    }

    if (e.key === "Escape") {
      if (activeIdx !== null) {
        e.preventDefault();
        setActiveOptionIndex(null);
        return;
      }
      if (teamQuery.length > 0) {
        e.preventDefault();
        setTeamQuery("");
      }
      return;
    }

    if (n === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveOptionIndex((prev) => {
        if (prev === null) return 0;
        return (prev + 1) % n;
      });
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveOptionIndex((prev) => {
        if (prev === null) return n - 1;
        return (prev - 1 + n) % n;
      });
      return;
    }

    if (e.key === "Enter") {
      if (activeIdx !== null) {
        const asset = teamSuggestions[activeIdx];
        if (asset) {
          e.preventDefault();
          handleAddFromSearch(asset);
        }
      }
    }
  };

  return (
    <section
      aria-label={regionLabel}
      className={`dash-glass-panel rounded-[var(--dash-radius-md)] flex flex-col ${
        isEmpty ? "p-3 sm:p-4" : "p-4 sm:p-6"
      } ${flashPlay ? "dash-animate-team-flash" : ""}`}
      onAnimationEnd={(e) => {
        if (e.animationName === "dash-team-flash") setFlashPlay(false);
      }}
    >
      <header className={isEmpty ? "mb-3" : "mb-4 space-y-1"}>
        <h3 id={headingId} className="dash-heading-subsection text-dash-text">
          {title}
        </h3>
        {!isEmpty ? (
          <p className="text-sm font-mono font-semibold text-dash-text pt-2 tabular-nums">
            Subtotal: {total.toLocaleString()}
          </p>
        ) : null}
      </header>

      {!isEmpty ? (
        <ul className="space-y-2 mb-4" aria-labelledby={headingId}>
          {lines.map(({ line, asset }) => {
            const eff = effectiveValue(asset, effOpts);
            return (
              <li
                key={line.lineId}
                className="flex items-start justify-between gap-3 rounded-[var(--dash-radius-sm)] border border-dash-border bg-black/25 px-3 py-2"
              >
                <div className="min-w-0 flex gap-3 flex-1">
                  {asset.kind === "player" ? (
                    <PlayerHeadshot imageUrl={asset.imageUrl} name={asset.name} />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-dash-text truncate">{asset.name}</p>
                    <p className="text-xs font-mono text-dash-text/55">
                      {asset.kind === "pick"
                        ? "Pick"
                        : `${asset.position} · ${asset.team}${
                            typeof asset.age === "number" && Number.isFinite(asset.age) ? ` · age ${asset.age}` : ""
                          }`}{" "}
                      ·{" "}
                      {eff.toLocaleString()}
                      {superflex &&
                      !leagueFormatApplied &&
                      asset.kind === "player" &&
                      catalogPositionIncludesQb(asset.position) &&
                      eff !== asset.value ? (
                        <span className="text-dash-text/45"> (base {asset.value.toLocaleString()})</span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(line.lineId)}
                  className="shrink-0 min-h-11 min-w-11 cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97] inline-flex items-center justify-center text-xs font-medium text-dash-danger hover:underline rounded-[var(--dash-radius-sm)] px-2"
                  aria-label={`Remove ${asset.name} from ${title}`}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="space-y-2">
        <label htmlFor={searchId} className="text-xs font-medium text-dash-text/75">
          Search catalog — add to {title.toLowerCase()}
        </label>
        {/*
          APG "Editable combobox with list autocomplete": combobox + listbox + aria-activedescendant.
          With includeEmptyQueryDefaults: false, Down/Up with an empty query cannot open a list (no deviation UX).
        */}
        <input
          id={searchId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={listVisible}
          aria-activedescendant={
            activeOptionIndex !== null && teamSuggestions[activeOptionIndex]
              ? comboboxOptionElementId(searchId, teamSuggestions[activeOptionIndex].id)
              : undefined
          }
          autoComplete="off"
          placeholder="Player or pick name…"
          value={teamQuery}
          onChange={(e) => setTeamQuery(e.target.value)}
          onKeyDown={onComboboxKeyDown}
          className={teamSearchInputClass}
        />
        {listVisible ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={`${title} catalog suggestions`}
            className={suggestionListClass}
          >
            {teamSuggestions.map((asset, index) => {
              const optionId = comboboxOptionElementId(searchId, asset.id);
              const isActive = index === activeOptionIndex;
              return (
                <li
                  key={asset.id}
                  id={optionId}
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    handleAddFromSearch(asset);
                  }}
                  className={`p-0 cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.98] ${
                    isActive
                      ? "bg-white/[0.12] ring-2 ring-inset ring-dash-primary"
                      : "bg-black/20 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="w-full text-left flex items-center gap-2 px-2 py-2 min-h-11 pointer-events-none">
                    {asset.kind === "player" ? (
                      <PlayerHeadshot imageUrl={asset.imageUrl} name={asset.name} />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-dash-text truncate">{asset.name}</p>
                      <p className="text-[11px] font-mono text-dash-text/55 truncate">
                        {asset.kind === "pick"
                          ? "Draft pick"
                          : `${asset.position} · ${asset.team}${
                              typeof asset.age === "number" && Number.isFinite(asset.age) ? ` · ${asset.age}` : ""
                            }`}{" "}
                        · {effectiveValue(asset, effOpts).toLocaleString()}
                        {!leagueFormatApplied &&
                        superflex &&
                        asset.kind === "player" &&
                        catalogPositionIncludesQb(asset.position) ? (
                          <span className="text-dash-text/45"> (base {asset.value.toLocaleString()})</span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : teamQuery.trim() ? (
          <p className="text-xs text-dash-text/55">No matches.</p>
        ) : null}
      </div>
    </section>
  );
}
