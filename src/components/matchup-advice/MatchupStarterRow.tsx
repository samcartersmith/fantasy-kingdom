"use client";

import { MatchupPlayerTile } from "@/components/matchup-advice/MatchupPlayerTile";
import type { MatchupPairedRow } from "@/lib/matchup-advice/types";

type Props = {
  row: MatchupPairedRow;
};

export function MatchupStarterRow({ row }: Props) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_2.25rem_minmax(0,1fr)] items-stretch gap-1.5 sm:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] sm:gap-3">
      <MatchupPlayerTile player={row.left} side="left" />
      <div className="flex items-center justify-center">
        <span className="inline-flex size-8 items-center justify-center rounded-full border border-white/15 bg-black/40 text-[10px] font-bold uppercase tracking-wide text-dash-text/80">
          {row.slotLabel}
        </span>
      </div>
      <MatchupPlayerTile player={row.right} side="right" />
    </div>
  );
}

type RosterProps = {
  rows: MatchupPairedRow[];
};

export function MatchupRosterGrid({ rows }: RosterProps) {
  const starters = rows.filter((r) => r.section === "starters");
  const bench = rows.filter((r) => r.section === "bench");

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-labelledby="matchup-starters-heading">
        <h3 id="matchup-starters-heading" className="dash-heading-subsection text-dash-text">
          Starters
        </h3>
        <div className="space-y-2">
          {starters.map((row, i) => (
            <MatchupStarterRow key={`starter-${row.slotLabel}-${i}`} row={row} />
          ))}
        </div>
      </section>

      {bench.length > 0 ? (
        <section className="space-y-3" aria-labelledby="matchup-bench-heading">
          <h3 id="matchup-bench-heading" className="dash-heading-subsection text-dash-text">
            Bench
          </h3>
          <div className="space-y-2">
            {bench.map((row, i) => (
              <MatchupStarterRow key={`bench-${i}`} row={row} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
