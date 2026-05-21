"use client";

import { useCallback, useEffect, useState } from "react";
import { SleeperConnectWizard } from "@/components/leagues/SleeperConnectWizard";
import { SleeperUsernameHelpModal } from "@/components/leagues/SleeperUsernameHelpModal";
import { LeagueHistoryExplorer } from "@/components/league-data-wizard/LeagueHistoryExplorer";
import { useSleeperConnect } from "@/hooks/useSleeperConnect";
import type { LeagueHistoryPayload } from "@/lib/league-history-build";
import { parseJsonResponse } from "@/lib/fetch-json";

type LeagueDataWizardHubProps = {
  onShowPageIntroChange?: (show: boolean) => void;
};

export function LeagueDataWizardHub({ onShowPageIntroChange }: LeagueDataWizardHubProps) {
  const [history, setHistory] = useState<LeagueHistoryPayload | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [usernameHelpOpen, setUsernameHelpOpen] = useState(false);

  const sleeper = useSleeperConnect({ mode: "league-only" });
  const {
    username,
    setUsername,
    leagues,
    selectedLeagueId,
    error,
    setError,
    loading,
    wizardStep,
    connectUsername,
    onLeagueChange,
    wizardBack,
    openConnection,
    leagueWizardOptions,
    leaguesLoading,
    canProceedFromLeague,
  } = sleeper;

  useEffect(() => {
    onShowPageIntroChange?.(!history);
  }, [history, onShowPageIntroChange]);

  const loadHistory = useCallback(async (leagueId: string) => {
    setHistoryLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sleeper/league-history?league_id=${encodeURIComponent(leagueId)}`);
      const body = await parseJsonResponse<LeagueHistoryPayload>(res);
      setHistory(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load league history");
      setHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  }, [setError]);

  const handleAnalyze = useCallback(() => {
    if (!selectedLeagueId) return;
    void loadHistory(selectedLeagueId);
  }, [selectedLeagueId, loadHistory]);

  const handleChangeConnection = useCallback(() => {
    setHistory(null);
    openConnection();
  }, [openConnection]);

  const showWizard = !history && !historyLoading;

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

      {showWizard ? (
        <SleeperConnectWizard
          mode="league-only"
          step={wizardStep}
          username={username}
          onUsernameChange={setUsername}
          leagueOptions={leagueWizardOptions}
          teamOptions={[]}
          selectedLeagueId={selectedLeagueId}
          selectedRosterId=""
          leaguesLoading={leaguesLoading}
          teamsLoading={false}
          loading={loading || historyLoading}
          canAnalyze={false}
          canProceedFromLeague={canProceedFromLeague}
          leagueEmptyMessage={
            leagues && leagues.length === 0
              ? "No dynasty leagues found for this account in the current or previous season."
              : undefined
          }
          onConnect={() => void connectUsername()}
          onLeagueSelect={onLeagueChange}
          onTeamSelect={() => {}}
          onAnalyze={handleAnalyze}
          onBack={wizardBack}
          onOpenUsernameHelp={() => setUsernameHelpOpen(true)}
        />
      ) : null}

      {history ? (
        <LeagueHistoryExplorer data={history} onChangeConnection={handleChangeConnection} />
      ) : null}

      <SleeperUsernameHelpModal
        open={usernameHelpOpen}
        onClose={() => setUsernameHelpOpen(false)}
      />
    </div>
  );
}
