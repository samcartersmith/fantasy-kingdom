"use client";

import { useCallback, useEffect, useState } from "react";
import { LeagueToolConnectPanel } from "@/components/account/LeagueToolConnectPanel";
import { DraftExpertsExplorer } from "@/components/draft-experts/DraftExpertsExplorer";
import { useSleeperConnectContext } from "@/contexts/SleeperConnectContext";
import type { DraftExpertsPayload } from "@/lib/draft-experts-build";
import { parseJsonResponse } from "@/lib/fetch-json";

type DraftExpertsHubProps = {
  onShowPageIntroChange?: (show: boolean) => void;
};

export function DraftExpertsHub({ onShowPageIntroChange }: DraftExpertsHubProps) {
  const [payload, setPayload] = useState<DraftExpertsPayload | null>(null);
  const [analysisLeagueId, setAnalysisLeagueId] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const {
    connectionSummary,
    selectedLeagueId,
    error,
    setError,
    openConnectModal,
  } = useSleeperConnectContext();

  useEffect(() => {
    onShowPageIntroChange?.(!payload);
  }, [payload, onShowPageIntroChange]);

  const loadDraftAnalysis = useCallback(
    async (leagueId: string) => {
      setAnalysisLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sleeper/draft-experts?league_id=${encodeURIComponent(leagueId)}`);
        const body = await parseJsonResponse<DraftExpertsPayload>(res);
        setPayload(body);
        setAnalysisLeagueId(leagueId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not analyze drafts");
        setPayload(null);
      } finally {
        setAnalysisLoading(false);
      }
    },
    [setError],
  );

  const handleAnalyze = useCallback(() => {
    if (!selectedLeagueId) return;
    void loadDraftAnalysis(selectedLeagueId);
  }, [selectedLeagueId, loadDraftAnalysis]);

  const handleRefreshAnalysis = useCallback(() => {
    const leagueId = analysisLeagueId ?? selectedLeagueId;
    if (!leagueId) return;
    void loadDraftAnalysis(leagueId);
  }, [analysisLeagueId, selectedLeagueId, loadDraftAnalysis]);

  const handleChangeConnection = useCallback(() => {
    setPayload(null);
    setAnalysisLeagueId(null);
    openConnectModal();
  }, [openConnectModal]);

  const showConnectPanel = !payload && !analysisLoading;

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

      {analysisLoading ? (
        <section
          className="mx-auto max-w-lg sm:max-w-xl space-y-4 py-12"
          aria-busy="true"
          aria-label="Analyzing drafts"
        >
          <p className="text-sm text-dash-text/75 text-center" aria-live="polite">
            Loading drafts and grading picks across seasons…
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
          primaryLabel="Analyze drafts"
          loading={analysisLoading}
          onAnalyze={handleAnalyze}
          onOpenConnect={openConnectModal}
        />
      ) : null}

      {payload ? (
        <DraftExpertsExplorer
          data={payload}
          onChangeConnection={handleChangeConnection}
          onRefreshAnalysis={handleRefreshAnalysis}
          isRefreshing={analysisLoading}
        />
      ) : null}
    </div>
  );
}
