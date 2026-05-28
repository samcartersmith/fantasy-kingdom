"use client";

import { useCallback, useEffect, useState } from "react";
import { LeagueToolConnectPanel } from "@/components/account/LeagueToolConnectPanel";
import { LeagueIdHint } from "@/components/season-predictions/LeagueIdHint";
import { SeasonPredictionsTable } from "@/components/season-predictions/SeasonPredictionsTable";
import { useSleeperConnectContext } from "@/contexts/SleeperConnectContext";
import { parseJsonResponse } from "@/lib/fetch-json";
import type { SeasonPredictionsPayload } from "@/lib/season-predictions/types";

type SeasonPredictionsHubProps = {
  onShowPageIntroChange?: (show: boolean) => void;
};

export function SeasonPredictionsHub({ onShowPageIntroChange }: SeasonPredictionsHubProps) {
  const [payload, setPayload] = useState<SeasonPredictionsPayload | null>(null);
  const [analysisLeagueId, setAnalysisLeagueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accurateLineups, setAccurateLineups] = useState(false);

  const {
    connectionSummary,
    selectedLeagueId,
    error,
    setError,
    openConnectModal,
  } = useSleeperConnectContext();

  useEffect(() => {
    onShowPageIntroChange?.(!payload && !loading);
  }, [payload, loading, onShowPageIntroChange]);

  const loadPredictions = useCallback(
    async (leagueId: string, useAccurateLineups: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ league_id: leagueId });
        if (useAccurateLineups) params.set("lineup_mode", "optimal");
        const res = await fetch(`/api/sleeper/season-predictions?${params.toString()}`);
        const body = await parseJsonResponse<SeasonPredictionsPayload & { error?: string }>(res);
        if (!res.ok) {
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        setPayload(body);
        setAnalysisLeagueId(leagueId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load season predictions");
      } finally {
        setLoading(false);
      }
    },
    [setError],
  );

  const handleRun = useCallback(() => {
    if (!selectedLeagueId) return;
    void loadPredictions(selectedLeagueId, accurateLineups);
  }, [selectedLeagueId, loadPredictions, accurateLineups]);

  const handleRefresh = useCallback(() => {
    const leagueId = analysisLeagueId ?? selectedLeagueId;
    if (!leagueId) return;
    void loadPredictions(leagueId, accurateLineups);
  }, [analysisLeagueId, selectedLeagueId, loadPredictions, accurateLineups]);

  const handleChangeConnection = useCallback(() => {
    setPayload(null);
    setAnalysisLeagueId(null);
    openConnectModal();
  }, [openConnectModal]);

  const showConnectPanel = !payload && !loading;
  const displayLeagueId = analysisLeagueId ?? selectedLeagueId;
  const showLeagueId = Boolean(connectionSummary?.isComplete && displayLeagueId);

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

      {showLeagueId ? (
        <LeagueIdHint leagueId={displayLeagueId} className="mx-auto max-w-lg sm:max-w-xl" />
      ) : null}

      {showConnectPanel ? (
        <div className="mx-auto max-w-lg sm:max-w-xl space-y-4">
          <label className="flex items-start gap-3 cursor-pointer text-sm text-dash-text/80">
            <input
              type="checkbox"
              checked={accurateLineups}
              onChange={(e) => setAccurateLineups(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/25 bg-black/30 text-dash-primary focus-visible:ring-2 focus-visible:ring-dash-primary"
            />
            <span>
              <span className="font-medium text-dash-text">Optimal lineups</span>
              <span className="block text-dash-text/65 mt-0.5">
                Picks the best legal weekly lineup from starters and bench (taxi/IR excluded).
                Default mode keeps your listed starters and only fixes empty or weak slots.
              </span>
            </span>
          </label>
          <LeagueToolConnectPanel
            connectionSummary={connectionSummary}
            selectedLeagueId={selectedLeagueId}
            primaryLabel="Run season predictions"
            loading={loading}
            onAnalyze={handleRun}
            onOpenConnect={openConnectModal}
          />
        </div>
      ) : null}

      {loading && !payload ? (
        <section
          className="mx-auto max-w-lg sm:max-w-xl space-y-4 py-12"
          aria-busy="true"
          aria-label="Running season predictions"
        >
          <p className="text-sm text-dash-text/75 text-center" aria-live="polite">
            {accurateLineups
              ? "Loading schedule and optimizing weekly projections…"
              : "Loading schedule and weekly projections…"}
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

      {payload ? (
        <SeasonPredictionsTable
          data={payload}
          onChangeConnection={handleChangeConnection}
          onRefresh={handleRefresh}
          isRefreshing={loading}
        />
      ) : null}
    </div>
  );
}
