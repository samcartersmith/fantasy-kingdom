"use client";

import { useCallback, useMemo, useState } from "react";
import type { WizardOption } from "@/components/leagues/WizardOptionList";
import type { WizardStep } from "@/components/leagues/SleeperConnectWizard";

export type SleeperLeagueOption = {
  league_id: string;
  name: string;
  season: string;
  status: string;
  total_rosters: number;
};

export type SleeperTeamOption = {
  roster_id: number;
  name: string;
  player_count: number;
};

export type SleeperConnectMode = "full" | "league-only";

type UseSleeperConnectOptions = {
  mode?: SleeperConnectMode;
  /** Called when a league is selected in league-only mode (no team fetch). */
  onLeagueOnlySelect?: (leagueId: string) => void;
};

export function useSleeperConnect(options: UseSleeperConnectOptions = {}) {
  const { mode = "full", onLeagueOnlySelect } = options;
  const maxStep: WizardStep = mode === "league-only" ? 2 : 3;

  const [username, setUsername] = useState("");
  const [leagues, setLeagues] = useState<SleeperLeagueOption[] | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [teams, setTeams] = useState<SleeperTeamOption[] | null>(null);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);

  const resetBelowUser = useCallback(() => {
    setLeagues(null);
    setSelectedLeagueId("");
    setTeams(null);
    setSelectedRosterId("");
  }, []);

  const connectUsername = useCallback(async () => {
    const q = username.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    resetBelowUser();
    setWizardStep(1);
    try {
      const res = await fetch(`/api/sleeper/user?username=${encodeURIComponent(q)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      const lgRes = await fetch(`/api/sleeper/leagues?user_id=${encodeURIComponent(body.user.user_id)}`);
      const lgBody = await lgRes.json();
      if (!lgRes.ok) throw new Error(lgBody.error || `HTTP ${lgRes.status}`);
      setLeagues(lgBody.leagues);
      if (lgBody.leagues.length === 0) {
        setError("No dynasty leagues found for this user in the current or previous NFL season.");
      } else {
        setWizardStep(2);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect Sleeper account");
    } finally {
      setLoading(false);
    }
  }, [username, resetBelowUser]);

  const loadTeamsForLeague = useCallback(async (id: string, advanceWizard: boolean) => {
    setLoading(true);
    setError(null);
    setTeams(null);
    setSelectedRosterId("");
    try {
      const res = await fetch(`/api/sleeper/league-teams?league_id=${encodeURIComponent(id)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setTeams(body.teams);
      if (body.teams.length === 1) {
        setSelectedRosterId(String(body.teams[0].roster_id));
      }
      if (advanceWizard && body.teams.length > 0 && maxStep === 3) {
        setWizardStep(3);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load league teams");
    } finally {
      setLoading(false);
    }
  }, [maxStep]);

  const onLeagueChange = useCallback(
    (id: string) => {
      setSelectedLeagueId(id);
      if (mode === "league-only") {
        onLeagueOnlySelect?.(id);
        return;
      }
      if (id) void loadTeamsForLeague(id, true);
    },
    [mode, loadTeamsForLeague, onLeagueOnlySelect],
  );

  const wizardBack = useCallback(() => {
    setError(null);
    if (wizardStep === 3) {
      setWizardStep(2);
      setTeams(null);
      setSelectedRosterId("");
      return;
    }
    if (wizardStep === 2) {
      setWizardStep(1);
      setLeagues(null);
      setSelectedLeagueId("");
      setTeams(null);
      setSelectedRosterId("");
    }
  }, [wizardStep]);

  const openConnection = useCallback(() => {
    setWizardStep(1);
    setLeagues(null);
    setSelectedLeagueId("");
    setTeams(null);
    setSelectedRosterId("");
    setError(null);
  }, []);

  const leagueWizardOptions: WizardOption[] = useMemo(() => {
    if (!leagues?.length) return [];
    return leagues.map((l) => ({
      value: l.league_id,
      label: l.name,
      hint: `${l.season} · ${l.total_rosters} teams`,
    }));
  }, [leagues]);

  const teamWizardOptions: WizardOption[] = useMemo(() => {
    if (!teams?.length) return [];
    return teams.map((t) => ({
      value: String(t.roster_id),
      label: t.name,
      hint: `${t.player_count} players`,
    }));
  }, [teams]);

  const leaguesLoading = wizardStep === 2 && loading && leagues === null;
  const teamsLoading =
    mode === "full" &&
    ((wizardStep === 2 && loading && !!selectedLeagueId && teams === null) ||
      (wizardStep === 3 && loading && teams === null));

  const canProceedFromLeague =
    mode === "league-only" ? Boolean(selectedLeagueId) : false;
  const canAnalyze = Boolean(selectedLeagueId && selectedRosterId && teams && teams.length > 0);

  return {
    mode,
    maxStep,
    username,
    setUsername,
    leagues,
    selectedLeagueId,
    teams,
    selectedRosterId,
    setSelectedRosterId,
    error,
    setError,
    loading,
    setLoading,
    wizardStep,
    setWizardStep,
    connectUsername,
    loadTeamsForLeague,
    onLeagueChange,
    wizardBack,
    openConnection,
    resetBelowUser,
    leagueWizardOptions,
    teamWizardOptions,
    leaguesLoading,
    teamsLoading,
    canProceedFromLeague,
    canAnalyze,
  };
}
