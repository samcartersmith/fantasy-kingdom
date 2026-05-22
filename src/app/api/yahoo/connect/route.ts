import { NextResponse } from "next/server";
import { isYahooOAuthConfigured } from "@/lib/yahoo-ingest/token-store";

export const runtime = "nodejs";

export async function GET() {
  const configured = isYahooOAuthConfigured();
  const clientId = process.env.YAHOO_CLIENT_ID?.trim();
  const redirectUri = process.env.YAHOO_REDIRECT_URI?.trim();

  if (!configured || !clientId || !redirectUri) {
    return NextResponse.json({
      configured: false,
      message:
        "Set YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET, and YAHOO_REDIRECT_URI to enable Yahoo league signals.",
    });
  }

  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "fspt-r",
  });

  return NextResponse.json({
    configured: true,
    authorizeUrl: `https://api.login.yahoo.com/oauth2/request_auth?${q.toString()}`,
  });
}
