import { NextRequest, NextResponse } from "next/server";
import { upsertYahooTokens } from "@/lib/yahoo-ingest/token-store";

export const runtime = "nodejs";

/**
 * OAuth callback stub: exchange `code` for tokens via Yahoo token endpoint in production.
 * For now, stores a placeholder token row when code is present so ingest can demo user-scoped items.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const userId = req.nextUrl.searchParams.get("state") ?? "yahoo-user";

  if (!code) {
    return NextResponse.redirect(new URL("/news-room?yahoo=error", req.url));
  }

  upsertYahooTokens({
    userId,
    accessToken: "pending-exchange",
    refreshToken: "pending-exchange",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    leagueIds: ["demo-league"],
  });

  return NextResponse.redirect(new URL("/news-room?yahoo=connected", req.url));
}
