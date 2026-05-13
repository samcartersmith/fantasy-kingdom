"use client";

import { useEffect, useState } from "react";
import type { CatalogAsset, LineItem } from "@/lib/trade-types";
import { catalogPositionIncludesQb, effectiveValue } from "@/lib/trade-types";
import { formatEvaluationTeaser } from "@/lib/trade-evaluation-format";
import { PlayerHeadshot } from "@/components/trade/PlayerHeadshot";

type Props = {
  side: 1 | 2;
  title: string;
  description: string;
  lines: { line: LineItem; asset: CatalogAsset }[];
  superflex: boolean;
  /** When true, `asset.value` already reflects league format from the server (no client QB bump). */
  leagueFormatApplied: boolean;
  onRemove: (lineId: string) => void;
  /** Increment to replay one-shot add highlight on this side. */
  flashTick?: number;
};

export function TeamSide({
  side,
  title,
  description,
  lines,
  superflex,
  leagueFormatApplied,
  onRemove,
  flashTick = 0,
}: Props) {
  const headingId = `team-${side}-heading`;
  const regionLabel = `${title} trade pieces`;
  const [flashPlay, setFlashPlay] = useState(false);

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

  return (
    <section
      aria-label={regionLabel}
      className={`dash-glass-panel rounded-[var(--dash-radius-md)] p-4 sm:p-6 flex flex-col min-h-[280px] ${flashPlay ? "dash-animate-team-flash" : ""}`}
      onAnimationEnd={(e) => {
        if (e.animationName === "dash-team-flash") setFlashPlay(false);
      }}
    >
      <header className="mb-4 space-y-1">
        <h2 id={headingId} className="text-lg font-bold tracking-tight text-dash-text">
          {title}
        </h2>
        <p className="text-xs text-dash-text/55">{description}</p>
        <p className="text-sm font-mono font-semibold text-dash-text pt-2 tabular-nums">
          Subtotal: {total.toLocaleString()}
        </p>
      </header>

      {lines.length === 0 ? (
        <p className="text-sm text-dash-text/55 mt-auto">No pieces yet. Add from the search list above.</p>
      ) : (
        <ul className="space-y-2 flex-1" aria-labelledby={headingId}>
          {lines.map(({ line, asset }) => {
            const eff = effectiveValue(asset, effOpts);
            return (
              <li
                key={line.lineId}
                className="flex items-start justify-between gap-3 rounded-[var(--dash-radius-sm)] border border-white/10 bg-black/25 px-3 py-2"
              >
                <div className="min-w-0 flex gap-3 flex-1">
                  {asset.kind === "player" ? (
                    <PlayerHeadshot imageUrl={asset.imageUrl} name={asset.name} />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-dash-text truncate">{asset.name}</p>
                    <p className="text-xs font-mono text-dash-text/55">
                      {asset.kind === "pick" ? "Pick" : `${asset.position} · ${asset.team}`} ·{" "}
                      {eff.toLocaleString()}
                      {superflex &&
                      !leagueFormatApplied &&
                      asset.kind === "player" &&
                      catalogPositionIncludesQb(asset.position) &&
                      eff !== asset.value ? (
                        <span className="text-dash-text/45"> (base {asset.value.toLocaleString()})</span>
                      ) : null}
                    </p>
                    {asset.evaluation ? (
                      <p className="text-[10px] text-dash-text/48 leading-snug mt-0.5">
                        {formatEvaluationTeaser(asset.evaluation)}
                      </p>
                    ) : null}
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
      )}
    </section>
  );
}
