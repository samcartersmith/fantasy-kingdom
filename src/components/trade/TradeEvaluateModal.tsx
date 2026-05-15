"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import type { CatalogAsset, LineItem } from "@/lib/trade-types";
import { effectiveValue } from "@/lib/trade-types";
import {
  WHY_UNEVEN_TRADE_BULLETS,
  balanceSuggestion,
  fairnessNarrative,
  fairnessTierFromDelta,
  gapPoints,
  lighterSide,
  pickCatalogAssetNearGap,
  tradeDelta,
  tradeEvaluationHeadline,
} from "@/lib/trade-evaluation-copy";
import { ComparisonShareBar } from "@/components/trade/ComparisonShareBar";
import { PlayerHeadshot } from "@/components/trade/PlayerHeadshot";

export type TradeEvaluateResolvedLine = { line: LineItem; asset: CatalogAsset };

type Props = {
  open: boolean;
  onClose: () => void;
  /** For initial focus when opening (parent matches roster modal pattern). */
  panelRef?: RefObject<HTMLDivElement | null>;
  team1Title: string;
  team2Title: string;
  side1Lines: TradeEvaluateResolvedLine[];
  side2Lines: TradeEvaluateResolvedLine[];
  total1: number;
  total2: number;
  effOpts: { superflex: boolean; leagueFormatApplied?: boolean };
  catalog: CatalogAsset[];
  excludeAssetIds: ReadonlySet<string>;
};

const btnPress =
  "cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97]";

function assetSubtitle(asset: CatalogAsset, eff: number): string {
  if (asset.kind === "pick") return `Draft pick · ${eff.toLocaleString()} trade pts`;
  const age =
    typeof asset.age === "number" && Number.isFinite(asset.age) ? ` · age ${asset.age}` : "";
  return `${asset.position ?? "—"} · ${asset.team ?? "—"}${age} · ${eff.toLocaleString()} trade pts`;
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function PackageSection({
  id,
  title,
  total,
  lines,
  effOpts,
}: {
  id: string;
  title: string;
  total: number;
  lines: TradeEvaluateResolvedLine[];
  effOpts: Props["effOpts"];
}) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="dash-heading-subsection text-dash-text mb-2">
        {title} — package ({total.toLocaleString()})
      </h3>
      <ul className="border border-white/10 rounded-[var(--dash-radius-sm)] divide-y divide-white/10 overflow-hidden">
        {lines.map(({ line, asset }) => {
          const eff = effectiveValue(asset, effOpts);
          return (
            <li key={line.lineId} className="px-3 py-2 bg-black/20 flex items-start gap-3">
              {asset.kind === "player" ? (
                <PlayerHeadshot imageUrl={asset.imageUrl} name={asset.name} />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-dash-text truncate">{asset.name}</p>
                <p className="text-xs font-mono text-dash-text/60">{assetSubtitle(asset, eff)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function TradeEvaluateModal({
  open,
  onClose,
  panelRef,
  team1Title,
  team2Title,
  side1Lines,
  side2Lines,
  total1,
  total2,
  effOpts,
  catalog,
  excludeAssetIds,
}: Props) {
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const el = scrollBodyRef.current;
    if (el) el.scrollTop = 0;
  }, [open]);

  if (!open) return null;

  const delta = tradeDelta(total1, total2);
  const tier = fairnessTierFromDelta(delta);
  const gap = gapPoints(total1, total2);
  const light = lighterSide(total1, total2);
  const showUnevenSections = tier !== "even";

  const balancePick =
    showUnevenSections && light !== null
      ? pickCatalogAssetNearGap(catalog, excludeAssetIds, gap, effOpts)
      : null;
  const balanceExample = balancePick
    ? { name: balancePick.asset.name, value: balancePick.value }
    : null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/55"
      role="presentation"
      onClick={onClose}
    >
      {/*
        Match <main> in layout.tsx exactly: one `max-w-6xl mx-auto px-*` wrapper (no extra horizontal
        padding outside it), so the dialog width matches the trade calculator content column.
      */}
      <div className="min-h-full flex flex-col justify-center py-4 sm:py-6 lg:py-8">
        <div
          className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 min-h-0 flex flex-col"
          onClick={onClose}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="trade-evaluate-title"
            className="w-full max-h-[min(92vh,880px)] flex flex-col bg-dash-surface-elevated rounded-[var(--dash-radius-md)] border border-white/15 shadow-xl ring-1 ring-white/10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-start justify-between gap-4 px-5 pt-5 pb-4 sm:px-6 sm:pt-6 border-b border-white/10">
              <h2
                id="trade-evaluate-title"
                className="dash-heading-section text-dash-text pr-2 min-w-0"
              >
                Trade Evaluation
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className={`${btnPress} shrink-0 -m-2 p-2 rounded-[var(--dash-radius-sm)] text-dash-text/80 hover:text-dash-text hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface`}
              >
                <CloseIcon />
              </button>
            </div>

            <div
              ref={scrollBodyRef}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5"
            >
              <p className="text-sm sm:text-base text-dash-text/85 leading-snug mb-4">
                {tradeEvaluationHeadline(total1, total2)}
              </p>
              <ComparisonShareBar total1={total1} total2={total2} className="mb-6" />

              <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-8 gap-6 text-sm text-dash-text/90">
                <PackageSection
                  id="trade-eval-package-1"
                  title={team1Title}
                  total={total1}
                  lines={side1Lines}
                  effOpts={effOpts}
                />
                <PackageSection
                  id="trade-eval-package-2"
                  title={team2Title}
                  total={total2}
                  lines={side2Lines}
                  effOpts={effOpts}
                />
              </div>

              <div className="mt-6 space-y-5 text-sm text-dash-text/90">
                <section aria-labelledby="trade-eval-fairness">
                  <h4
                    id="trade-eval-fairness"
                    className="text-sm font-semibold uppercase tracking-wide text-dash-text/70 mb-1"
                  >
                    Fairness
                  </h4>
                  <p className="text-sm text-dash-text/85 leading-relaxed">{fairnessNarrative(tier, delta)}</p>
                </section>

                {showUnevenSections ? (
                  <section aria-labelledby="trade-eval-why">
                    <h4
                      id="trade-eval-why"
                      className="text-sm font-semibold uppercase tracking-wide text-dash-text/70 mb-2"
                    >
                      Why you might still consider an uneven trade
                    </h4>
                    <ul className="list-disc pl-5 space-y-1.5 text-dash-text/80 text-sm">
                      {WHY_UNEVEN_TRADE_BULLETS.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {showUnevenSections && light !== null ? (
                  <section aria-labelledby="trade-eval-balance">
                    <h4
                      id="trade-eval-balance"
                      className="text-sm font-semibold uppercase tracking-wide text-dash-text/70 mb-1"
                    >
                      Ideas to even things up
                    </h4>
                    <p className="text-sm text-dash-text/85 leading-relaxed">
                      {balanceSuggestion(light, gap, balanceExample)}
                    </p>
                  </section>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
