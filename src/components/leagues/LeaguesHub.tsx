"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import type { GuidanceInsight, RosterPlayerRow } from "@/lib/roster-guidance";

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

const toneStyles: Record<GuidanceInsight["tone"], string> = {
  neutral: "border-white/12 bg-white/[0.03]",
  positive: "border-home-accent/25 bg-home-accent/[0.06]",
  caution: "border-dash-warning/30 bg-dash-warning/[0.06]",
  opportunity: "border-home-accent/20 bg-home-accent/[0.04]",
};

const fieldClass =
  "w-full min-h-11 rounded-[var(--dash-radius-sm)] border border-white/15 bg-black/35 px-3 py-2 text-sm text-dash-text placeholder:text-dash-text/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-home-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#050a12]";

const btnPrimary =
  "inline-flex items-center justify-center min-h-11 px-5 rounded-[var(--dash-radius-sm)] bg-home-accent text-[#050a12] text-[11px] font-bold uppercase tracking-[0.1em] hover:bg-home-accent-hover disabled:opacity-50 disabled:pointer-events-none motion-safe:transition-colors duration-150";

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

  const resetBelowUser = useCallback(() => {
    setLeagues(null);
    setSelectedLeagueId("");
    setTeams(null);
    setSelectedRosterId("");
    setResult(null);
  }, []);

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

  return (
    <div className="space-y-8 max-w-3xl">
      <section className="space-y-4">
        <h2 className="dash-heading-section text-dash-text">Connect Sleeper</h2>
        <p className="text-sm text-home-muted leading-relaxed">
          Enter your Sleeper username to pull dynasty leagues, pick your team, and get roster guidance
          using the same trade values as the calculator.
        </p>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-dash-text/85" htmlFor="sleeper-username">
            Sleeper username
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="sleeper-username"
              className={fieldClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. your_sleeper_handle"
              autoComplete="username"
            />
            <button type="button" className={btnPrimary} disabled={loading || !username.trim()} onClick={() => void connectUsername()}>
              Find leagues
            </button>
          </div>
        </div>

        <details className="text-sm text-dash-text/60">
          <summary className="cursor-pointer hover:text-dash-text min-h-11 inline-flex items-center">
            Or paste a league ID
          </summary>
          <div className="mt-3 flex flex-col sm:flex-row gap-3">
            <input
              className={fieldClass}
              value={leagueIdDirect}
              onChange={(e) => setLeagueIdDirect(e.target.value)}
              placeholder="Sleeper league ID"
            />
            <button type="button" className={btnPrimary} disabled={loading || !leagueIdDirect.trim()} onClick={() => void connectByLeagueId()}>
              Load league
            </button>
          </div>
        </details>

        {user ? (
          <p className="text-xs text-home-muted">
            Connected as <span className="text-dash-text font-medium">{user.display_name || user.username}</span>
          </p>
        ) : null}
      </section>

      {leagues && leagues.length > 0 ? (
        <section className="space-y-3">
          <label className="block text-sm font-medium text-dash-text/85" htmlFor="league-select">
            Dynasty league
          </label>
          <select
            id="league-select"
            className={`${fieldClass} dash-trade-select`}
            value={selectedLeagueId}
            onChange={(e) => onLeagueChange(e.target.value)}
          >
            <option value="">Select a league</option>
            {leagues.map((l) => (
              <option key={l.league_id} value={l.league_id}>
                {l.name} ({l.season}) · {l.status.replace(/_/g, " ")} · {l.total_rosters} teams
              </option>
            ))}
          </select>
        </section>
      ) : null}

      {selectedLeagueId && teams && teams.length > 0 ? (
        <section className="space-y-3">
          <label className="block text-sm font-medium text-dash-text/85" htmlFor="team-select">
            Your team
          </label>
          <select
            id="team-select"
            className={`${fieldClass} dash-trade-select`}
            value={selectedRosterId}
            onChange={(e) => setSelectedRosterId(e.target.value)}
          >
            <option value="">Select your roster</option>
            {teams.map((t) => (
              <option key={t.roster_id} value={String(t.roster_id)}>
                {t.name} ({t.player_count} players)
              </option>
            ))}
          </select>
          <button
            type="button"
            className={btnPrimary}
            disabled={loading || !selectedRosterId}
            onClick={() => void analyzeRoster()}
          >
            Analyze roster
          </button>
        </section>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-[var(--dash-radius-md)] border border-dash-danger/35 bg-dash-danger/10 px-4 py-3 text-sm text-dash-danger">
          {error}
        </div>
      ) : null}

      {result ? (
        <section className="space-y-6">
          <header className="space-y-1">
            <h2 className="dash-heading-section text-dash-text">{result.team.name}</h2>
            <p className="text-sm text-home-muted">
              {result.league.name} · {result.league.season} · {result.leagueContextLabel}
            </p>
            <p className="text-sm text-dash-text/75">
              Modeled roster value{" "}
              <span className="font-semibold text-dash-text">{result.guidance.totalValue.toLocaleString()}</span>
              {" · "}rank {result.guidance.valueRank} of {result.guidance.leagueRosterCount}
            </p>
          </header>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-dash-text/70">Guidance</h3>
            <ul className="space-y-3">
              {result.guidance.insights.map((insight) => (
                <li
                  key={insight.id}
                  className={`rounded-[var(--dash-radius-md)] border px-4 py-3 ${toneStyles[insight.tone]}`}
                >
                  <p className="text-sm font-semibold text-dash-text mb-1">{insight.title}</p>
                  <p className="text-sm text-dash-text/75 leading-relaxed">{insight.body}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-dash-text/70">Roster</h3>
              <Link href="/trade" className="text-xs font-bold uppercase tracking-wide text-home-accent hover:text-dash-text">
                Open trade calculator →
              </Link>
            </div>
            <div className="rounded-[var(--dash-radius-md)] border border-white/12 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-black/30 text-dash-text/55 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 font-medium">Player</th>
                    <th className="px-3 py-2 font-medium">Pos</th>
                    <th className="px-3 py-2 font-medium text-right">Value</th>
                    <th className="px-3 py-2 font-medium hidden sm:table-cell">Slot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {result.guidance.players.map((p) => (
                    <tr key={p.sleeperPlayerId} className="bg-black/15 hover:bg-white/[0.03]">
                      <td className="px-3 py-2 text-dash-text font-medium">{p.name}</td>
                      <td className="px-3 py-2 text-dash-text/65">{p.position ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-dash-text">{p.value.toLocaleString()}</td>
                      <td className="px-3 py-2 text-dash-text/55 capitalize hidden sm:table-cell">{p.slot}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-dash-text/50 leading-relaxed">{result.meta.valueNote}</p>
            {result.meta.playersUnmatched > 0 ? (
              <p className="text-xs text-dash-warning">
                {result.meta.playersUnmatched} rostered player(s) had no trade value in our catalog (practice squad, ID gaps, or defense-only slots).
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
