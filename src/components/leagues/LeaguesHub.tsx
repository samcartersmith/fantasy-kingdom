"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ConnectBarSelect } from "@/components/leagues/ConnectBarSelect";
import { SleeperConnectWizard, type WizardStep } from "@/components/leagues/SleeperConnectWizard";
import { SleeperUsernameHelpModal } from "@/components/leagues/SleeperUsernameHelpModal";
import { TradeSuggestionsModal } from "@/components/trade/TradeSuggestionsModal";
import type { WizardOption } from "@/components/leagues/WizardOptionList";
import type { GuidanceInsight, RosterPlayerRow, RosterSlot } from "@/lib/roster-guidance";
import type { TradeSuggestion } from "@/lib/trade-suggestions";

type LeagueOption = { league_id: string; name: string; season: string; status: string; total_rosters: number };
type TeamOption = { roster_id: number; name: string; player_count: number };

type GuidanceResponse = {
  league: { name: string; season: string; status: string };
  team: { name: string; roster_id: number };
  leagueContextLabel: string;
  guidance: {
    totalValue: number;
    valueRank: number;
    leagueRosterCount: number;
    players: RosterPlayerRow[];
    insights: GuidanceInsight[];
  };
  meta: { valueNote: string; playersUnmatched: number };
  error?: string;
};

const SLOT_ORDER: RosterSlot[] = ["starter", "bench", "taxi", "reserve"];

const SLOT_LABELS: Record<RosterSlot, string> = {
  starter: "Starters",
  bench: "Bench",
  taxi: "Taxi",
  reserve: "Reserve",
};

const toneDot: Record<GuidanceInsight["tone"], string> = {
  neutral: "bg-dash-text/50",
  positive: "bg-dash-primary",
  caution: "bg-dash-warning",
  opportunity: "bg-dash-primary/75",
};

const btnPress =
  "cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed";

const btnPrimary = `${btnPress} inline-flex items-center justify-center min-h-11 px-5 rounded-[var(--dash-radius-sm)] bg-dash-primary text-sm font-semibold text-dash-text hover:bg-dash-primary/90`;

const btnSecondary = `${btnPress} inline-flex items-center justify-center min-h-11 px-4 rounded-[var(--dash-radius-sm)] border border-white/15 bg-black/25 text-sm font-medium text-dash-text/90 hover:bg-white/10 hover:border-white/25 hover:text-dash-text`;

const linkAction =
  "cursor-pointer text-sm font-semibold text-dash-primary hover:text-dash-text motion-safe:transition-colors motion-safe:duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface rounded-[var(--dash-radius-sm)]";

function groupPlayersBySlot(players: RosterPlayerRow[]) {
  const bySlot = new Map<RosterSlot, RosterPlayerRow[]>();
  for (const p of players) {
    const list = bySlot.get(p.slot) ?? [];
    list.push(p);
    bySlot.set(p.slot, list);
  }
  return SLOT_ORDER.filter((slot) => bySlot.has(slot)).map((slot) => ({
    slot,
    label: SLOT_LABELS[slot],
    players: bySlot.get(slot)!,
  }));
}

type LeaguesHubProps = {
  onShowPageIntroChange?: (show: boolean) => void;
};

