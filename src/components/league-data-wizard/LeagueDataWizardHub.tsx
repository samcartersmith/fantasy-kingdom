"use client";

import { useCallback, useEffect, useState } from "react";
import { LeagueToolConnectPanel } from "@/components/account/LeagueToolConnectPanel";
import { LeagueHistoryExplorer } from "@/components/league-data-wizard/LeagueHistoryExplorer";
import { useSleeperConnectContext } from "@/contexts/SleeperConnectContext";
import type { LeagueHistoryPayload } from "@/lib/league-history-build";
import { parseJsonResponse } from "@/lib/fetch-json";

type LeagueDataWizardHubProps = {
  onShowPageIntroChange?: (show: boolean) => void;
};

export function LeagueDataWizardHub({ onShowPageIntroChange }: LeagueDataWizardHubProps) {
  const [history, setHistory] = useState<LeagueHistoryPayload | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const {
    connectionSummary,
    selectedLeagueId,
    error,
    setError,
    openConnectModal,
  } = useSleeperConnectContext();

  useEffect(() => {
    onShowPageIntroChange?.(!history);
  }, [history, onShowPageIntroChange]);

  const loadHistory = useCallback(
    async (leagueId: string) => {
      setHistoryLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/sleeper/league-history?league_id=${encodeURIComponent(leagueId)}`,
        );
        const body = await parseJsonResponse<LeagueHistoryPayload>(res);
        setHistory(body);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load league history");
        setHistory(null);
      } finally {
        setHistoryLoading(false);
      }
    },
    [setError],
  );

  const handleAnalyze = useCallback(() => {
    if (!selectedLeagueId) return;
    void loadHistory(selectedLeagueId);
  }, [selectedLeagueId, loadHistory]);

  const handleChangeConnection = useCallback(() => {
    setHistory(null);
    openConnectModal();
  }, [openConnectModal]);

  const showConnectPanel = !history && !historyLoading;

  return (
    <div className="w-full min-w-0 space-y-6 lg:space-y-8">
      {error ? (
        <div
          role="alert"
          className="mx-auto max-w-lg sm:max-w-xl rounded-[var(--dash-radius-md)] border border-dash-danger/50 bg-dash-danger/15 px-4 py-3 text-sm font-medium text-dash-danger"
        >
          {error}
        </div>
      ) : null}

      {historyLoading ? (
        <section
          className="mx-auto max-w-lg sm:max-w-xl space-y-4 py-12"
          aria-busy="true"
          aria-label="Loading league history"
        >
          <p className="text-sm text-dash-text/75 text-center" aria-live="polite">
            Tracing league history across seasons…
          </p>
          <ul className="space-y-2" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <li
                key={i}
                className="h-11 rounded-[var(--dash-radius-sm)] border border-white/10 bg-white/[0.04] animate-pulse"
              />
            ))}
          </ul>
        </section>
      ) : null}

      {showConnectPanel ? (
        <LeagueToolConnectPanel
          connectionSummary={connectionSummary}
          selectedLeagueId={selectedLeagueId}
          primaryLabel="Load league history"
          loading={historyLoading}
          onAnalyze={handleAnalyze}
          onOpenConnect={openConnectModal}
        />
      ) : null}

      {history ? (
        <LeagueHistoryExplorer data={history} onChangeConnection={handleChangeConnection} />
      ) : null}
    </div>
  );
}
