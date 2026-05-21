"use client";

import { useMemo, useState } from "react";
import { WizardOptionList, type WizardOption } from "@/components/leagues/WizardOptionList";
import {
  CHART_CATALOG,
  firstAvailableChartId,
  type ChartId,
} from "@/components/league-data-wizard/chart-catalog";
import { LeagueHistoryChartPanel } from "@/components/league-data-wizard/LeagueHistoryChartPanel";
import type { LeagueHistoryPayload } from "@/lib/league-history-build";

const btnSecondary =
  "cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface inline-flex items-center justify-center min-h-11 px-4 rounded-[var(--dash-radius-sm)] border border-white/15 bg-black/25 text-sm font-medium text-dash-text/90 hover:bg-white/10 hover:border-white/25 hover:text-dash-text";

type Props = {
  data: LeagueHistoryPayload;
  onChangeConnection: () => void;
};

export function LeagueHistoryExplorer({ data, onChangeConnection }: Props) {
  const availableCharts = useMemo(
    () => CHART_CATALOG.filter((c) => c.available(data)),
    [data],
  );

  const [selectedChartId, setSelectedChartId] = useState<ChartId>(() =>
    firstAvailableChartId(data),
  );

  const chartOptions: WizardOption[] = useMemo(
    () =>
      availableCharts.map((c) => ({
        value: c.id,
        label: c.title,
        hint: c.teaser,
      })),
    [availableCharts],
  );

  const activeDef =
    CHART_CATALOG.find((c) => c.id === selectedChartId) ?? availableCharts[0];

  const seasonRange =
    data.league.seasons.length > 0
      ? `${data.league.seasons[data.league.seasons.length - 1]?.season}–${data.league.seasons[0]?.season}`
      : data.league.currentSeason;

  return (
    <div className="w-full min-w-0 space-y-6 lg:space-y-8">
      <div
        className="sticky top-[4.25rem] z-20 rounded-[var(--dash-radius-md)] border border-dash-border bg-dash-surface-elevated/95 px-4 py-4 backdrop-blur-md sm:px-5"
        aria-label="League history session"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h2 className="dash-heading-subsection text-dash-text truncate">{data.league.name}</h2>
            <p className="text-sm text-dash-text/75">
              {data.meta.seasonsScanned} season{data.meta.seasonsScanned === 1 ? "" : "s"}
              {seasonRange ? ` · ${seasonRange}` : null}
            </p>
          </div>
          <button type="button" className={`${btnSecondary} shrink-0`} onClick={onChangeConnection}>
            Change connection
          </button>
        </div>
      </div>

      {availableCharts.length === 0 ? (
        <div className="rounded-[var(--dash-radius-md)] border border-dash-border bg-black/25 px-5 py-8 text-center space-y-2">
          <p className="dash-heading-subsection text-dash-text">No chartable history yet</p>
          <p className="text-sm text-dash-text/75 max-w-md mx-auto leading-relaxed">
            This league chain does not have enough completed matchups or brackets yet. Try again
            after more regular seasons are in the books.
          </p>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,16rem)_1fr] lg:gap-10 lg:items-start">
          <div className="lg:sticky lg:top-[9.5rem]">
            <p className="text-xs font-semibold uppercase tracking-wide text-dash-text/65 mb-3">
              Pick a story
            </p>
            <WizardOptionList
              id="chart-picker"
              label="Chart"
              value={selectedChartId}
              options={chartOptions}
              onChange={(v) => setSelectedChartId(v as ChartId)}
            />
          </div>

          <div className="min-w-0 space-y-4 rounded-[var(--dash-radius-md)] border border-dash-border bg-black/20 px-4 py-5 sm:px-6 sm:py-6">
            {activeDef ? (
              <>
                <header className="space-y-2">
                  <h3 className="dash-heading-subsection text-dash-text">{activeDef.title}</h3>
                  <p className="text-sm text-dash-text/75 leading-relaxed max-w-prose">
                    {activeDef.description}
                  </p>
                </header>
                <LeagueHistoryChartPanel chartId={activeDef.id} data={data} />
              </>
            ) : null}
          </div>
        </div>
      )}

      <footer className="text-xs text-dash-text/55 leading-relaxed max-w-2xl border-t border-white/10 pt-6">
        {data.meta.dataNote}{" "}
        <a
          href="https://docs.sleeper.com"
          className="text-dash-primary hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Sleeper API
        </a>
        , read-only. Cached on the server for about ten minutes.
      </footer>
    </div>
  );
}
