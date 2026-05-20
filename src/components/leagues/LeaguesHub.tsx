"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ConnectBarSelect } from "@/components/leagues/ConnectBarSelect";
import type { GuidanceInsight, RosterPlayerRow, RosterSlot } from "@/lib/roster-guidance";

type SleeperUserDto = { user_id: string; username: string; display_name: string };
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

const fieldClass =
  "w-full min-h-11 rounded-[var(--dash-radius-sm)] border border-dash-border bg-black/35 px-3 py-2 text-sm text-dash-text placeholder:text-dash-text/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface";

/** DESIGN.md: pointer cursor, 150ms transitions, focus rings, clear hover on all button paths */
const btnPress =
  "cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed";

const btnPrimary = `${btnPress} inline-flex items-center justify-center min-h-11 px-5 rounded-[var(--dash-radius-sm)] bg-dash-primary text-sm font-semibold text-dash-text hover:bg-dash-primary/90`;

const btnSecondary = `${btnPress} inline-flex items-center justify-center min-h-11 px-4 rounded-[var(--dash-radius-sm)] border border-white/15 bg-black/25 text-sm font-medium text-dash-text/90 hover:bg-white/10 hover:border-white/25 hover:text-dash-text`;

const linkAction =
  "cursor-pointer text-sm font-semibold text-dash-primary hover:text-dash-text motion-safe:transition-colors motion-safe:duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface rounded-[var(--dash-radius-sm)]";

const connectFieldShell =
  "leagues-connect-field dash-glass-panel rounded-[var(--dash-radius-md)] min-w-0 overflow-visible";

const connectRow = "leagues-connect-row flex flex-col sm:flex-row flex-wrap sm:flex-nowrap items-stretch gap-3 w-full";

const connectBarLabel =
  "text-xs font-semibold uppercase tracking-wide text-dash-text/85 leading-none";

const connectBarControl =
  "w-full min-h-9 border-0 bg-transparent p-0 text-sm text-dash-text placeholder:text-dash-text/55 focus-visible:outline-none";

const btnBarAction = `${btnPress} flex h-11 w-11 items-center justify-center rounded-full bg-dash-primary text-dash-text hover:bg-dash-primary/90`;

function BarSearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="text-dash-text">
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M16 16l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

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

