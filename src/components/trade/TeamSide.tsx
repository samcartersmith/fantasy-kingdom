"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogAsset, LineItem } from "@/lib/trade-types";
import { catalogPositionIncludesQb, effectiveValue } from "@/lib/trade-types";
import { filterTradeCatalogSuggestions } from "@/lib/trade-catalog-filter";
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
  "divide-y divide-white/10 rounded-[var(--dash-radius-sm)] border border-white/10 overflow-hidden max-h-[min(220px,32vh)] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.35)_rgba(0,0,0,0.25)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-black/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/30";

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
  const [flashPlay, setFlashPlay] = useState(false);
  const [teamQuery, setTeamQuery] = useState("");

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
      },
    );
    if (excludeAssetIds.size === 0) return raw;
    return raw.filter((a) => !excludeAssetIds.has(a.id));
  }, [catalog, teamQuery, superflex, leagueFormatApplied, excludeAssetIds]);

  const handleAddFromSearch = (asset: CatalogAsset) => {
    onAddAsset(asset);
    setTeamQuery("");
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
        <h2 id={headingId} className="text-lg font-bold tracking-tight text-dash-text">
          {title}
        </h2>
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
        <input
          id={searchId}
          type="search"
          autoComplete="off"
          placeholder="Player or pick name…"
          value={teamQuery}
          onChange={(e) => setTeamQuery(e.target.value)}
          className={teamSearchInputClass}
        />
        {teamSuggestions.length > 0 ? (
          <ul className={suggestionListClass} role="list">
            {teamSuggestions.map((asset) => (
              <li key={asset.id} className="p-0">
                <button
                  type="button"
                  onClick={() => handleAddFromSearch(asset)}
                  aria-label={`Add ${asset.name} to ${title}`}
                  className="w-full text-left flex items-center gap-2 px-2 py-2 min-h-11 bg-black/20 hover:bg-white/[0.06] transition-colors cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dash-primary"
                >
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
                </button>
              </li>
            ))}
          </ul>
        ) : teamQuery.trim() ? (
          <p className="text-xs text-dash-text/55">No matches.</p>
        ) : null}
      </div>
    </section>
  );
}
