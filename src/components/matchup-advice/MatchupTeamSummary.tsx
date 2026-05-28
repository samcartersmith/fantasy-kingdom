"use client";

import type { MatchupTeamSummary } from "@/lib/matchup-advice/types";

type Props = {
  team: MatchupTeamSummary;
  side: "left" | "right";
};

function WinBar({ pct, side }: { pct: number | null; side: "left" | "right" }) {
  if (pct == null) return null;
  const width = Math.max(4, Math.min(100, pct));
  const barColor = side === "left" ? "bg-dash-primary" : "bg-dash-success/80";
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${width}%` }} />
      </div>
      <p className="text-[11px] tabular-nums text-dash-text/65">{pct.toFixed(1)}% win prob</p>
    </div>
  );
}

export function MatchupTeamSummaryCard({ team, side }: Props) {
  const displayTotal =
    team.actualTotal != null ? team.actualTotal : team.projectedTotal;

  return (
    <article
      className={`min-w-0 flex-1 rounded-[var(--dash-radius-md)] border border-dash-border bg-black/25 p-4 sm:p-5 ${
        side === "right" ? "sm:text-right" : ""
      }`}
    >
      <div
        className={`flex items-start gap-3 ${side === "right" ? "sm:flex-row-reverse sm:text-right" : ""}`}
      >
        {team.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={team.avatarUrl}
            alt=""
            className="size-10 shrink-0 rounded-full ring-1 ring-white/15"
          />
        ) : (
          <div
            className="size-10 shrink-0 rounded-full bg-white/10 ring-1 ring-white/15"
            aria-hidden
          />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          {team.username ? (
            <p className="text-xs text-dash-text/60 truncate">@{team.username}</p>
          ) : null}
          <h2 className="dash-heading-subsection text-dash-text truncate">{team.teamName}</h2>
        </div>
      </div>

      <div className={`mt-3 ${side === "right" ? "sm:ml-auto sm:max-w-xs" : "max-w-xs"}`}>
        <WinBar pct={team.winProbability} side={side} />
      </div>

      <dl
        className={`mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm ${
          side === "right" ? "sm:justify-end" : ""
        }`}
      >
        <div className="flex items-baseline gap-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-dash-text/65">Record</dt>
          <dd className="tabular-nums font-medium text-dash-text">{team.record}</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-dash-text/65">
            {team.actualTotal != null ? "Score" : "Proj"}
          </dt>
          <dd className="tabular-nums font-semibold text-dash-text">{displayTotal.toFixed(2)}</dd>
        </div>
      </dl>

      {team.yetToPlaySummary ? (
        <p className={`mt-2 text-xs text-dash-text/65 leading-relaxed ${side === "right" ? "sm:text-right" : ""}`}>
          {team.yetToPlaySummary}
        </p>
      ) : null}
    </article>
  );
}
