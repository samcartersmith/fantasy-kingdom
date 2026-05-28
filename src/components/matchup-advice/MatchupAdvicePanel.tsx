"use client";

import type { GuidanceInsight } from "@/lib/roster-guidance";

const toneDot: Record<GuidanceInsight["tone"], string> = {
  neutral: "bg-dash-text/50",
  positive: "bg-dash-primary",
  caution: "bg-dash-warning",
  opportunity: "bg-dash-primary/75",
};

type Props = {
  advice: GuidanceInsight[];
  metaNote: string;
  opponentNote: string | null;
};

export function MatchupAdvicePanel({ advice, metaNote, opponentNote }: Props) {
  return (
    <section
      className="rounded-[var(--dash-radius-md)] border border-dash-border bg-dash-surface-elevated/60 p-4 sm:p-5 space-y-4"
      aria-labelledby="matchup-advice-heading"
    >
      <header className="space-y-1">
        <h3 id="matchup-advice-heading" className="dash-heading-subsection text-dash-text">
          Matchup advice
        </h3>
        <p className="text-xs text-dash-text/65 leading-relaxed">{metaNote}</p>
        {opponentNote ? (
          <p className="text-xs text-dash-warning">{opponentNote}</p>
        ) : null}
      </header>

      {advice.length === 0 ? (
        <p className="text-sm text-dash-text/75">No advice for this week yet.</p>
      ) : (
        <ul className="space-y-4">
          {advice.map((insight) => (
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
    </section>
  );
}
