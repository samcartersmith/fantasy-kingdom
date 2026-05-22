import { describe, expect, it } from "vitest";
import {
  isSpecificFantasyProsArticleUrl,
  resolveFantasyProsArticleUrl,
  repairFantasyProsNewsItemUrl,
} from "@/lib/news-ingest/resolve-fantasypros-url";

describe("isSpecificFantasyProsArticleUrl", () => {
  it("rejects generic news.php index", () => {
    expect(isSpecificFantasyProsArticleUrl("https://www.fantasypros.com/nfl/news.php")).toBe(false);
  });

  it("accepts article paths with numeric id", () => {
    expect(
      isSpecificFantasyProsArticleUrl(
        "https://www.fantasypros.com/nfl/news/124079/starlin-castro-collects-pair-hits-yankees-loss.php",
      ),
    ).toBe(true);
  });
});

describe("resolveFantasyProsArticleUrl", () => {
  it("uses desc anchor when link is generic news.php", () => {
    const url = resolveFantasyProsArticleUrl({
      id: 124079,
      title: "Starlin Castro collects pair of hits",
      sport_id: "NFL",
      link: "https://www.fantasypros.com/nfl/news.php",
      desc: 'Foo<br><a href="https://www.fantasypros.com/nfl/news/124079/starlin-castro-collects-pair-hits-yankees-loss.php" target="_blank">impact</a>',
    });
    expect(url).toBe(
      "https://www.fantasypros.com/nfl/news/124079/starlin-castro-collects-pair-hits-yankees-loss.php",
    );
  });

  it("builds slug URL from id and title when link is missing", () => {
    const url = resolveFantasyProsArticleUrl({
      id: 900001,
      title: "Christian McCaffrey limited in practice",
      sport_id: "NFL",
    });
    expect(url).toBe(
      "https://www.fantasypros.com/nfl/news/900001/christian-mccaffrey-limited-in-practice.php",
    );
  });
});

describe("repairFantasyProsNewsItemUrl", () => {
  it("rebuilds from fpId when stored url is generic", () => {
    expect(
      repairFantasyProsNewsItemUrl({
        source: "fantasypros",
        title: "Christian McCaffrey limited in practice",
        url: "https://www.fantasypros.com/nfl/news.php",
        meta: { fpId: 900001 },
      }),
    ).toBe(
      "https://www.fantasypros.com/nfl/news/900001/christian-mccaffrey-limited-in-practice.php",
    );
  });
});
