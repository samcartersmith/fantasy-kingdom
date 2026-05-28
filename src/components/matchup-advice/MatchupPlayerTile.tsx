"use client";

import { PlayerHeadshot } from "@/components/trade/PlayerHeadshot";
import type { MatchupPlayerTile } from "@/lib/matchup-advice/types";

type Props = {
  player: MatchupPlayerTile | null;
  side: "left" | "right";
};

export function MatchupPlayerTile({ player, side }: Props) {
  if (!player) {
    return (
      <div
        className={`min-h-[4.5rem] flex-1 rounded-[var(--dash-radius-sm)] border border-dashed border-white/10 bg-black/15 px-3 py-2.5 ${
          side === "right" ? "text-right" : ""
        }`}
        aria-hidden
      />
    );
  }

  const scoreDisplay =
    player.actualPoints != null
      ? player.actualPoints.toFixed(2)
      : player.projectedPoints != null
        ? player.projectedPoints.toFixed(2)
        : "—";

  const scoreLabel = player.actualPoints != null ? "Actual" : "Proj";

  return (
    <article
      className={`min-h-[4.5rem] flex-1 rounded-[var(--dash-radius-sm)] border border-dash-border/80 bg-black/30 px-3 py-2.5 ${
        side === "right" ? "text-right" : ""
      }`}
    >
      <div
        className={`flex items-start gap-2.5 ${side === "right" ? "flex-row-reverse" : ""}`}
      >
        <PlayerHeadshot
          imageUrl={player.headshotUrl}
          name={player.name}
          className="size-9 rounded-full"
        />
        <div className={`min-w-0 flex-1 space-y-0.5 ${side === "right" ? "text-right" : ""}`}>
          <div
            className={`flex items-center gap-1.5 ${side === "right" ? "justify-end" : ""}`}
          >
            <p className="text-sm font-semibold text-dash-text truncate">{player.shortName}</p>
            {player.injuryBadge ? (
              <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-bold uppercase bg-dash-warning/25 text-dash-warning">
                {player.injuryBadge}
              </span>
            ) : null}
          </div>
          {player.gameLabel ? (
            <p className="text-xs text-dash-text/70 truncate">{player.gameLabel}</p>
          ) : null}
          <p className="text-[11px] text-dash-text/55">{player.statusLabel}</p>
        </div>
        <div className={`shrink-0 text-right ${side === "left" ? "pl-1" : "pr-1"}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-dash-text/55">
            {scoreLabel}
          </p>
          <p className="text-sm tabular-nums font-semibold text-dash-text">{scoreDisplay}</p>
        </div>
      </div>
    </article>
  );
}
