"use client";

export type DashBarChartRow = {
  id: string;
  label: string;
  value: number;
  sublabel?: string;
};

type Props = {
  rows: DashBarChartRow[];
  valueFormat?: (n: number) => string;
  maxBars?: number;
  emptyMessage?: string;
};

function defaultFormat(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function DashBarChart({
  rows,
  valueFormat = defaultFormat,
  maxBars = 12,
  emptyMessage = "No data for this chart yet.",
}: Props) {
  const slice = rows.slice(0, maxBars);
  const maxVal = slice.length > 0 ? Math.max(...slice.map((r) => r.value), 1) : 1;

  if (slice.length === 0) {
    return (
      <p className="text-sm text-dash-text/75 leading-relaxed">{emptyMessage}</p>
    );
  }

  return (
    <ul className="space-y-3" role="list">
      {slice.map((row, index) => {
        const pct = Math.max(4, (row.value / maxVal) * 100);
        return (
          <li key={row.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-dash-text">
                <span className="tabular-nums text-dash-text/55 mr-2">{index + 1}.</span>
                {row.label}
              </span>
              <span className="shrink-0 tabular-nums font-semibold text-dash-text">
                {valueFormat(row.value)}
              </span>
            </div>
            <div
              className="h-2 rounded-[var(--dash-radius-sm)] bg-white/8 overflow-hidden"
              role="presentation"
            >
              <div
                className="h-full rounded-[var(--dash-radius-sm)] bg-dash-primary/85 motion-safe:transition-[width] motion-safe:duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
            {row.sublabel ? (
              <p className="text-xs text-dash-text/60 truncate">{row.sublabel}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
