import { NextRequest, NextResponse } from "next/server";
import { fetchSleeperUser } from "@/lib/sleeper-league-fetch";

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username")?.trim();
  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  const result = await fetchSleeperUser(username);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.status === 404 ? "Sleeper user not found" : "Sleeper API error", details: result.body.slice(0, 300) },
      { status: result.status === 404 ? 404 : 502 },
    );
  }

  return NextResponse.json({
    user: {
      user_id: result.data.user_id,
      username: result.data.username,
      display_name: result.data.display_name,
    },
  });
}
