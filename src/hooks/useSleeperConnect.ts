"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WizardOption } from "@/components/leagues/WizardOptionList";
import type { WizardStep } from "@/components/leagues/SleeperConnectWizard";
import { parseJsonResponse } from "@/lib/fetch-json";
import {
  clearSleeperConnectStorage,
  patchSleeperConnectStorage,
  readSleeperConnectStorage,
  writeSleeperConnectStorage,
  type SleeperConnectStored,
} from "@/lib/sleeper-connect-storage";

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
  /** When false, skips auto-restore from localStorage on mount (provider handles restore once). */
  autoRestore?: boolean;
};

function leagueNameForId(leagues: SleeperLeagueOption[] | null, id: string): string | undefined {
  return leagues?.find((l) => l.league_id === id)?.name;
}

function teamNameForRosterId(teams: SleeperTeamOption[] | null, rosterId: string): string | undefined {
  return teams?.find((t) => String(t.roster_id) === rosterId)?.name;
}

export function useSleeperConnect(options: UseSleeperConnectOptions = {}) {
  const { mode = "full", onLeagueOnlySelect, autoRestore = true } = options;
  const maxStep: WizardStep = mode === "league-only" ? 2 : 3;

  const [username, setUsername] = useState("");
  const [leagues, setLeagues] = useState<SleeperLeagueOption[] | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [teams, setTeams] = useState<SleeperTeamOption[] | null>(null);
  const [selectedRosterId, setSelectedRosterIdState] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [restoring, setRestoring] = useState(false);

  const restoreStarted = useRef(false);

  const resetBelowUser = useCallback(() => {
    setLeagues(null);
    setSelectedLeagueId("");
    setTeams(null);
    setSelectedRosterIdState("");
  }, []);

  const resetWizardUi = useCallback(() => {
    setWizardStep(1);
    setLeagues(null);
    setSelectedLeagueId("");
    setTeams(null);
    setSelectedRosterIdState("");
    setError(null);
  }, []);

  const saveConnectionSnapshot = useCallback(() => {
    const stored = readSleeperConnectStorage();
    if (!stored) return;
    const snapshot: SleeperConnectStored = {
      username: stored.username,
      userId: stored.userId,
    };
    if (selectedLeagueId) {
      snapshot.selectedLeagueId = selectedLeagueId;
      snapshot.selectedLeagueName =
        leagueNameForId(leagues, selectedLeagueId) ?? stored.selectedLeagueName;
    }
    if (selectedRosterId) {
      snapshot.selectedRosterId = selectedRosterId;
      snapshot.selectedTeamName =
        teamNameForRosterId(teams, selectedRosterId) ?? stored.selectedTeamName;
    }
    writeSleeperConnectStorage(snapshot);
  }, [selectedLeagueId, selectedRosterId, leagues, teams]);

  const fetchLeaguesForUserId = useCallback(async (userId: string) => {
    const lgRes = await fetch(`/api/sleeper/leagues?user_id=${encodeURIComponent(userId)}`);
    const lgBody = await parseJsonResponse<{ leagues: SleeperLeagueOption[] }>(lgRes);
    setLeagues(lgBody.leagues);
    if (lgBody.leagues.length === 0) {
      setError("No dynasty leagues found for this user in the current or previous NFL season.");
      setWizardStep(1);
    } else {
      setWizardStep(2);
    }
    return lgBody.leagues;
  }, []);

  const loadTeamsForLeague = useCallback(
    async (
      id: string,
      advanceWizard: boolean,
      preferredRosterId?: string,
      leagueList?: SleeperLeagueOption[] | null,
    ) => {
      setLoading(true);
      setError(null);
      setTeams(null);
      setSelectedRosterIdState("");
      const leagueName = leagueNameForId(leagueList ?? leagues, id);
      try {
        const res = await fetch(`/api/sleeper/league-teams?league_id=${encodeURIComponent(id)}`);
        const body = await parseJsonResponse<{ teams: SleeperTeamOption[] }>(res);
        setTeams(body.teams);
        const rosterId =
          preferredRosterId &&
          body.teams.some((t) => String(t.roster_id) === preferredRosterId)
            ? preferredRosterId
            : body.teams.length === 1
              ? String(body.teams[0].roster_id)
              : "";
        if (rosterId) setSelectedRosterIdState(rosterId);
        if (advanceWizard && body.teams.length > 0 && maxStep === 3) {
          setWizardStep(3);
        }
        patchSleeperConnectStorage({
          selectedLeagueId: id,
          selectedLeagueName: leagueName,
          selectedRosterId: rosterId || undefined,
          selectedTeamName: rosterId ? teamNameForRosterId(body.teams, rosterId) : undefined,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load league teams");
      } finally {
        setLoading(false);
      }
    },
    [maxStep, leagues],
  );

  const applyStoredLeagueSelection = useCallback(
    async (
      storedLeagueId: string,
      storedRosterId?: string,
      list?: SleeperLeagueOption[],
    ) => {
      const leagueList = list ?? leagues;
      setSelectedLeagueId(storedLeagueId);
      const leagueName = leagueNameForId(leagueList, storedLeagueId);
      patchSleeperConnectStorage({
        selectedLeagueId: storedLeagueId,
        selectedLeagueName: leagueName,
      });
      if (mode === "league-only") {
        onLeagueOnlySelect?.(storedLeagueId);
        return;
      }
      await loadTeamsForLeague(storedLeagueId, true, storedRosterId, leagueList);
    },
    [mode, loadTeamsForLeague, onLeagueOnlySelect, leagues],
  );

  const restoreFromStorage = useCallback(async () => {
    const stored = readSleeperConnectStorage();
    if (!stored) return;

    setUsername(stored.username);
    setRestoring(true);
    setLoading(true);
    setError(null);

    try {
      const list = await fetchLeaguesForUserId(stored.userId);
      if (stored.selectedLeagueId && list.some((l) => l.league_id === stored.selectedLeagueId)) {
        await applyStoredLeagueSelection(stored.selectedLeagueId, stored.selectedRosterId, list);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not restore Sleeper connection");
      clearSleeperConnectStorage();
    } finally {
      setLoading(false);
      setRestoring(false);
    }
  }, [fetchLeaguesForUserId, applyStoredLeagueSelection]);

  const connectUsername = useCallback(async () => {
    const q = username.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    resetBelowUser();
    setWizardStep(1);
    try {
      const res = await fetch(`/api/sleeper/user?username=${encodeURIComponent(q)}`);
      const body = await parseJsonResponse<{ user: { user_id: string; username?: string } }>(res);
      const userId = body.user.user_id;
      writeSleeperConnectStorage({
        username: body.user.username?.trim() || q,
        userId,
      });
      const list = await fetchLeaguesForUserId(userId);
      const stored = readSleeperConnectStorage();
      if (stored?.selectedLeagueId && list.some((l) => l.league_id === stored.selectedLeagueId)) {
        await applyStoredLeagueSelection(stored.selectedLeagueId, stored.selectedRosterId, list);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect Sleeper account");
    } finally {
      setLoading(false);
    }
  }, [username, resetBelowUser, fetchLeaguesForUserId, applyStoredLeagueSelection]);

  const onLeagueChange = useCallback(
    (id: string) => {
      setSelectedLeagueId(id);
      patchSleeperConnectStorage({
        selectedLeagueId: id || undefined,
        selectedLeagueName: id ? leagueNameForId(leagues, id) : undefined,
        selectedRosterId: undefined,
        selectedTeamName: undefined,
      });
      if (mode === "league-only") {
        onLeagueOnlySelect?.(id);
        return;
      }
      if (id) void loadTeamsForLeague(id, true);
      else {
        setTeams(null);
        setSelectedRosterIdState("");
      }
    },
    [mode, loadTeamsForLeague, onLeagueOnlySelect, leagues],
  );

  const setSelectedRosterId = useCallback(
    (id: string) => {
      setSelectedRosterIdState(id);
      if (id) {
        patchSleeperConnectStorage({
          selectedRosterId: id,
          selectedTeamName: teamNameForRosterId(teams, id),
        });
      }
    },
    [teams],
  );

  const wizardBack = useCallback(() => {
    setError(null);
    if (wizardStep === 3) {
      setWizardStep(2);
      setTeams(null);
      setSelectedRosterIdState("");
      patchSleeperConnectStorage({
        selectedRosterId: undefined,
        selectedTeamName: undefined,
      });
      return;
    }
    if (wizardStep === 2) {
      setWizardStep(1);
      setLeagues(null);
      setSelectedLeagueId("");
      setTeams(null);
      setSelectedRosterIdState("");
      patchSleeperConnectStorage({
        selectedLeagueId: undefined,
        selectedLeagueName: undefined,
        selectedRosterId: undefined,
        selectedTeamName: undefined,
      });
    }
  }, [wizardStep]);

  const disconnectConnection = useCallback(() => {
    resetWizardUi();
    setUsername("");
    clearSleeperConnectStorage();
  }, [resetWizardUi]);

  /** Clears storage and wizard state (legacy name for page "change connection"). */
  const openConnection = disconnectConnection;

  const beginConnectWizard = useCallback(
    ({ reset }: { reset: boolean }) => {
      setError(null);
      if (reset) {
        disconnectConnection();
        return;
      }
      const stored = readSleeperConnectStorage();
      if (!stored) {
        resetWizardUi();
        return;
      }
      setUsername(stored.username);
      void restoreFromStorage();
    },
    [disconnectConnection, resetWizardUi, restoreFromStorage],
  );

  useEffect(() => {
    if (!autoRestore) return;
    if (restoreStarted.current) return;
    restoreStarted.current = true;
    void restoreFromStorage();
  }, [autoRestore, restoreFromStorage]);

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

  const leaguesLoading =
    (wizardStep === 2 && loading && leagues === null) || (restoring && leagues === null);
  const teamsLoading =
    mode === "full" &&
    ((wizardStep === 2 && loading && !!selectedLeagueId && teams === null) ||
      (wizardStep === 3 && loading && teams === null) ||
      (restoring && !!selectedLeagueId && teams === null));

  const canProceedFromLeague = mode === "league-only" ? Boolean(selectedLeagueId) : false;
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
    disconnectConnection,
    beginConnectWizard,
    resetBelowUser,
    restoreFromStorage,
    saveConnectionSnapshot,
    leagueWizardOptions,
    teamWizardOptions,
    leaguesLoading,
    teamsLoading,
    canProceedFromLeague,
    canAnalyze,
    restoring,
  };
}
