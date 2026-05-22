import { describe, expect, it } from "vitest";
import { buildDedupeKey } from "@/lib/news-db/store";
import { matchPlayerFromText, normalizeSearchKey } from "@/lib/news-ingest/player-match";
import { normalizeFantasyProsItems, normalizeTrendingRows } from "@/lib/news-ingest/normalize";
import { isSpecificFantasyProsArticleUrl } from "@/lib/news-ingest/resolve-fantasypros-url";
import type { PlayerIndexEntry } from "@/lib/news/types";

const index: Record<string, PlayerIndexEntry> = {
  "4034": {
    sleeperId: "4034",
    name: "Christian McCaffrey",
    team: "SF",
    position: "RB",
    imageUrl: "https://sleepercdn.com/content/nfl/players/4034.jpg",
    searchKeys: [normalizeSearchKey("Christian McCaffrey"), "christianmccaffrey"],
    updatedAt: new Date().toISOString(),
  },
};

describe("buildDedupeKey", () => {
  it("is stable for the same inputs", () => {
    const a = buildDedupeKey(["fantasypros", "title", "2026-05-22", "4034"]);
    const b = buildDedupeKey(["fantasypros", "title", "2026-05-22", "4034"]);
    expect(a).toBe(b);
  });
});

describe("matchPlayerFromText", () => {
  it("matches player name in headline text", () => {
    const hit = matchPlayerFromText("Christian McCaffrey limited in practice", "SF", index);
    expect(hit?.sleeperId).toBe("4034");
  });
});

describe("normalizeFantasyProsItems", () => {
  it("maps fixture headline to sleeper player", () => {
    const { items } = normalizeFantasyProsItems(
      [
        {
          id: 1,
          sport_id: "NFL",
          title: "Christian McCaffrey limited in practice",
          team_id: "SF",
          category: "injury",
          created: "2026-05-22 14:00:00",
          desc: "McCaffrey was a limited participant Thursday.",
        },
      ],
      index,
    );
    expect(items[0]?.sleeperPlayerIds).toContain("4034");
    expect(items[0]?.category).toBe("injury");
    expect(items[0]?.body).toContain("limited");
    expect(items[0]?.url).toMatch(/\/news\/\d+\//);
    expect(isSpecificFantasyProsArticleUrl(items[0]?.url ?? "")).toBe(true);
  });

  it("resolves article URL when API link is generic news.php", () => {
    const { items } = normalizeFantasyProsItems(
      [
        {
          id: 555,
          sport_id: "NFL",
          title: "Player X ruled out",
          team_id: "KC",
          category: "breaking",
          link: "https://www.fantasypros.com/nfl/news.php",
          desc: "Out Sunday.",
        },
      ],
      index,
    );
    expect(items[0]?.url).toBe("https://www.fantasypros.com/nfl/news/555/player-x-ruled-out.php");
  });
});

describe("normalizeTrendingRows", () => {
  it("uses stable hour-bucket ids", () => {
    const rows = normalizeTrendingRows([{ player_id: "4034", count: 12 }], "add", index);
    expect(rows[0]?.id).toMatch(/^sleeper-trend:4034:add:/);
    expect(rows[0]?.kind).toBe("trending_add");
  });
});
