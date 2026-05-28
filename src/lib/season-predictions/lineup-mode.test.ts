import { describe, expect, it } from "vitest";
import {
  methodologyVersionForMode,
  parseLineupMode,
} from "@/lib/season-predictions/lineup-mode";

describe("parseLineupMode", () => {
  it("defaults to pragmatic", () => {
    expect(parseLineupMode(null)).toBe("pragmatic");
    expect(parseLineupMode("")).toBe("pragmatic");
  });

  it("accepts optimal", () => {
    expect(parseLineupMode("optimal")).toBe("optimal");
    expect(parseLineupMode("OPTIMAL")).toBe("optimal");
  });
});

describe("methodologyVersionForMode", () => {
  it("maps modes to methodology ids", () => {
    expect(methodologyVersionForMode("pragmatic")).toBe("sp-v3-sleeper-pragmatic");
    expect(methodologyVersionForMode("optimal")).toBe("sp-v3-sleeper-optimal");
  });
});
