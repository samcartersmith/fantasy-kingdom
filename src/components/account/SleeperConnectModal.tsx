"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { AccountModalShell } from "@/components/account/AccountModalShell";
import { SleeperConnectWizard } from "@/components/leagues/SleeperConnectWizard";
import { SleeperUsernameHelpModal } from "@/components/leagues/SleeperUsernameHelpModal";
import { useSleeperConnectContext } from "@/contexts/SleeperConnectContext";

export function SleeperConnectModal() {
  const titleId = useId();
  const [usernameHelpOpen, setUsernameHelpOpen] = useState(false);
  const {
    connectModalOpen,
    closeConnectModal,
    error,
    wizardStep,
    username,
    setUsername,
    leagueWizardOptions,
    teamWizardOptions,
    selectedLeagueId,
    selectedRosterId,
    setSelectedRosterId,
    leaguesLoading,
    teamsLoading,
    loading,
    canAnalyze,
    connectUsername,
    onLeagueChange,
    wizardBack,
    saveConnectionSnapshot,
    leagues,
    teams,
  } = useSleeperConnectContext();

  const handleSaveConnection = useCallback(() => {
    saveConnectionSnapshot();
    closeConnectModal();
  }, [saveConnectionSnapshot, closeConnectModal]);

  useEffect(() => {
    if (!connectModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !usernameHelpOpen) closeConnectModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connectModalOpen, usernameHelpOpen, closeConnectModal]);

  return (
    <>
      <AccountModalShell
        open={connectModalOpen}
        onClose={closeConnectModal}
        title="Connect Sleeper"
        titleId={titleId}
        description="Link your account so league and team settings follow you across tools."
        size="lg"
      >
        {error ? (
          <div
            role="alert"
            className="mb-4 rounded-[var(--dash-radius-md)] border border-dash-danger/50 bg-dash-danger/15 px-4 py-3 text-sm font-medium text-dash-danger"
          >
            {error}
          </div>
        ) : null}
        <SleeperConnectWizard
          mode="full"
          layout="modal"
          teamStepPrimaryLabel="Save connection"
          step={wizardStep}
          username={username}
          onUsernameChange={setUsername}
          leagueOptions={leagueWizardOptions}
          teamOptions={teamWizardOptions}
          selectedLeagueId={selectedLeagueId}
          selectedRosterId={selectedRosterId}
          leaguesLoading={leaguesLoading}
          teamsLoading={teamsLoading}
          loading={loading}
          canAnalyze={canAnalyze}
          leagueEmptyMessage={
            leagues && leagues.length === 0
              ? "No dynasty leagues found for this account in the current or previous season."
              : undefined
          }
          teamEmptyMessage={teams && teams.length === 0 ? "No teams found for this league." : undefined}
          onConnect={() => void connectUsername()}
          onLeagueSelect={onLeagueChange}
          onTeamSelect={setSelectedRosterId}
          onAnalyze={handleSaveConnection}
          onBack={wizardBack}
          onOpenUsernameHelp={() => setUsernameHelpOpen(true)}
        />
      </AccountModalShell>
      <SleeperUsernameHelpModal
        open={usernameHelpOpen}
        onClose={() => setUsernameHelpOpen(false)}
      />
    </>
  );
}
