"use client";

import type { DraftExpertsPickRow } from "@/lib/draft-experts-build";

type Props = {
  picks: DraftExpertsPickRow[];
};

function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toLocaleString()}`;
}

export function DraftBoardTable({ picks }: Props) {
  if (picks.length === 0) {
    return (
      <p className="text-sm text-dash-text/75 leading-relaxed">
        No graded picks for this draft year.
      </p>
    );
  }

  return (
    <div className="dash-scrollbar overflow-x-auto overscroll-contain -mx-1 px-1">
      <table className="w-full min-w-[40rem] text-sm border-collapse">
        <thead>
          <tr className="border-b border-white/15 text-left">
            <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wide text-dash-text/65">
              Pick
            </th>
            <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wide text-dash-text/65">
              Rd
            </th>
            <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wide text-dash-text/65">
              Manager
            </th>
            <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wide text-dash-text/65">
              Player
            </th>
            <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wide text-dash-text/65">
              Pos
            </th>
            <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wide text-dash-text/65 text-right">
              Value
            </th>
            <th className="py-2 font-semibold text-xs uppercase tracking-wide text-dash-text/65 text-right">
              vs slot
            </th>
          </tr>
        </thead>
        <tbody>
          {picks.map((row) => (
            <tr
              key={`${row.pick_no}-${row.playerId}`}
              className="border-b border-white/8 hover:bg-white/[0.04]"
            >
              <td className="py-2.5 pr-3 tabular-nums text-dash-text">{row.pick_no}</td>
              <td className="py-2.5 pr-3 tabular-nums text-dash-text/80">{row.round}</td>
              <td className="py-2.5 pr-3 text-dash-text max-w-[8rem] truncate">{row.managerName}</td>
              <td className="py-2.5 pr-3 font-medium text-dash-text max-w-[10rem] truncate">
                {row.playerName}
              </td>
              <td className="py-2.5 pr-3 text-dash-text/75">{row.position}</td>
              <td className="py-2.5 pr-3 tabular-nums text-dash-text text-right">
                {row.currentValue.toLocaleString()}
              </td>
              <td className="py-2.5 tabular-nums text-right font-medium text-dash-text">
                <span className={row.delta >= 0 ? "text-dash-primary" : "text-dash-text/75"}>
                  {formatDelta(row.delta)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
