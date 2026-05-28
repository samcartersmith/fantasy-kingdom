"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LeagueToolConnectPanel } from "@/components/account/LeagueToolConnectPanel";
import { MatchupAdviceControlBar } from "@/components/matchup-advice/MatchupAdviceControlBar";
import { MatchupAdvicePanel } from "@/components/matchup-advice/MatchupAdvicePanel";
import { MatchupRosterGrid } from "@/components/matchup-advice/MatchupStarterRow";
import { MatchupTeamSummaryCard } from "@/components/matchup-advice/MatchupTeamSummary";
import { useSleeperConnectContext } from "@/contexts/SleeperConnectContext";
import { parseJsonResponse } from "@/lib/fetch-json";
import { matchupAdviceWeekSelectOptions } from "@/lib/matchup-advice/projection-prefetch-weeks";
import type { MatchupAdvicePayload } from "@/lib/matchup-advice/types";

type MatchupAdviceHubProps = {
  onShowPageIntroChange?: (show: boolean) => void;
};

function adviceFetchKey(leagueId: string, rosterId: string, week: string): string {
  return `${leagueId}:${rosterId}:${week || "default"}`;
}

function loadingStatusMessage(displayWeek: string, hasPriorPayload: boolean): string {
  const weekLabel = displayWeek || "current";
  if (hasPriorPayload) {
    return `Downloading week ${weekLabel} projections from Sleeper and rebuilding lineup advice…`;
  }
  return `Downloading week ${weekLabel} projections from Sleeper (about 5–7 MB). Building your matchup…`;
}

type WeekScope = {
  currentWeek: number;
  regularSeasonWeeks: number;
};

