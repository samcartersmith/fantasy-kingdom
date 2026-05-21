"use client";

import { D3HorizontalBarChart } from "@/components/charts/D3HorizontalBarChart";
import type { ChartRow } from "@/lib/charts/types";

export type DashBarChartRow = ChartRow;

type Props = {
  rows: DashBarChartRow[];
  valueFormat?: (n: number) => string;
  maxBars?: number;
  emptyMessage?: string;
};

export function DashBarChart(props: Props) {
  return <D3HorizontalBarChart {...props} />;
}
