import { describe, expect, it } from "vitest";
import { itemHasReadableDetail } from "@/lib/news/feed-detail";
import type { NewsItem } from "@/lib/news/types";

const base: NewsItem = {
  id: "test",
  dedupeKey: "x",
  source: "fantasypros",
  kind: "headline",
  category: "injury",
  title: "Test",
  publishedAt: new Date().toISOString(),
  sleeperPlayerIds: [],
  players: [],
  scope: "public",
};

describe("itemHasReadableDetail", () => {
  it("returns true when body is present", () => {
    expect(itemHasReadableDetail({ ...base, body: "Full story text." })).toBe(true);
  });

  it("returns true when external url exists", () => {
    expect(itemHasReadableDetail({ ...base, url: "https://example.com/a" })).toBe(true);
  });
});