export function LeaguesHub({ onShowPageIntroChange }: LeaguesHubProps) {
  const [username, setUsername] = useState("");
  const [leagues, setLeagues] = useState<LeagueOption[] | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [teams, setTeams] = useState<TeamOption[] | null>(null);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [result, setResult] = useState<GuidanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);
  const [sessionFlash, setSessionFlash] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<TradeSuggestion[]>([]);
  const [prefetchStatus, setPrefetchStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [remainingStatus, setRemainingStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestionsValueNote, setSuggestionsValueNote] = useState<string | undefined>();
  const [usernameHelpOpen, setUsernameHelpOpen] = useState(false);

  const suggestionsPanelRef = useRef<HTMLDivElement>(null);
  const usernameHelpPanelRef = useRef<HTMLDivElement>(null);
  const remainingFetchStarted = useRef(false);

  const resetSuggestionState = useCallback(() => {
    setSuggestions([]);
    setPrefetchStatus("idle");
    setRemainingStatus("idle");
    setSuggestionsError(null);
    setSuggestionsValueNote(undefined);
    remainingFetchStarted.current = false;
  }, []);

  const resetBelowUser = useCallback(() => {
    setLeagues(null);
    setSelectedLeagueId("");
    setTeams(null);
    setSelectedRosterId("");
    setResult(null);
    resetSuggestionState();
    setTeamPickerOpen(false);
  }, [resetSuggestionState]);

  useEffect(() => {
    onShowPageIntroChange?.(Boolean(result));
  }, [result, onShowPageIntroChange]);

  useEffect(() => {
    if (result) {
      setTeamPickerOpen(false);
      setSessionFlash(true);
      const t = window.setTimeout(() => setSessionFlash(false), 600);
      return () => window.clearTimeout(t);
    }
  }, [result]);

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
    setResult(null);
    try {
      const res = await fetch(`/api/sleeper/league-teams?league_id=${encodeURIComponent(id)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setTeams(body.teams);
      if (body.teams.length === 1) {
        setSelectedRosterId(String(body.teams[0].roster_id));
      }
      if (advanceWizard && body.teams.length > 0) {
        setWizardStep(3);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load league teams");
    } finally {
      setLoading(false);
    }
  }, []);

  const onLeagueChange = useCallback(
    (id: string) => {
      setSelectedLeagueId(id);
      setResult(null);
      resetSuggestionState();
      if (id) void loadTeamsForLeague(id, true);
    },
    [loadTeamsForLeague, resetSuggestionState],
  );

  const fetchSuggestions = useCallback(
    async (opts: { limit: number; offset: number; exclude?: string[] }) => {
      if (!selectedLeagueId || !selectedRosterId) return [];
      const params = new URLSearchParams({
        league_id: selectedLeagueId,
        roster_id: selectedRosterId,
        limit: String(opts.limit),
        offset: String(opts.offset),
      });
      if (opts.exclude?.length) {
        params.set("exclude", opts.exclude.join(","));
      }
      const res = await fetch(`/api/sleeper/trade-suggestions?${params}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      if (body.meta?.valueNote) setSuggestionsValueNote(body.meta.valueNote);
      return (body.suggestions ?? []) as TradeSuggestion[];
    },
    [selectedLeagueId, selectedRosterId],
  );

  const analyzeRoster = useCallback(async () => {
    if (!selectedLeagueId || !selectedRosterId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    resetSuggestionState();
    try {
      const res = await fetch(
        `/api/sleeper/roster-guidance?league_id=${encodeURIComponent(selectedLeagueId)}&roster_id=${encodeURIComponent(selectedRosterId)}`,
      );
      const body = (await res.json()) as GuidanceResponse;
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setResult(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyze roster");
    } finally {
      setLoading(false);
    }
  }, [selectedLeagueId, selectedRosterId, resetSuggestionState]);

  useEffect(() => {
    if (!result || !selectedLeagueId || !selectedRosterId) return;
    let cancelled = false;
    setPrefetchStatus("loading");
    setSuggestionsError(null);
    void (async () => {
      try {
        const first = await fetchSuggestions({ limit: 1, offset: 0 });
        if (cancelled) return;
        setSuggestions(first);
        setPrefetchStatus("done");
      } catch (e) {
        if (cancelled) return;
        setPrefetchStatus("error");
        setSuggestionsError(e instanceof Error ? e.message : "Could not load trade suggestions");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [result, selectedLeagueId, selectedRosterId, fetchSuggestions]);

  const fetchRemainingSuggestions = useCallback(async () => {
    if (remainingFetchStarted.current) return;
    remainingFetchStarted.current = true;
    setRemainingStatus("loading");
    try {
      const exclude = suggestions.map((s) => s.id);
      const more = await fetchSuggestions({
        limit: 2,
        offset: 0,
        exclude: exclude.length ? exclude : undefined,
      });
      setSuggestions((prev) => {
        const byId = new Map(prev.map((s) => [s.id, s]));
        for (const s of more) byId.set(s.id, s);
        return [...byId.values()].sort((a, b) => a.rank - b.rank);
      });
      setRemainingStatus("done");
    } catch (e) {
      setRemainingStatus("error");
      setSuggestionsError(e instanceof Error ? e.message : "Could not load more suggestions");
    }
  }, [fetchSuggestions, suggestions]);

  const openTradeSuggestions = useCallback(() => {
    setSuggestionsOpen(true);
    if (suggestions.length < 3 && prefetchStatus !== "loading") {
      void fetchRemainingSuggestions();
    }
  }, [suggestions.length, prefetchStatus, fetchRemainingSuggestions]);

  useEffect(() => {
    if (!suggestionsOpen) return;
    if (prefetchStatus === "loading") return;
    if (suggestions.length >= 3) return;
    if (remainingStatus !== "idle") return;
    void fetchRemainingSuggestions();
  }, [suggestionsOpen, prefetchStatus, suggestions.length, remainingStatus, fetchRemainingSuggestions]);

  useEffect(() => {
    if (!suggestionsOpen && !usernameHelpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (usernameHelpOpen) setUsernameHelpOpen(false);
        else if (suggestionsOpen) setSuggestionsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [suggestionsOpen, usernameHelpOpen]);

  useEffect(() => {
    if (!usernameHelpOpen) return;
    requestAnimationFrame(() => {
      const panel = usernameHelpPanelRef.current;
      const focusable = panel?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    });
  }, [usernameHelpOpen]);

  useEffect(() => {
    if (!suggestionsOpen) return;
    requestAnimationFrame(() => {
      const panel = suggestionsPanelRef.current;
      const focusable = panel?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    });
  }, [suggestionsOpen]);

  const openConnection = useCallback(() => {
    setResult(null);
    setWizardStep(1);
    setLeagues(null);
    setSelectedLeagueId("");
    setTeams(null);
    setSelectedRosterId("");
    setError(null);
    resetSuggestionState();
    setTeamPickerOpen(false);
  }, [resetSuggestionState]);

  const wizardBack = useCallback(() => {
    setError(null);
    if (wizardStep === 3) {
      setWizardStep(2);
      setTeams(null);
      setSelectedRosterId("");
      setResult(null);
      resetSuggestionState();
      return;
    }
    if (wizardStep === 2) {
      setWizardStep(1);
      setLeagues(null);
      setSelectedLeagueId("");
      setTeams(null);
      setSelectedRosterId("");
      setResult(null);
      resetSuggestionState();
    }
  }, [wizardStep, resetSuggestionState]);

  const displayInsights = useMemo(
    () => result?.guidance.insights.filter((i) => i.id !== "value-rank") ?? [],
    [result],
  );

  const rosterGroups = useMemo(
    () => (result ? groupPlayersBySlot(result.guidance.players) : []),
    [result],
  );

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

  const teamSelectOptions = useMemo(() => {
    if (!teams?.length) return [];
    return teams.map((t) => ({
      value: String(t.roster_id),
      label: `${t.name} (${t.player_count})`,
    }));
  }, [teams]);

  const leaguesLoading = wizardStep === 2 && loading && leagues === null;
  const teamsLoading =
    (wizardStep === 2 && loading && !!selectedLeagueId && teams === null) ||
    (wizardStep === 3 && loading && teams === null);

  const canAnalyze = Boolean(selectedLeagueId && selectedRosterId && teams && teams.length > 0);

  return (
    <div className="leagues-hub w-full min-w-0 space-y-6 lg:space-y-8">
      {!result ? (
        <>
          {error ? (
            <div
              role="alert"
              className="mx-auto max-w-lg sm:max-w-xl rounded-[var(--dash-radius-md)] border border-dash-danger/50 bg-dash-danger/15 px-4 py-3 text-sm font-medium text-dash-danger"
            >
              {error}
            </div>
          ) : null}
          <SleeperConnectWizard
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
            teamEmptyMessage={
              teams && teams.length === 0 ? "No teams found for this league." : undefined
            }
            onConnect={() => void connectUsername()}
            onLeagueSelect={onLeagueChange}
            onTeamSelect={setSelectedRosterId}
            onAnalyze={() => void analyzeRoster()}
            onBack={wizardBack}
            onOpenUsernameHelp={() => setUsernameHelpOpen(true)}
          />
        </>
      ) : null}

      {result ? (
        <>
          <div
            className={`sticky top-[4.25rem] z-20 rounded-[var(--dash-radius-md)] border border-dash-border bg-dash-surface-elevated/95 px-4 py-4 backdrop-blur-md sm:px-5 ${sessionFlash ? "dash-animate-team-flash" : ""}`}
            aria-label="Roster session"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1.5 flex-1">
                <h2 className="dash-heading-subsection text-dash-text truncate">{result.team.name}</h2>
                <p className="text-sm text-dash-text/75 truncate">
                  {result.league.name} · {result.league.season} · {result.leagueContextLabel}
                </p>
                <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                  <div className="flex items-baseline gap-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-dash-text/70">Value</dt>
                    <dd className="tabular-nums font-semibold text-dash-text">
                      {result.guidance.totalValue.toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-dash-text/70">Rank</dt>
                    <dd className="tabular-nums font-medium text-dash-text">
                      {result.guidance.valueRank} of {result.guidance.leagueRosterCount}
                    </dd>
                  </div>
                  {loading ? (
                    <dd className="text-sm text-dash-text/70" aria-live="polite">
                      Updating…
                    </dd>
                  ) : null}
                </dl>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">
                {teams && teams.length > 1 ? (
                  <button
                    type="button"
                    className={btnSecondary}
                    aria-expanded={teamPickerOpen}
                    onClick={() => setTeamPickerOpen((v) => !v)}
                  >
                    Change team
                  </button>
                ) : null}
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={loading || !selectedRosterId}
                  onClick={() => void analyzeRoster()}
                >
                  Re-analyze
                </button>
                <button type="button" className={btnSecondary} onClick={openConnection}>
                  Change connection
                </button>
              </div>
            </div>

            {teamPickerOpen && teams && teams.length > 1 ? (
              <div className="mt-3 max-w-md space-y-3">
                <ConnectBarSelect
                  id="team-select-session"
                  label="Team"
                  value={selectedRosterId}
                  options={teamSelectOptions}
                  placeholder="Select team"
                  onChange={setSelectedRosterId}
                />
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={loading || !selectedRosterId}
                  onClick={() => {
                    setTeamPickerOpen(false);
                    void analyzeRoster();
                  }}
                >
                  Apply
                </button>
              </div>
            ) : null}
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded-[var(--dash-radius-md)] border border-dash-danger/50 bg-dash-danger/15 px-4 py-3 text-sm font-medium text-dash-danger"
            >
              {error}
            </div>
          ) : null}

          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8 lg:items-start">
            <section id="leagues-roster" className="min-w-0 space-y-4 order-2 lg:order-1 scroll-mt-32">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="dash-heading-subsection text-dash-text">Roster</h3>
                <Link href="/trade" className={linkAction}>
                  Trade calculator →
                </Link>
              </div>

              <div className="rounded-[var(--dash-radius-md)] border border-dash-border overflow-hidden">
                <div className="dash-scrollbar max-h-[min(60vh,32rem)] overflow-y-auto overscroll-contain bg-black/25">
                  <table className="w-full text-sm text-left">
                    <thead className="sticky top-0 z-10 bg-dash-surface-elevated text-dash-text/75 text-xs uppercase tracking-wide border-b border-dash-border/40">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-left">Player</th>
                        <th className="px-3 py-3 font-semibold w-12">Pos</th>
                        <th className="px-3 py-3 font-semibold text-right w-20">Value</th>
                        <th className="px-4 py-3 font-semibold text-right hidden sm:table-cell w-16">Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rosterGroups.map((group) => (
                        <Fragment key={group.slot}>
                          <tr className="bg-black/35">
                            <th
                              colSpan={4}
                              scope="colgroup"
                              className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-dash-text/70"
                            >
                              {group.label}
                              <span className="ml-2 font-normal normal-case tracking-normal text-dash-text/55">
                                {group.players.length}
                              </span>
                            </th>
                          </tr>
                          {group.players.map((p) => (
                            <tr
                              key={p.sleeperPlayerId}
                              className="border-t border-white/10 bg-black/20 hover:bg-white/[0.04]"
                            >
                              <td className="px-4 py-2.5 text-dash-text font-medium">{p.name}</td>
                              <td className="px-3 py-2.5 text-dash-text/80">{p.position ?? "—"}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-dash-text font-medium">
                                {p.value.toLocaleString()}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-dash-text/75 hidden sm:table-cell">
                                {p.age ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-dash-text/70 leading-relaxed">{result.meta.valueNote}</p>
              {result.meta.playersUnmatched > 0 ? (
                <p className="text-xs text-dash-warning max-w-2xl">
                  {result.meta.playersUnmatched} rostered player(s) had no trade value in our catalog (practice squad,
                  ID gaps, or defense-only slots).
                </p>
              ) : null}
            </section>

            <aside
              id="leagues-guidance"
              className="order-1 lg:order-2 lg:sticky lg:top-[7.25rem] lg:self-start space-y-4 scroll-mt-32"
            >
              <div className="dash-glass-panel rounded-[var(--dash-radius-md)] p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-dash-text/85">Guidance</h3>
                  <a href="#leagues-roster" className={`lg:hidden ${linkAction} text-xs`}>
                    Roster ↓
                  </a>
                </div>
                {displayInsights.length === 0 ? (
                  <p className="text-sm text-dash-text/75">No extra insights beyond roster rank for this team.</p>
                ) : (
                  <ul className="space-y-4">
                    {displayInsights.map((insight) => (
                      <li key={insight.id} className="flex gap-3 min-w-0 items-start">
                        <span
                          className={`mt-2 h-2 w-2 shrink-0 rounded-full ${toneDot[insight.tone]}`}
                          aria-hidden
                        />
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-dash-text leading-snug">{insight.title}</p>
                          <p className="text-sm text-dash-text/80 leading-relaxed">{insight.body}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={openTradeSuggestions}
                  className={`${btnPress} block w-full text-center min-h-11 leading-[2.75rem] text-sm font-semibold rounded-[var(--dash-radius-sm)] border border-dash-primary/45 text-dash-text bg-dash-primary/15 hover:bg-dash-primary/30 hover:border-dash-primary/70`}
                >
                  {prefetchStatus === "loading" ? "Trade suggestions…" : "Trade suggestions"}
                </button>
              </div>
            </aside>
          </div>

          <TradeSuggestionsModal
            open={suggestionsOpen}
            onClose={() => setSuggestionsOpen(false)}
            panelRef={suggestionsPanelRef}
            team1Name={result.team.name}
            suggestions={suggestions}
            prefetchLoading={prefetchStatus === "loading"}
            remainingLoading={remainingStatus === "loading"}
            error={suggestionsError}
            valueNote={suggestionsValueNote}
          />
        </>
      ) : null}

      <SleeperUsernameHelpModal
        open={usernameHelpOpen}
        onClose={() => setUsernameHelpOpen(false)}
        panelRef={usernameHelpPanelRef}
      />
    </div>
  );
}
