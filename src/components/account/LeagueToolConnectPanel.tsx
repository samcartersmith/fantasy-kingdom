"use client";

import type { SleeperConnectionSummary } from "@/contexts/SleeperConnectContext";

const btnPress =
  "cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface disabled:opacity-50 disabled:pointer-events-none";

const btnPrimary = `${btnPress} inline-flex items-center justify-center min-h-11 px-5 rounded-[var(--dash-radius-sm)] bg-dash-primary text-sm font-semibold text-dash-text hover:bg-dash-primary/90`;

const btnSecondary = `${btnPress} inline-flex items-center justify-center min-h-11 px-4 rounded-[var(--dash-radius-sm)] border border-white/15 bg-black/25 text-sm font-medium text-dash-text/90 hover:bg-white/10`;

type Props = {
  connectionSummary: SleeperConnectionSummary | null;
  selectedLeagueId: string;
  primaryLabel: string;
  loading: boolean;
  onAnalyze: () => void;
  onOpenConnect: () => void;
};

export function LeagueToolConnectPanel({
  connectionSummary,
  selectedLeagueId,
  primaryLabel,
  loading,
  onAnalyze,
  onOpenConnect,
}: Props) {
  const ready = Boolean(connectionSummary?.isComplete && selectedLeagueId);

  if (!ready) {
    return (
      <section className="mx-auto max-w-lg sm:max-w-xl space-y-6 py-8 sm:py-12 text-center sm:text-left">
        <header className="space-y-2">
          <h2 className="dash-heading-section text-dash-text">Connect Sleeper</h2>
          <p className="text-sm text-dash-text/75 leading-relaxed">
            Use the account menu in the header to link your Sleeper username, dynasty league, and
            team. Your choice is saved for every tool on this site.
          </p>
        </header>
        <button type="button" className={`${btnPrimary} w-full sm:w-auto`} onClick={onOpenConnect}>
          Connect Sleeper
        </button>
      </section>
    );
  }

  const summaryParts = [
    `@${connectionSummary!.username}`,
    connectionSummary!.leagueName,
    connectionSummary!.teamName,
  ].filter(Boolean);

  return (
    <section className="mx-auto max-w-lg sm:max-w-xl space-y-6 py-8 sm:py-12">
      <header className="space-y-2 text-center sm:text-left">
        <h2 className="dash-heading-section text-dash-text">Ready to analyze</h2>
        <p className="text-sm text-dash-text/75">{summaryParts.join(" · ")}</p>
      </header>
      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3">
        <button type="button" className={btnSecondary} onClick={onOpenConnect}>
          Change connection
        </button>
        <button
          type="button"
          className={`${btnPrimary} w-full sm:w-auto sm:ml-auto`}
          disabled={loading || !selectedLeagueId}
          aria-busy={loading}
          onClick={onAnalyze}
        >
          {loading ? `${primaryLabel}…` : primaryLabel}
        </button>
      </div>
    </section>
  );
}
