"use client";

import { useMemo, useState } from "react";
import { DashBarChart } from "@/components/league-data-wizard/charts/DashBarChart";
import { DraftBoardGrid } from "@/components/draft-experts/DraftBoardGrid";
import { DraftBoardTable } from "@/components/draft-experts/DraftBoardTable";
import { DraftBoardToolbar } from "@/components/draft-experts/DraftBoardToolbar";
import { StealBustList } from "@/components/draft-experts/StealBustList";
import { useDraftBoardView } from "@/hooks/useDraftBoardView";
import type { DraftExpertsPayload } from "@/lib/draft-experts-build";
import {
  filterStealBustByRoster,
  sortedManagers,
  teamSummary,
} from "@/lib/draft-experts-team";

const btnSecondary =
  "cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface inline-flex items-center justify-center min-h-11 px-4 rounded-[var(--dash-radius-sm)] border border-white/15 bg-black/25 text-sm font-medium text-dash-text/90 hover:bg-white/10 hover:border-white/25 hover:text-dash-text";

const tabClass = (active: boolean) =>
  `min-h-11 px-4 rounded-[var(--dash-radius-sm)] text-sm font-medium border cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface ${
    active
      ? "bg-dash-primary text-dash-text border-dash-primary"
      : "bg-black/25 text-dash-text/85 border-white/15 hover:bg-white/5"
  }`;

const selectClass =
  "w-full min-h-11 rounded-[var(--dash-radius-sm)] border border-dash-border bg-black/35 px-3 py-2 text-sm text-dash-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface";

type Scope = "league" | "team";

type Props = {
  data: DraftExpertsPayload;
  onChangeConnection: () => void;
  onRefreshAnalysis: () => void;
  isRefreshing?: boolean;
};

