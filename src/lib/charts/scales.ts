import { max } from "d3-array";
import { scaleBand, scaleLinear } from "d3-scale";

export type HorizontalBarScaleInput = {
  rowIds: string[];
  values: number[];
  plotWidth: number;
  plotHeight: number;
};

export type HorizontalBarScales = {
  x: ReturnType<typeof scaleLinear<number, number>>;
  y: ReturnType<typeof scaleBand<string>>;
  maxValue: number;
};

export function buildHorizontalBarScales(
  input: HorizontalBarScaleInput
): HorizontalBarScales | null {
  if (input.rowIds.length === 0 || input.plotWidth <= 0 || input.plotHeight <= 0) {
    return null;
  }

  const maxValue = Math.max(1, max(input.values) ?? 1);
  const y = scaleBand<string>()
    .domain(input.rowIds)
    .range([0, input.plotHeight])
    .padding(0.28);
  const x = scaleLinear<number, number>().domain([0, maxValue]).range([0, input.plotWidth]);

  return { x, y, maxValue };
}
