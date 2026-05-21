"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { buildHorizontalBarScales } from "@/lib/charts/scales";
import { readDashChartTheme } from "@/lib/charts/theme";
import type { ChartRow, ValueFormatter } from "@/lib/charts/types";
import { useChartSize } from "@/hooks/useChartSize";
import { ChartContainer } from "@/components/charts/ChartContainer";

const LABEL_COL = 168;
const VALUE_COL = 64;
const MARGIN_X = 8;
const ROW_BASE = 36;
const ROW_WITH_SUB = 48;
const BAR_H = 8;
const MIN_BAR_PX = 4;

type Props = {
  rows: ChartRow[];
  valueFormat?: ValueFormatter;
  maxBars?: number;
  emptyMessage?: string;
};

function defaultFormat(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function buildAriaSummary(rows: ChartRow[], format: ValueFormatter): string {
  if (rows.length === 0) return "No chart data";
  const top = rows[0];
  return `Bar chart, ${rows.length} entries. Leader: ${top.label}, ${format(top.value)}.`;
}

export function D3HorizontalBarChart({
  rows,
  valueFormat = defaultFormat,
  maxBars = 12,
  emptyMessage = "No data for this chart yet.",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, ready } = useChartSize(containerRef);
  const [theme, setTheme] = useState(() => readDashChartTheme());

  useEffect(() => {
    setTheme(readDashChartTheme(containerRef.current));
  }, [ready, width]);

  const slice = useMemo(() => rows.slice(0, maxBars), [rows, maxBars]);

  const layout = useMemo(() => {
    const hasSublabel = slice.some((r) => r.sublabel);
    const rowH = hasSublabel ? ROW_WITH_SUB : ROW_BASE;
    const height = slice.length * rowH + MARGIN_X * 2;
    const plotLeft = LABEL_COL + MARGIN_X;
    const plotWidth = Math.max(0, width - plotLeft - VALUE_COL - MARGIN_X);
    const plotHeight = slice.length * rowH;
    return { rowH, height, plotLeft, plotWidth, plotHeight };
  }, [slice, width]);

  const scales = useMemo(() => {
    if (!ready || slice.length === 0) return null;
    return buildHorizontalBarScales({
      rowIds: slice.map((r) => r.id),
      values: slice.map((r) => r.value),
      plotWidth: layout.plotWidth,
      plotHeight: layout.plotHeight,
    });
  }, [ready, slice, layout.plotWidth, layout.plotHeight]);

  if (slice.length === 0) {
    return <p className="text-sm text-dash-text/75 leading-relaxed">{emptyMessage}</p>;
  }

  const ariaLabel = buildAriaSummary(slice, valueFormat);

  return (
    <ChartContainer
      containerRef={containerRef}
      ariaLabel={ariaLabel}
      minHeight={layout.height}
    >
      {ready && scales ? (
        <>
          <svg
            width={width}
            height={layout.height}
            className="block max-w-full overflow-visible"
            aria-hidden
          >
            {slice.map((row, index) => {
              const y0 = scales.y(row.id);
              if (y0 == null) return null;
              const band = scales.y.bandwidth();
              const barY = y0 + (band - BAR_H) / 2;
              const rawW = scales.x(row.value);
              const barW = Math.max(MIN_BAR_PX, rawW);
              const labelY = y0 + 14;
              const subY = y0 + 30;
              const valueY = y0 + 14;

              return (
                <g key={row.id}>
                  <text
                    x={MARGIN_X}
                    y={labelY}
                    fill={theme.text}
                    fontSize={14}
                    fontFamily={theme.fontFamily}
                    fontWeight={500}
                  >
                    <tspan fill={theme.textMuted} fontWeight={400}>
                      {index + 1}.{" "}
                    </tspan>
                    {row.label.length > 22 ? `${row.label.slice(0, 21)}…` : row.label}
                  </text>
                  <text
                    x={width - VALUE_COL}
                    y={valueY}
                    fill={theme.text}
                    fontSize={14}
                    fontFamily={theme.fontFamily}
                    fontWeight={600}
                    textAnchor="start"
                  >
                    {valueFormat(row.value)}
                  </text>
                  <rect
                    x={layout.plotLeft}
                    y={barY}
                    width={layout.plotWidth}
                    height={BAR_H}
                    rx={4}
                    fill={theme.barTrack}
                  />
                  <rect
                    x={layout.plotLeft}
                    y={barY}
                    width={barW}
                    height={BAR_H}
                    rx={4}
                    fill={theme.primary}
                    fillOpacity={0.85}
                  />
                  {row.sublabel ? (
                    <text
                      x={MARGIN_X}
                      y={subY}
                      fill={theme.textMuted}
                      fontSize={12}
                      fontFamily={theme.fontFamily}
                    >
                      {row.sublabel.length > 40
                        ? `${row.sublabel.slice(0, 39)}…`
                        : row.sublabel}
                    </text>
                  ) : null}
                  <title>
                    {row.label}: {valueFormat(row.value)}
                    {row.sublabel ? ` — ${row.sublabel}` : ""}
                  </title>
                </g>
              );
            })}
          </svg>
          <table className="sr-only">
            <caption>{ariaLabel}</caption>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Name</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row, i) => (
                <tr key={row.id}>
                  <td>{i + 1}</td>
                  <td>{row.label}</td>
                  <td>{valueFormat(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <div
          className="animate-pulse rounded-[var(--dash-radius-sm)] bg-white/6"
          style={{ height: layout.height }}
          aria-hidden
        />
      )}
    </ChartContainer>
  );
}
