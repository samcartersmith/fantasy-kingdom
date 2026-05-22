#!/usr/bin/env node
/**
 * Local news ingest (same pipeline as POST /api/cron/news-ingest).
 * Usage: npm run news:ingest
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;

async function main() {
  process.chdir(root.replace(/\/$/, ""));
  const base = process.env.NEWS_INGEST_URL ?? "http://localhost:3000";
  const secret = process.env.CRON_SECRET ?? "";
  const headers = { "Content-Type": "application/json" };
  if (secret) headers.Authorization = `Bearer ${secret}`;

  const res = await fetch(`${base}/api/cron/news-ingest`, { method: "POST", headers });
  const body = await res.json().catch(() => ({}));
  console.log(JSON.stringify(body, null, 2));
  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