export function DraftExpertsExplorer({
  data,
  onChangeConnection,
  onRefreshAnalysis,
  isRefreshing = false,
}: Props) {
  const seasons = useMemo(
    () => [...data.drafts].sort((a, b) => Number(b.season) - Number(a.season)).map((d) => d.season),
    [data.drafts],
  );

  const managerList = useMemo(() => sortedManagers(data.managers), [data.managers]);

  const [selectedSeason, setSelectedSeason] = useState(seasons[0] ?? "");
  const [scope, setScope] = useState<Scope>("league");
  const [selectedRosterId, setSelectedRosterId] = useState<number>(
    () => data.overview.bestDrafter?.roster_id ?? managerList[0]?.roster_id ?? 0,
  );
  const [boardView, setBoardView] = useDraftBoardView();

  const seasonData = data.bySeason[selectedSeason];
  const seasonPicks = seasonData?.picks ?? [];
  const boardPicks =
    seasonData?.boardPicks ??
    seasonPicks.map((p) => ({
      status: "graded" as const,
      ...p,
      isTradedOrProxy: p.isTradedOrProxy ?? false,
      isSlotTrade: p.isSlotTrade ?? false,
    }));
  const teamsInDraft = seasonData?.teams ?? data.meta.leagueSize;
  const slotHeaders = seasonData?.slotHeaders ?? [];
  const hasDrafts = data.drafts.length > 0;
  const highlightRosterId = scope === "team" ? selectedRosterId : null;

  const teamSteals = useMemo(
    () => filterStealBustByRoster(data.steals, selectedRosterId),
    [data.steals, selectedRosterId],
  );
  const teamBusts = useMemo(
    () => filterStealBustByRoster(data.busts, selectedRosterId),
    [data.busts, selectedRosterId],
  );

  const allTeamPicks = useMemo(() => {
    const out = [];
    for (const season of seasons) {
      for (const p of data.bySeason[season]?.picks ?? []) {
        if (p.roster_id === selectedRosterId) out.push(p);
      }
    }
    return out;
  }, [data.bySeason, seasons, selectedRosterId]);

  const teamStats = useMemo(
    () => teamSummary(allTeamPicks, selectedRosterId, data.overview.effectiveness),
    [allTeamPicks, selectedRosterId, data.overview.effectiveness],
  );

  const selectedManagerName =
    data.managers[String(selectedRosterId)]?.name ??
    managerList.find((m) => m.roster_id === selectedRosterId)?.name ??
    "Team";

  return (
    <div className="w-full min-w-0 space-y-8 lg:space-y-10">
      <div
        className="sticky top-[4.25rem] z-20 rounded-[var(--dash-radius-md)] border border-dash-border bg-dash-surface-elevated/95 px-4 py-4 backdrop-blur-md sm:px-5 space-y-4"
        aria-label="Draft session"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h2 className="dash-heading-subsection text-dash-text truncate">{data.league.name}</h2>
            <p className="text-sm text-dash-text/75">
              {hasDrafts
                ? `${data.drafts.length} annual draft${data.drafts.length === 1 ? "" : "s"} graded`
                : "No annual drafts found after excluding startup"}
              {data.excludedDrafts.length > 0
                ? ` · ${data.excludedDrafts.length} startup draft${data.excludedDrafts.length === 1 ? "" : "s"} skipped`
                : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              className={`${btnSecondary} disabled:opacity-50 disabled:cursor-not-allowed`}
              onClick={onRefreshAnalysis}
              disabled={isRefreshing}
              aria-busy={isRefreshing}
            >
              {isRefreshing ? "Refreshing…" : "Refresh analysis"}
            </button>
            <button type="button" className={btnSecondary} onClick={onChangeConnection}>
              Change connection
            </button>
          </div>
        </div>

        {hasDrafts ? (
          <div role="tablist" aria-label="Draft experts scope" className="flex flex-wrap gap-2">
            <button
              type="button"
              role="tab"
              aria-selected={scope === "league"}
              className={tabClass(scope === "league")}
              onClick={() => setScope("league")}
            >
              League
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === "team"}
              className={tabClass(scope === "team")}
              onClick={() => setScope("team")}
            >
              Team
            </button>
          </div>
        ) : null}
      </div>

      {!hasDrafts ? (
        <div className="rounded-[var(--dash-radius-md)] border border-dash-border bg-black/25 px-5 py-8 text-center space-y-2">
          <p className="dash-heading-subsection text-dash-text">No annual drafts to grade</p>
          <p className="text-sm text-dash-text/75 max-w-md mx-auto leading-relaxed">
            Every draft in this chain looked like a startup (many rounds). We only score shorter annual
            rookie drafts so results match in-season draft day.
          </p>
        </div>
      ) : (
        <div
          key={scope}
          className="space-y-8 lg:space-y-10 motion-safe:transition-opacity motion-safe:duration-150"
        >
          {scope === "team" ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="w-full sm:max-w-xs">
                <label htmlFor="draft-team-select" className="block text-xs font-semibold uppercase tracking-wide text-dash-text/65 mb-1.5">
                  Team
                </label>
                <select
                  id="draft-team-select"
                  className={selectClass}
                  value={selectedRosterId}
                  onChange={(e) => setSelectedRosterId(Number(e.target.value))}
                >
                  {managerList.map((m) => (
                    <option key={m.roster_id} value={m.roster_id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div
                className="rounded-[var(--dash-radius-sm)] border border-white/10 bg-black/25 px-4 py-3 flex flex-wrap gap-4 sm:gap-6"
                aria-live="polite"
              >
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-dash-text/55">Avg vs slot</p>
                  <p className="text-lg font-semibold tabular-nums text-dash-text">
                    {Math.round(teamStats.avgVsSlotRatio * 100)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-dash-text/55">Picks graded</p>
                  <p className="text-lg font-semibold tabular-nums text-dash-text">{teamStats.pickCount}</p>
                </div>
                {teamStats.rank != null ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-dash-text/55">League rank</p>
                    <p className="text-lg font-semibold tabular-nums text-dash-text">
                      #{teamStats.rank}
                      <span className="text-sm font-normal text-dash-text/60">
                        {" "}
                        of {teamStats.totalManagers}
                      </span>
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {scope === "league" && (data.overview.bestDrafter || data.overview.worstDrafter) ? (
            <p className="text-sm text-dash-text/75 leading-relaxed max-w-2xl">
              {data.overview.bestDrafter ? (
                <>
                  <span className="font-medium text-dash-text">{data.overview.bestDrafter.name}</span>{" "}
                  leads on average vs draft slot
                  {data.overview.bestDrafter.avgVsSlotRatio > 1
                    ? ` (${Math.round(data.overview.bestDrafter.avgVsSlotRatio * 100)}%)`
                    : null}
                </>
              ) : null}
              {data.overview.bestDrafter && data.overview.worstDrafter ? "; " : null}
              {data.overview.worstDrafter &&
              data.overview.worstDrafter.roster_id !== data.overview.bestDrafter?.roster_id ? (
                <>
                  <span className="font-medium text-dash-text">{data.overview.worstDrafter.name}</span>{" "}
                  has the lowest average ({Math.round(data.overview.worstDrafter.avgVsSlotRatio * 100)}% of slot).
                </>
              ) : null}
            </p>
          ) : null}

          {scope === "league" ? (
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
              <div className="space-y-3">
                <h3 className="dash-heading-subsection text-dash-text">Draft effectiveness</h3>
                <p className="text-xs text-dash-text/60 leading-relaxed">
                  Average player value vs slot points (annual drafts only, min 3 picks).
                </p>
                <DashBarChart
                  rows={data.overview.effectiveness.map((r) => ({
                    id: String(r.roster_id),
                    label: r.name,
                    value: r.avgVsSlotRatio,
                    sublabel: `${r.pickCount} picks`,
                  }))}
                  valueFormat={(n) => `${Math.round(n * 100)}%`}
                  emptyMessage="Need more picks to rank managers."
                />
              </div>
              <div className="space-y-3">
                <h3 className="dash-heading-subsection text-dash-text">Most picks</h3>
                <p className="text-xs text-dash-text/60 leading-relaxed">
                  Total selections across included drafts.
                </p>
                <DashBarChart
                  rows={data.overview.mostPicks.map((r) => ({
                    id: String(r.roster_id),
                    label: r.name,
                    value: r.pickCount,
                  }))}
                  valueFormat={(n) => `${n} picks`}
                />
              </div>
            </div>
          ) : null}

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1">
                <h3 className="dash-heading-subsection text-dash-text">Draft board</h3>
                <p className="text-sm text-dash-text/75">
                  {scope === "team"
                    ? `${selectedManagerName} · pick order for the selected year`
                    : "Pick order for the selected year."}
                </p>
              </div>
              <DraftBoardToolbar
                seasons={seasons}
                selectedSeason={selectedSeason}
                onSeasonChange={setSelectedSeason}
                viewMode={boardView}
                onViewModeChange={setBoardView}
              />
            </div>
            {boardView === "grid" ? (
              <DraftBoardGrid
                boardPicks={boardPicks}
                teamsInDraft={teamsInDraft}
                slotHeaders={slotHeaders}
                managers={data.managers}
                highlightRosterId={highlightRosterId}
              />
            ) : (
              <DraftBoardTable picks={seasonPicks} leagueSize={data.meta.leagueSize} />
            )}
          </section>

          <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
            <StealBustList
              title="Steals"
              variant="steal"
              rows={scope === "team" ? teamSteals : data.steals}
              emptyMessage={
                scope === "team"
                  ? `No steals for ${selectedManagerName} in this sample.`
                  : "No value beats after pick 6 in this sample."
              }
            />
            <StealBustList
              title="Busts"
              variant="bust"
              rows={scope === "team" ? teamBusts : data.busts}
              emptyMessage={
                scope === "team"
                  ? `No busts for ${selectedManagerName} in this sample.`
                  : "No early-round (pick 24 or earlier) misses flagged in this sample."
              }
            />
          </div>
        </div>
      )}

      <footer className="text-xs text-dash-text/55 leading-relaxed max-w-2xl border-t border-white/10 pt-6">
        {data.meta.dataNote}
        {data.meta.playersUnmatched > 0
          ? ` ${data.meta.playersUnmatched} pick(s) skipped (player not in Sleeper cache).`
          : null}{" "}
        <a
          href="https://docs.sleeper.com"
          className="text-dash-primary hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Sleeper API
        </a>
        , read-only.
      </footer>
    </div>
  );
}
