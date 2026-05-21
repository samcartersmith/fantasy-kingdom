"use client";

import { useMemo, useState } from "react";
import { DashBarChart } from "@/components/league-data-wizard/charts/DashBarChart";
import { DraftBoardTable } from "@/components/draft-experts/DraftBoardTable";
import { StealBustList } from "@/components/draft-experts/StealBustList";
import type { DraftExpertsPayload } from "@/lib/draft-experts-build";

const btnSecondary =
  "cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface inline-flex items-center justify-center min-h-11 px-4 rounded-[var(--dash-radius-sm)] border border-white/15 bg-black/25 text-sm font-medium text-dash-text/90 hover:bg-white/10 hover:border-white/25 hover:text-dash-text";

const selectClass =
  "w-full min-h-11 rounded-[var(--dash-radius-sm)] border border-dash-border bg-black/35 px-3 py-2 text-sm text-dash-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface";

type Props = {
  data: DraftExpertsPayload;
  onChangeConnection: () => void;
};

export function DraftExpertsExplorer({ data, onChangeConnection }: Props) {
  const seasons = useMemo(
    () => [...data.drafts].sort((a, b) => Number(b.season) - Number(a.season)).map((d) => d.season),
    [data.drafts],
  );

  const [selectedSeason, setSelectedSeason] = useState(seasons[0] ?? "");

  const seasonPicks = data.bySeason[selectedSeason]?.picks ?? [];

  const hasDrafts = data.drafts.length > 0;

  return (
    <div className="w-full min-w-0 space-y-8 lg:space-y-10">
      <div
        className="sticky top-[4.25rem] z-20 rounded-[var(--dash-radius-md)] border border-dash-border bg-dash-surface-elevated/95 px-4 py-4 backdrop-blur-md sm:px-5"
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
          <button type="button" className={`${btnSecondary} shrink-0`} onClick={onChangeConnection}>
            Change connection
          </button>
        </div>
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
        <>
          {(data.overview.bestDrafter || data.overview.worstDrafter) && (
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
          )}

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

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1">
                <h3 className="dash-heading-subsection text-dash-text">Draft board</h3>
                <p className="text-sm text-dash-text/75">Pick order for the selected year.</p>
              </div>
              <div className="w-full sm:w-48">
                <label htmlFor="draft-year-select" className="sr-only">
                  Draft year
                </label>
                <select
                  id="draft-year-select"
                  className={selectClass}
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                >
                  {seasons.map((s) => (
                    <option key={s} value={s}>
                      {s} season
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DraftBoardTable picks={seasonPicks} />
          </section>

          <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
            <StealBustList
              title="Steals"
              variant="steal"
              rows={data.steals}
              emptyMessage="No big positive surprises yet in this sample."
            />
            <StealBustList
              title="Busts"
              variant="bust"
              rows={data.busts}
              emptyMessage="No early-round misses flagged in this sample."
            />
          </div>
        </>
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
