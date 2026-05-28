"use client";

import { useMemo, useState } from "react";
import { LeagueIdHint } from "@/components/season-predictions/LeagueIdHint";
import type {
  SeasonPredictionRow,
  SeasonPredictionSortKey,
  SeasonPredictionsPayload,
} from "@/lib/season-predictions/types";

const btnSecondary =
  "cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface inline-flex items-center justify-center min-h-11 px-4 rounded-[var(--dash-radius-sm)] border border-white/15 bg-black/25 text-sm font-medium text-dash-text/90 hover:bg-white/10 hover:border-white/25 hover:text-dash-text";

type Props = {
  data: SeasonPredictionsPayload;
  onChangeConnection: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
};

function sortRows(
  rows: SeasonPredictionRow[],
  key: SeasonPredictionSortKey,
  asc: boolean,
): SeasonPredictionRow[] {
  const sorted = [...rows].sort((a, b) => {
    switch (key) {
      case "teamName":
        return a.teamName.localeCompare(b.teamName);
      case "projectedRecord":
        if (b.projectedWins !== a.projectedWins) return b.projectedWins - a.projectedWins;
        return b.pointsFor - a.pointsFor;
      case "pointsFor":
        return b.pointsFor - a.pointsFor;
      case "pointsAgainst":
        return b.pointsAgainst - a.pointsAgainst;
      case "rank":
      default:
        if (b.projectedWins !== a.projectedWins) return b.projectedWins - a.projectedWins;
        return b.pointsFor - a.pointsFor;
    }
  });
  return asc ? sorted.reverse() : sorted;
}

const thClass =
  "px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-dash-text/60";

export function SeasonPredictionsTable({
  data,
  onChangeConnection,
  onRefresh,
  isRefreshing = false,
}: Props) {
  const [sortKey, setSortKey] = useState<SeasonPredictionSortKey>("rank");
  const [sortAsc, setSortAsc] = useState(false);
  const [showMatchups, setShowMatchups] = useState(false);

  const rows = useMemo(() => sortRows(data.rows, sortKey, sortAsc), [data.rows, sortKey, sortAsc]);

  const matchupsByWeek = useMemo(() => {
    const map = new Map<number, typeof data.matchups>();
    for (const m of data.matchups) {
      const list = map.get(m.week) ?? [];
      list.push(m);
      map.set(m.week, list);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [data]);

  function toggleSort(key: SeasonPredictionSortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h2 className="dash-heading-section text-dash-text truncate">{data.league.name}</h2>
          <p className="text-sm text-dash-text/70">
            {data.meta.leagueContextLabel} · {data.league.season} · Week {data.meta.currentWeek} of{" "}
            {data.meta.regularSeasonWeeks}
          </p>
          <LeagueIdHint leagueId={data.league.league_id} />
          <p className="text-xs text-dash-text/55 leading-relaxed max-w-2xl">{data.meta.valueNote}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button type="button" className={btnSecondary} onClick={onChangeConnection}>
            Change connection
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={isRefreshing}
            aria-busy={isRefreshing}
            onClick={onRefresh}
          >
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[var(--dash-radius-md)] border border-white/10">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="bg-black/30 border-b border-white/10">
            <tr>
              <th className={thClass}>
                <button type="button" className="hover:text-dash-text" onClick={() => toggleSort("rank")}>
                  #
                </button>
              </th>
              <th className={thClass}>
                <button type="button" className="hover:text-dash-text" onClick={() => toggleSort("teamName")}>
                  Team
                </button>
              </th>
              <th className={`${thClass} text-right`}>
                <button
                  type="button"
                  className="hover:text-dash-text ml-auto"
                  onClick={() => toggleSort("projectedRecord")}
                >
                  Proj. record
                </button>
              </th>
              <th className={`${thClass} text-right`}>
                <button
                  type="button"
                  className="hover:text-dash-text ml-auto"
                  onClick={() => toggleSort("pointsFor")}
                >
                  PF
                </button>
              </th>
              <th className={`${thClass} text-right`}>
                <button
                  type="button"
                  className="hover:text-dash-text ml-auto"
                  onClick={() => toggleSort("pointsAgainst")}
                >
                  PA
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.rosterId}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
              >
                <td className="px-3 py-2.5 text-dash-text/55 tabular-nums">{index + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {row.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.avatarUrl}
                        alt=""
                        className="h-8 w-8 rounded-full shrink-0"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <div className="font-medium text-dash-text truncate">{row.teamName}</div>
                      <div className="text-xs text-dash-text/55 truncate">{row.ownerDisplayName}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-dash-text tabular-nums">
                  {row.projectedRecord}
                </td>
                <td className="px-3 py-2.5 text-right text-dash-text/85 tabular-nums">
                  {row.pointsFor.toFixed(1)}
                </td>
                <td className="px-3 py-2.5 text-right text-dash-text/65 tabular-nums">
                  {row.pointsAgainst.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {matchupsByWeek.length > 0 ? (
        <details
          className="rounded-[var(--dash-radius-md)] border border-white/10 bg-black/20 px-4 py-3"
          open={showMatchups}
          onToggle={(e) => setShowMatchups((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer text-sm font-semibold text-dash-text">
            Week-by-week matchups ({data.matchups.length})
          </summary>
          <div className="mt-4 space-y-4">
            {matchupsByWeek.map(([week, games]) => (
              <div key={week}>
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-dash-text/55 mb-2">
                  Week {week}
                </h3>
                <ul className="space-y-1.5 text-sm">
                  {games.map((g) => (
                    <li
                      key={`${g.week}-${g.rosterA}-${g.rosterB}`}
                      className="flex flex-wrap items-baseline gap-x-2 text-dash-text/80"
                    >
                      <span className={g.winnerRosterId === g.rosterA ? "font-semibold text-dash-text" : ""}>
                        {g.teamNameA} {g.scoreA}
                      </span>
                      <span className="text-dash-text/40">vs</span>
                      <span className={g.winnerRosterId === g.rosterB ? "font-semibold text-dash-text" : ""}>
                        {g.teamNameB} {g.scoreB}
                      </span>
                      {g.usedActuals ? (
                        <span className="text-[10px] uppercase tracking-wider text-dash-text/45">actual</span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wider text-dash-text/45">proj</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
