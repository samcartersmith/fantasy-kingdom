import { NextRequest, NextResponse } from "next/server";
import { runNewsIngest } from "@/lib/news-ingest/run-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV === "development";
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const header = req.headers.get("x-cron-secret");
  return header === secret;
}

export async function POST(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runNewsIngest();
    return NextResponse.json({
      ok: result.ok,
      runId: result.runId,
      stats: result.stats,
      errors: result.errors,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ingest failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