export function MatchupAdviceHub({ onShowPageIntroChange }: MatchupAdviceHubProps) {
  const [payload, setPayload] = useState<MatchupAdvicePayload | null>(null);
  const [weekScope, setWeekScope] = useState<WeekScope | null>(null);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [loading, setLoading] = useState(false);
  const lastFetchedKey = useRef("");
  const weekCacheRef = useRef(new Map<string, MatchupAdvicePayload>());
  const abortRef = useRef<AbortController | null>(null);

  const {
    connectionSummary,
    selectedLeagueId,
    selectedRosterId,
    setSelectedRosterId,
    error,
    setError,
    openConnectModal,
    onLeagueChange,
    leagueWizardOptions,
    teamWizardOptions,
    loading: connectLoading,
    restoring,
    leaguesLoading,
    teamsLoading,
  } = useSleeperConnectContext();

  const ready = Boolean(connectionSummary?.isComplete && selectedLeagueId && selectedRosterId);

  const clearAdviceState = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    weekCacheRef.current.clear();
    lastFetchedKey.current = "";
    setPayload(null);
    setWeekScope(null);
    setSelectedWeek("");
    setLoading(false);
  }, []);

  useEffect(() => {
    onShowPageIntroChange?.(!payload && !loading && ready);
  }, [payload, loading, ready, onShowPageIntroChange]);

  const loadAdvice = useCallback(
    async (leagueId: string, rosterId: string, week: string) => {
      if (week) {
        const cachedKey = adviceFetchKey(leagueId, rosterId, week);
        const cached = weekCacheRef.current.get(cachedKey);
        if (cached) {
          lastFetchedKey.current = cachedKey;
          setPayload(cached);
          setWeekScope({
            currentWeek: cached.currentWeek,
            regularSeasonWeeks: cached.regularSeasonWeeks,
          });
          setSelectedWeek(week);
          return;
        }
      }

      const fetchKey = adviceFetchKey(leagueId, rosterId, week);
      if (fetchKey === lastFetchedKey.current) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          league_id: leagueId,
          roster_id: rosterId,
        });
        if (week) params.set("week", week);
        const res = await fetch(`/api/sleeper/matchup-advice?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await parseJsonResponse<MatchupAdvicePayload & { error?: string }>(res);
        if (!res.ok) {
          throw new Error(body.error || `HTTP ${res.status}`);
        }

        const resolvedWeek = String(body.week);
        const resolvedKey = adviceFetchKey(leagueId, rosterId, resolvedWeek);
        weekCacheRef.current.set(resolvedKey, body);
        lastFetchedKey.current = resolvedKey;

        setPayload(body);
        setWeekScope({
          currentWeek: body.currentWeek,
          regularSeasonWeeks: body.regularSeasonWeeks,
        });
        setSelectedWeek(resolvedWeek);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        lastFetchedKey.current = "";
        setPayload(null);
        setError(e instanceof Error ? e.message : "Could not load matchup advice");
      } finally {
        if (abortRef.current === controller) {
          setLoading(false);
        }
      }
    },
    [setError],
  );

  useEffect(() => {
    if (!ready) return;
    void loadAdvice(selectedLeagueId, selectedRosterId, selectedWeek);
  }, [ready, selectedLeagueId, selectedRosterId, selectedWeek, loadAdvice]);

  const weekOptions = useMemo(() => {
    if (!weekScope) return [];
    return matchupAdviceWeekSelectOptions(
      { week: weekScope.currentWeek, season: "", season_type: "" },
      weekScope.regularSeasonWeeks,
    );
  }, [weekScope]);

  const connectListsLoading = restoring || leaguesLoading || teamsLoading;

  const leagueOptions = useMemo(
    () =>
      leagueWizardOptions.map((o) => ({
        value: o.value,
        label: o.label,
      })),
    [leagueWizardOptions],
  );

  const teamOptions = useMemo(
    () =>
      teamWizardOptions.map((o) => ({
        value: o.value,
        label: o.label,
      })),
    [teamWizardOptions],
  );

  const handleLeagueChange = useCallback(
    (leagueId: string) => {
      clearAdviceState();
      onLeagueChange(leagueId);
    },
    [clearAdviceState, onLeagueChange],
  );

  const handleTeamChange = useCallback(
    (rosterId: string) => {
      lastFetchedKey.current = "";
      setWeekScope(null);
      setPayload(null);
      setSelectedRosterId(rosterId);
    },
    [setSelectedRosterId],
  );

  const handleWeekChange = useCallback((week: string) => {
    lastFetchedKey.current = "";
    setSelectedWeek(week);
  }, []);

  const displayWeek = selectedWeek || (payload ? String(payload.week) : "");
  const weekLoading = loading;
  const loadingMessage = loadingStatusMessage(displayWeek, payload != null);
  const showWeekSwitchOverlay =
    loading && payload != null && displayWeek !== "" && String(payload.week) !== displayWeek;

  if (!ready) {
    return (
      <LeagueToolConnectPanel
        connectionSummary={connectionSummary}
        selectedLeagueId={selectedLeagueId}
        primaryLabel="Load matchup"
        loading={connectLoading}
        onAnalyze={() => openConnectModal()}
        onOpenConnect={openConnectModal}
      />
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6 lg:space-y-8">
      {error ? (
        <div
          role="alert"
          className="rounded-[var(--dash-radius-md)] border border-dash-danger/50 bg-dash-danger/15 px-4 py-3 text-sm font-medium text-dash-danger"
        >
          {error}
        </div>
      ) : null}

      <MatchupAdviceControlBar
        leagueOptions={leagueOptions}
        teamOptions={teamOptions}
        weekOptions={weekOptions}
        selectedLeagueId={selectedLeagueId}
        selectedRosterId={selectedRosterId}
        selectedWeek={displayWeek}
        leaguesDisabled={connectListsLoading || leagueOptions.length === 0}
        teamsDisabled={connectListsLoading || teamOptions.length === 0}
        weeksDisabled={weekOptions.length === 0}
        weeksLoading={weekLoading}
        onLeagueChange={handleLeagueChange}
        onTeamChange={handleTeamChange}
        onWeekChange={handleWeekChange}
      />

      {payload?.meta.weekScopeNote ? (
        <p className="text-xs text-dash-text/60 text-center">{payload.meta.weekScopeNote}</p>
      ) : weekOptions.length === 0 && loading ? (
        <p className="text-xs text-dash-text/60 text-center">
          Week choices appear after the first projection download finishes.
        </p>
      ) : null}

      {weekLoading ? (
        <p className="text-sm text-dash-text/70 text-center" aria-live="polite" aria-busy="true">
          {loadingMessage}
        </p>
      ) : null}

      {loading && !payload ? (
        <div className="space-y-4" aria-live="polite" aria-busy="true">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="h-36 rounded-[var(--dash-radius-md)] bg-white/5 animate-pulse" />
            <div className="hidden sm:block size-10 rounded-full bg-white/5 animate-pulse mx-auto" />
            <div className="h-36 rounded-[var(--dash-radius-md)] bg-white/5 animate-pulse" />
          </div>
          <div className="h-64 rounded-[var(--dash-radius-md)] bg-white/5 animate-pulse" />
        </div>
      ) : null}

      {payload ? (
        <div className="relative">
          {showWeekSwitchOverlay ? (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[var(--dash-radius-md)] bg-black/40 backdrop-blur-[1px] px-4"
              aria-live="polite"
              aria-busy="true"
            >
              <p className="text-sm font-medium text-dash-text/90 text-center">{loadingMessage}</p>
              <div className="w-full max-w-3xl space-y-4">
                <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <div className="h-36 rounded-[var(--dash-radius-md)] bg-white/10 animate-pulse" />
                  <div className="hidden sm:block size-10 rounded-full bg-white/10 animate-pulse mx-auto" />
                  <div className="h-36 rounded-[var(--dash-radius-md)] bg-white/10 animate-pulse" />
                </div>
                <div className="h-64 rounded-[var(--dash-radius-md)] bg-white/10 animate-pulse" />
              </div>
            </div>
          ) : null}

          <div className={showWeekSwitchOverlay ? "opacity-50 motion-safe:transition-opacity" : ""}>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start">
              <MatchupTeamSummaryCard team={payload.yourTeam} side="left" />
              <div className="flex items-center justify-center py-1 sm:pt-10">
                <span className="inline-flex size-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-xs font-bold uppercase tracking-wide text-dash-text/80">
                  VS
                </span>
              </div>
              {payload.opponent ? (
                <MatchupTeamSummaryCard team={payload.opponent} side="right" />
              ) : (
                <div className="flex min-h-[9rem] items-center justify-center rounded-[var(--dash-radius-md)] border border-dashed border-white/15 bg-black/15 px-4 text-sm text-dash-text/65 text-center">
                  {payload.meta.opponentNote ?? "No opponent this week"}
                </div>
              )}
            </div>

            <div className="mt-6">
              <MatchupRosterGrid rows={payload.pairedRows} />
            </div>

            <div className="mt-6">
              <MatchupAdvicePanel
                advice={payload.advice}
                metaNote={payload.meta.valueNote}
                opponentNote={payload.meta.opponentNote}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
