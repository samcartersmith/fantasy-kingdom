"use client";

import { formatVsSlotRatio } from "@/components/draft-experts/format-vs-slot";
import type { StealBustRow } from "@/lib/draft-experts-aggregate";

type Props = {
  title: string;
  rows: StealBustRow[];
  emptyMessage: string;
  variant: "steal" | "bust";
};

export function StealBustList({ title, rows, emptyMessage, variant }: Props) {
  return (
    <section className="space-y-3">
      <h3 className="dash-heading-subsection text-dash-text">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-dash-text/75 leading-relaxed">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2" role="list">
          {rows.map((row) => (
            <li
              key={`${row.season}-${row.pick_no}-${row.playerId}`}
              className="rounded-[var(--dash-radius-sm)] border border-white/10 bg-black/25 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-dash-text truncate">{row.playerName}</p>
                  <p className="text-xs text-dash-text/60 mt-0.5">
                    {row.season} · Pick {row.pick_no} · {row.managerName} · {row.position} ·{" "}
                    {row.slotPoints.toLocaleString()} pick pts
                  </p>
                </div>
                <span
                  className={`shrink-0 tabular-nums text-sm font-semibold ${
                    variant === "steal" ? "text-dash-primary" : "text-dash-text/80"
                  }`}
                >
                  {formatVsSlotRatio(row.vsSlotRatio)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
