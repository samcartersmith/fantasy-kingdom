"use client";

import { useCallback, useEffect, useState } from "react";
import { SleeperConnectWizard } from "@/components/leagues/SleeperConnectWizard";
import { SleeperUsernameHelpModal } from "@/components/leagues/SleeperUsernameHelpModal";
import { DraftExpertsExplorer } from "@/components/draft-experts/DraftExpertsExplorer";
import { useSleeperConnect } from "@/hooks/useSleeperConnect";
import type { DraftExpertsPayload } from "@/lib/draft-experts-build";
import { parseJsonResponse } from "@/lib/fetch-json";

type DraftExpertsHubProps = {
  onShowPageIntroChange?: (show: boolean) => void;
};

export function DraftExpertsHub({ onShowPageIntroChange }: DraftExpertsHubProps) {
  const [payload, setPayload] = useState<DraftExpertsPayload | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
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

  const handleChangeConnection = useCallback(() => {
    setPayload(null);
    openConnection();
  }, [openConnection]);

  const showWizard = !payload && !analysisLoading;

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

      {showWizard ? (
        <SleeperConnectWizard
          mode="league-only"
          leagueOnlyPrimaryLabel="Analyze drafts"
          step={wizardStep}
          username={username}
          onUsernameChange={setUsername}
          leagueOptions={leagueWizardOptions}
          teamOptions={[]}
          selectedLeagueId={selectedLeagueId}
          selectedRosterId=""
          leaguesLoading={leaguesLoading}
          teamsLoading={false}
          loading={loading || analysisLoading}
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

      {payload ? (
        <DraftExpertsExplorer data={payload} onChangeConnection={handleChangeConnection} />
      ) : null}

      <SleeperUsernameHelpModal open={usernameHelpOpen} onClose={() => setUsernameHelpOpen(false)} />
    </div>
  );
}
