"use client";

import { ConnectBarSelect } from "@/components/leagues/ConnectBarSelect";
import type { ConnectBarSelectOption } from "@/components/leagues/ConnectBarSelect";

type Props = {
  leagueOptions: ConnectBarSelectOption[];
  teamOptions: ConnectBarSelectOption[];
  weekOptions: ConnectBarSelectOption[];
  selectedLeagueId: string;
  selectedRosterId: string;
  selectedWeek: string;
  leaguesDisabled?: boolean;
  teamsDisabled?: boolean;
  weeksDisabled?: boolean;
  weeksLoading?: boolean;
  onLeagueChange: (value: string) => void;
  onTeamChange: (value: string) => void;
  onWeekChange: (value: string) => void;
};

export function MatchupAdviceControlBar({
  leagueOptions,
  teamOptions,
  weekOptions,
  selectedLeagueId,
  selectedRosterId,
  selectedWeek,
  leaguesDisabled = false,
  teamsDisabled = false,
  weeksDisabled = false,
  weeksLoading = false,
  onLeagueChange,
  onTeamChange,
  onWeekChange,
}: Props) {
  return (
    <div
      className="rounded-[var(--dash-radius-md)] border border-dash-border bg-dash-surface-elevated/95 px-4 py-4 sm:px-5"
      aria-label="Matchup filters"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="min-w-0 space-y-1.5">
          <label htmlFor="matchup-league" className="text-xs font-semibold uppercase tracking-wide text-dash-text/70">
            League
          </label>
          <ConnectBarSelect
            id="matchup-league"
            label="League"
            value={selectedLeagueId}
            options={leagueOptions}
            placeholder="Select league"
            disabled={leaguesDisabled}
            onChange={onLeagueChange}
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <label htmlFor="matchup-team" className="text-xs font-semibold uppercase tracking-wide text-dash-text/70">
            Team
          </label>
          <ConnectBarSelect
            id="matchup-team"
            label="Team"
            value={selectedRosterId}
            options={teamOptions}
            placeholder="Select team"
            disabled={teamsDisabled}
            onChange={onTeamChange}
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <label htmlFor="matchup-week" className="text-xs font-semibold uppercase tracking-wide text-dash-text/70">
            Week{weeksLoading ? " (loading…)" : ""}
          </label>
          <ConnectBarSelect
            id="matchup-week"
            label="Week"
            value={selectedWeek}
            options={weekOptions}
            placeholder={weekOptions.length === 0 ? "Loading weeks…" : "Select week"}
            disabled={weeksDisabled}
            onChange={onWeekChange}
          />
        </div>
      </div>
    </div>
  );
}
