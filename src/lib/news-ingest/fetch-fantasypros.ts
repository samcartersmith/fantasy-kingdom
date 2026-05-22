import fantasyProsFixture from "@/data/news/fantasypros-news.fixture.json";
import type { FantasyProsNewsResponse } from "@/lib/news/types";

const FP_NEWS_URL = "https://api.fantasypros.com/v2/json/all/news";

export type FantasyProsFetchResult =
  | { ok: true; data: FantasyProsNewsResponse; fromFixture: boolean }
  | { ok: false; error: string };

export async function fetchFantasyProsNews(
  category?: string | null,
): Promise<FantasyProsFetchResult> {
  const apiKey = process.env.FANTASYPROS_API_KEY?.trim();
  if (!apiKey) {
    return { ok: true, data: fantasyProsFixture as FantasyProsNewsResponse, fromFixture: true };
  }

  const q = new URLSearchParams({ limit: "25" });
  if (category) q.set("category", category);

  try {
    const res = await fetch(`${FP_NEWS_URL}?${q.toString()}`, {
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
        "User-Agent": "FantasyKingdom/1.0 (news-ingest; +https://github.com/fantasy-kingdom)",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `FantasyPros HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as FantasyProsNewsResponse;
    return { ok: true, data, fromFixture: false };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "FantasyPros fetch failed" };
  }
}