export function LeaguesHub() {
  const [username, setUsername] = useState("");
  const [leagueIdDirect, setLeagueIdDirect] = useState("");
  const [user, setUser] = useState<SleeperUserDto | null>(null);
  const [leagues, setLeagues] = useState<LeagueOption[] | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [teams, setTeams] = useState<TeamOption[] | null>(null);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [result, setResult] = useState<GuidanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(true);
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);

  const connectionRef = useRef<HTMLElement>(null);

  const resetBelowUser = useCallback(() => {
    setLeagues(null);
    setSelectedLeagueId("");
    setTeams(null);
    setSelectedRosterId("");
    setResult(null);
    setConnectionOpen(true);
    setTeamPickerOpen(false);
  }, []);

  useEffect(() => {
    if (result) {
      setConnectionOpen(false);
      setTeamPickerOpen(false);
    }
  }, [result]);

  const connectUsername = useCallback(async () => {
    const q = username.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    resetBelowUser();
    setUser(null);
    try {
      const res = await fetch(`/api/sleeper/user?username=${encodeURIComponent(q)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setUser(body.user);
      const lgRes = await fetch(`/api/sleeper/leagues?user_id=${encodeURIComponent(body.user.user_id)}`);
      const lgBody = await lgRes.json();
      if (!lgRes.ok) throw new Error(lgBody.error || `HTTP ${lgRes.status}`);
      setLeagues(lgBody.leagues);
      if (lgBody.leagues.length === 0) {
        setError("No dynasty leagues found for this user in the current or previous NFL season.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect Sleeper account");
    } finally {
      setLoading(false);
    }
  }, [username, resetBelowUser]);

  const loadTeamsForLeague = useCallback(async (id: string) => {
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
      if (id) void loadTeamsForLeague(id);
    },
    [loadTeamsForLeague],
  );

  const connectByLeagueId = useCallback(async () => {
    const id = leagueIdDirect.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    setUser(null);
    setLeagues(null);
    setSelectedLeagueId(id);
    setResult(null);
    try {
      await loadTeamsForLeague(id);
    } catch {
      /* loadTeamsForLeague sets error */
    } finally {
      setLoading(false);
    }
  }, [leagueIdDirect, loadTeamsForLeague]);

  const analyzeRoster = useCallback(async () => {
    if (!selectedLeagueId || !selectedRosterId) return;
    setLoading(true);
    setError(null);
    setResult(null);
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
  }, [selectedLeagueId, selectedRosterId]);

  const openConnection = useCallback(() => {
    setConnectionOpen(true);
    setTeamPickerOpen(false);
    requestAnimationFrame(() => {
      connectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const displayInsights = useMemo(
    () => result?.guidance.insights.filter((i) => i.id !== "value-rank") ?? [],
    [result],
  );

  const rosterGroups = useMemo(
    () => (result ? groupPlayersBySlot(result.guidance.players) : []),
    [result],
  );

  const showConnectFlow = !result || connectionOpen;
  const hasLeagueList = Boolean(leagues && leagues.length > 0);
  const hasTeamList = Boolean(teams && teams.length > 0);
  const connectedViaLeagueId = Boolean(selectedLeagueId && !user && !hasLeagueList);
  const leagueLocked = connectedViaLeagueId || Boolean(selectedLeagueId && !hasLeagueList && hasTeamList);
  const readyToAnalyze = Boolean(selectedLeagueId && selectedRosterId && hasTeamList);
  const primaryBarAction: "find" | "analyze" = user || connectedViaLeagueId ? "analyze" : "find";

  const leagueSelectOptions = useMemo(() => {
    if (leagueLocked && selectedLeagueId) {
      return [{ value: selectedLeagueId, label: `League ID · ${selectedLeagueId.slice(0, 12)}…` }];
    }
    if (!leagues?.length) return [];
    return leagues.map((l) => ({
      value: l.league_id,
      label: `${l.name} (${l.season})`,
    }));
  }, [leagueLocked, leagues, selectedLeagueId]);

  const teamSelectOptions = useMemo(() => {
    if (!teams?.length) return [];
    return teams.map((t) => ({
      value: String(t.roster_id),
      label: `${t.name} (${t.player_count})`,
    }));
  }, [teams]);

  const leaguePlaceholder = connectedViaLeagueId
    ? loading && !teams
      ? "Loading league…"
      : "League ID"
    : !user
      ? "Find leagues first"
      : loading && !leagues
        ? "Loading leagues…"
        : leagues && leagues.length === 0
          ? "No leagues found"
          : "Select league";

  const teamPlaceholder = !selectedLeagueId
    ? "Select league first"
    : loading && !teams
      ? "Loading teams…"
      : teams && teams.length === 0
        ? "No teams found"
        : "Select team";

  const leagueSelectDisabled =
    leagueLocked || !user || !hasLeagueList || (loading && !leagues && !connectedViaLeagueId);
  const teamSelectDisabled = !selectedLeagueId || !hasTeamList || (loading && !teams);

  return (
    <div className="leagues-hub w-full min-w-0 space-y-6 lg:space-y-8">
      {showConnectFlow ? (
        <section ref={connectionRef} className="space-y-4 scroll-mt-28">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="dash-heading-section text-dash-text">Connect Sleeper</h2>
            {result ? (
              <button type="button" className={btnSecondary} onClick={() => setConnectionOpen(false)}>
                Hide
              </button>
            ) : null}
          </div>
          <p className="text-sm text-dash-text/75 leading-relaxed max-w-xl">
            Username, league, and team stay on one row. Find leagues, then choose from the menus. Same trade values as
            the calculator.
          </p>

          <div className={connectRow} role="group" aria-label="Connect Sleeper" aria-busy={loading}>
            <div className={`${connectFieldShell} flex-1 sm:flex-[1]`}>
              <label htmlFor="sleeper-username" className={connectBarLabel}>
                Username
              </label>
              <input
                id="sleeper-username"
                className={connectBarControl}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Sleeper handle"
                autoComplete="off"
                name="sleeper-username-field"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !user && username.trim() && !loading) void connectUsername();
                }}
              />
            </div>

            <div className={`${connectFieldShell} flex-1 sm:flex-[1.15]`}>
              <span className={connectBarLabel}>League</span>
              <ConnectBarSelect
                id="league-select"
                label="League"
                value={selectedLeagueId}
                options={leagueSelectOptions}
                placeholder={leaguePlaceholder}
                disabled={leagueSelectDisabled}
                onChange={onLeagueChange}
              />
            </div>

            <div className={`${connectFieldShell} flex-1 sm:flex-[1]`}>
              <span className={connectBarLabel}>Team</span>
              <ConnectBarSelect
                id="team-select"
                label="Team"
                value={selectedRosterId}
                options={teamSelectOptions}
                placeholder={teamPlaceholder}
                disabled={teamSelectDisabled}
                onChange={setSelectedRosterId}
              />
            </div>

            <div className="flex items-center justify-center shrink-0 sm:pl-1">
              <button
                type="button"
                className={btnBarAction}
                disabled={
                  loading ||
                  (primaryBarAction === "find" && !username.trim()) ||
                  (primaryBarAction === "analyze" && !readyToAnalyze)
                }
                aria-label={primaryBarAction === "find" ? "Find leagues" : "Analyze roster"}
                onClick={() =>
                  void (primaryBarAction === "find" ? connectUsername() : analyzeRoster())
                }
              >
                <BarSearchIcon />
              </button>
            </div>
          </div>

          {user && leagues && leagues.length === 0 ? (
            <p className="text-sm text-dash-text/75">
              No dynasty leagues found for this account in the current or previous season.
            </p>
          ) : null}

          <details className="text-sm text-dash-text/75">
            <summary className="cursor-pointer min-h-11 inline-flex items-center text-dash-text/80 hover:text-dash-primary motion-safe:transition-colors motion-safe:duration-150">
              Or paste a league ID
            </summary>
            <div className={`mt-3 ${connectRow}`} aria-busy={loading}>
              <div className={`${connectFieldShell} flex-1 min-w-[14rem]`}>
                <label htmlFor="league-id-direct" className={connectBarLabel}>
                  League ID
                </label>
                <input
                  id="league-id-direct"
                  className={connectBarControl}
                  value={leagueIdDirect}
                  onChange={(e) => setLeagueIdDirect(e.target.value)}
                  placeholder="Sleeper league ID"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && leagueIdDirect.trim() && !loading) void connectByLeagueId();
                  }}
                />
              </div>
              <div className="flex items-center justify-center shrink-0">
                <button
                  type="button"
                  className={btnBarAction}
                  disabled={loading || !leagueIdDirect.trim()}
                  aria-label="Load league"
                  onClick={() => void connectByLeagueId()}
                >
                  <BarSearchIcon />
                </button>
              </div>
            </div>
          </details>
        </section>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-[var(--dash-radius-md)] border border-dash-danger/50 bg-dash-danger/15 px-4 py-3 text-sm font-medium text-dash-danger"
        >
          {error}
        </div>
      ) : null}

      {result ? (
        <>
          <div
            className="sticky top-[4.25rem] z-20 rounded-[var(--dash-radius-md)] border border-dash-border bg-dash-surface-elevated/95 px-4 py-4 backdrop-blur-md sm:px-5"
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
              <div className="mt-3 flex flex-col sm:flex-row gap-3 max-w-md sm:items-end">
                <div className="flex-1 min-w-0 rounded-[var(--dash-radius-sm)] border border-dash-border bg-black/35 px-3 py-2">
                  <ConnectBarSelect
                    id="team-select-session"
                    label="Team"
                    value={selectedRosterId}
                    options={teamSelectOptions}
                    placeholder="Select team"
                    onChange={setSelectedRosterId}
                  />
                </div>
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

          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8 lg:items-start">
            <section id="leagues-roster" className="min-w-0 space-y-4 order-2 lg:order-1 scroll-mt-32">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="dash-heading-subsection text-dash-text">Roster</h3>
                <Link href="/trade" className={linkAction}>
                  Trade calculator →
                </Link>
              </div>

              <div className="rounded-[var(--dash-radius-md)] border border-dash-border overflow-hidden">
                <div className="max-h-[min(60vh,32rem)] overflow-y-auto overscroll-contain">
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
                <Link
                  href="/trade"
                  className={`${btnPress} block text-center min-h-11 leading-[2.75rem] text-sm font-semibold rounded-[var(--dash-radius-sm)] border border-dash-primary/45 text-dash-text bg-dash-primary/15 hover:bg-dash-primary/30 hover:border-dash-primary/70`}
                >
                  Open trade calculator
                </Link>
              </div>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
