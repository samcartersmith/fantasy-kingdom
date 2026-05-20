"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { ComparisonShareBar } from "@/components/trade/ComparisonShareBar";
import { PlayerHeadshot } from "@/components/trade/PlayerHeadshot";
import {
  fairnessNarrative,
  tradeEvaluationHeadline,
} from "@/lib/trade-evaluation-copy";
import type { TradeSuggestion } from "@/lib/trade-suggestions";

type Props = {
  open: boolean;
  onClose: () => void;
  panelRef?: RefObject<HTMLDivElement | null>;
  team1Name: string;
  suggestions: TradeSuggestion[];
  prefetchLoading: boolean;
  remainingLoading: boolean;
  error: string | null;
  valueNote?: string;
};

const btnPress =
  "cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97]";

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

function assetSubtitle(asset: TradeSuggestion["team1Give"][number]): string {
  if (asset.kind === "pick") return `Draft pick · ${asset.value.toLocaleString()} pts`;
  const pos = asset.position ?? "—";
  return `${pos} · ${asset.value.toLocaleString()} pts`;
}

function AssetList({ label, assets }: { label: string; assets: TradeSuggestion["team1Give"] }) {
  if (assets.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-dash-text/65">{label}</p>
      <ul className="border border-dash-border rounded-[var(--dash-radius-sm)] divide-y divide-dash-border/60 overflow-hidden">
        {assets.map((a) => (
          <li key={a.id} className="px-3 py-2.5 bg-black/20 flex items-center gap-3 min-w-0">
            {a.kind === "player" ? (
              <PlayerHeadshot imageUrl={a.imageUrl} name={a.name} />
            ) : (
              <div
                className="size-10 shrink-0 rounded-[var(--dash-radius-sm)] bg-dash-primary/15 ring-1 ring-dash-border flex items-center justify-center text-[10px] font-bold text-dash-primary"
                aria-hidden
              >
                PK
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-dash-text truncate">{a.name}</p>
              <p className="text-xs text-dash-text/60 truncate">{assetSubtitle(a)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuggestionSkeleton({ rank }: { rank: number }) {
  return (
    <li className="rounded-[var(--dash-radius-sm)] border border-white/10 bg-black/20 p-4 animate-pulse space-y-3">
      <div className="h-4 w-32 rounded bg-white/10" />
      <div className="h-3 w-full max-w-md rounded bg-white/10" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-20 rounded bg-white/10" />
        <div className="h-20 rounded bg-white/10" />
      </div>
      <p className="text-xs text-dash-text/50">Loading suggestion #{rank}…</p>
    </li>
  );
}

function SuggestionCard({ suggestion, team1Name }: { suggestion: TradeSuggestion; team1Name: string }) {
  const team2Name = suggestion.team2Name;
  const delta = suggestion.total1 - suggestion.total2;

  return (
    <li className="rounded-[var(--dash-radius-sm)] border border-white/10 bg-black/20 p-4 sm:p-5 space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-dash-primary">
          #{suggestion.rank} · {suggestion.fairnessTier === "even" ? "Balanced" : suggestion.fairnessTier === "lean" ? "Slight lean" : "Value gap"}
        </p>
        <h3 className="dash-heading-subsection text-dash-text">{suggestion.headline}</h3>
        <p className="text-sm text-dash-text/80 leading-relaxed">{suggestion.rationale}</p>
      </div>

      <ComparisonShareBar total1={suggestion.total1} total2={suggestion.total2} />
      <p className="text-xs text-dash-text/75">{tradeEvaluationHeadline(suggestion.total1, suggestion.total2)}</p>
      <p className="text-xs text-dash-text/65 leading-relaxed">{fairnessNarrative(suggestion.fairnessTier, delta)}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <section className="space-y-3 min-w-0" aria-label={`Team One ${team1Name}`}>
          <h4 className="text-sm font-semibold text-dash-text">Team One — {team1Name}</h4>
          <AssetList label="You give" assets={suggestion.team1Give} />
          <AssetList label="You receive" assets={suggestion.team1Receive} />
        </section>
        <section className="space-y-3 min-w-0" aria-label={`Team Two ${team2Name}`}>
          <h4 className="text-sm font-semibold text-dash-text">Team Two — {team2Name}</h4>
          <AssetList label="They give" assets={suggestion.team1Receive} />
          <AssetList label="They receive" assets={suggestion.team1Give} />
        </section>
      </div>
    </li>
  );
}

export function TradeSuggestionsModal({
  open,
  onClose,
  panelRef,
  team1Name,
  suggestions,
  prefetchLoading,
  remainingLoading,
  error,
  valueNote,
}: Props) {
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const el = scrollBodyRef.current;
    if (el) el.scrollTop = 0;
  }, [open]);

  if (!open) return null;

  const showEmpty =
    !prefetchLoading &&
    !remainingLoading &&
    !error &&
    suggestions.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/55"
      role="presentation"
      onClick={onClose}
    >
      <div className="min-h-full flex flex-col justify-center py-4 sm:py-6 lg:py-8">
        <div
          className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 min-h-0 flex flex-col"
          onClick={onClose}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="trade-suggestions-title"
            className="w-full max-h-[min(92vh,880px)] flex flex-col bg-dash-surface-elevated rounded-[var(--dash-radius-md)] border border-white/15 shadow-xl ring-1 ring-white/10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-start justify-between gap-4 px-5 pt-5 pb-4 sm:px-6 sm:pt-6 border-b border-white/10">
              <h2 id="trade-suggestions-title" className="dash-heading-section text-dash-text pr-2 min-w-0">
                Trade suggestions
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
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5 space-y-4"
            >
              {error ? (
                <p className="text-sm text-dash-warning" role="alert">
                  {error}
                </p>
              ) : null}

              {showEmpty ? (
                <p className="text-sm text-dash-text/80 leading-relaxed">
                  No complementary trades matched your roster needs right now. Try the trade calculator to explore
                  custom packages.
                </p>
              ) : (
                <ol className="space-y-5 list-none">
                  {[1, 2, 3].map((rank) => {
                    const suggestion = suggestions.find((s) => s.rank === rank);
                    if (suggestion) {
                      return (
                        <SuggestionCard key={suggestion.id} suggestion={suggestion} team1Name={team1Name} />
                      );
                    }
                    const loading =
                      rank === 1 ? prefetchLoading : remainingLoading;
                    if (loading) {
                      return <SuggestionSkeleton key={`skel-${rank}`} rank={rank} />;
                    }
                    return null;
                  })}
                </ol>
              )}

              {valueNote ? (
                <p className="text-xs text-dash-text/65 leading-relaxed border-t border-white/10 pt-4">
                  {valueNote}
                </p>
              ) : null}

              <Link
                href="/trade"
                className={`${btnPress} inline-block text-sm font-semibold text-dash-primary hover:text-dash-text motion-safe:transition-colors`}
              >
                Open trade calculator
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
