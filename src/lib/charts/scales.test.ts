import { describe, expect, it } from "vitest";
import { buildHorizontalBarScales } from "@/lib/charts/scales";

describe("buildHorizontalBarScales", () => {
  it("returns null for empty rows or zero plot size", () => {
    expect(
      buildHorizontalBarScales({
        rowIds: [],
        values: [],
        plotWidth: 400,
        plotHeight: 200,
      })
    ).toBeNull();
    expect(
      buildHorizontalBarScales({
        rowIds: ["a"],
        values: [10],
        plotWidth: 0,
        plotHeight: 200,
      })
    ).toBeNull();
  });

  it("maps row ids to band positions and values to linear range", () => {
    const scales = buildHorizontalBarScales({
      rowIds: ["a", "b"],
      values: [50, 100],
      plotWidth: 300,
      plotHeight: 80,
    });
    expect(scales).not.toBeNull();
    expect(scales!.maxValue).toBe(100);
    expect(scales!.x(0)).toBe(0);
    expect(scales!.x(100)).toBe(300);
    const ya = scales!.y("a");
    const yb = scales!.y("b");
    expect(ya).toBeDefined();
    expect(yb).toBeDefined();
    expect(yb!).toBeGreaterThan(ya!);
    expect(scales!.y.bandwidth()).toBeGreaterThan(0);
  });

  it("uses minimum domain of 1 when all values are zero", () => {
    const scales = buildHorizontalBarScales({
      rowIds: ["x"],
      values: [0],
      plotWidth: 200,
      plotHeight: 40,
    });
    expect(scales!.maxValue).toBe(1);
    expect(scales!.x(0)).toBe(0);
  });
});
