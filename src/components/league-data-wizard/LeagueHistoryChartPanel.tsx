"use client";

import { DashBarChart } from "@/components/league-data-wizard/charts/DashBarChart";
import type { ChartId } from "@/components/league-data-wizard/chart-catalog";
import type { LeagueHistoryPayload } from "@/lib/league-history-build";

type Props = {
  chartId: ChartId;
  data: LeagueHistoryPayload;
};

export function LeagueHistoryChartPanel({ chartId, data }: Props) {
  const { charts } = data;

  switch (chartId) {
    case "championships":
      return (
        <DashBarChart
          rows={charts.championships.map((r) => ({
            id: String(r.roster_id),
            label: r.name,
            value: r.count,
            sublabel: r.seasons.join(", "),
          }))}
          valueFormat={(n) => `${n} title${n === 1 ? "" : "s"}`}
        />
      );
    case "regularSeasonWins":
      return (
        <DashBarChart
          rows={charts.regularSeasonWins.map((r) => ({
            id: String(r.roster_id),
            label: r.name,
            value: r.wins,
            sublabel:
              r.ties > 0 ? `${r.losses} L · ${r.ties} T` : `${r.losses} L`,
          }))}
          valueFormat={(n) => `${n} W`}
        />
      );
    case "allTimePoints":
      return (
        <DashBarChart
          rows={charts.allTimePoints.map((r) => ({
            id: String(r.roster_id),
            label: r.name,
            value: r.points,
          }))}
          valueFormat={(n) => n.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        />
      );
    case "nuclearWeeks":
      return (
        <ul className="space-y-3" role="list">
          {charts.nuclearWeeks.map((row, i) => (
            <li
              key={`${row.season}-${row.week}-${row.roster_id}`}
              className="flex items-center justify-between gap-4 rounded-[var(--dash-radius-sm)] border border-white/10 bg-black/25 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-dash-text truncate">
                  <span className="tabular-nums text-dash-text/55 mr-2">{i + 1}.</span>
                  {row.name}
                </p>
                <p className="text-xs text-dash-text/60 mt-0.5">
                  {row.season} · Week {row.week}
                </p>
              </div>
              <span className="tabular-nums text-lg font-semibold text-dash-primary shrink-0">
                {row.points.toFixed(1)}
              </span>
            </li>
          ))}
        </ul>
      );
    case "playoffAppearances":
      return (
        <DashBarChart
          rows={charts.playoffAppearances.map((r) => ({
            id: String(r.roster_id),
            label: r.name,
            value: r.count,
            sublabel: `${r.count} season${r.count === 1 ? "" : "s"} in bracket`,
          }))}
          valueFormat={(n) => String(n)}
        />
      );
    case "firstRoundPicks":
      return (
        <DashBarChart
          rows={charts.firstRoundPicks.map((r) => ({
            id: String(r.roster_id),
            label: r.name,
            value: r.count,
          }))}
          valueFormat={(n) => `${n} pick${n === 1 ? "" : "s"}`}
        />
      );
    default:
      return null;
  }
}
