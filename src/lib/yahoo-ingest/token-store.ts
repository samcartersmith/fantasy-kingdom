import fs from "fs";
import path from "path";
import type { YahooStoredTokens, YahooTokensFile } from "@/lib/yahoo-ingest/types";

function tokensPath(): string {
  const base = process.env.NEWS_STORE_DIR?.trim()
    ? path.isAbsolute(process.env.NEWS_STORE_DIR)
      ? process.env.NEWS_STORE_DIR
      : path.join(process.cwd(), process.env.NEWS_STORE_DIR)
    : path.join(process.cwd(), ".data", "news");
  return path.join(base, "yahoo-tokens.json");
}

export function readYahooTokens(): YahooStoredTokens[] {
  const file = tokensPath();
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as YahooTokensFile;
    return Array.isArray(raw.users) ? raw.users : [];
  } catch {
    return [];
  }
}

export function writeYahooTokens(users: YahooStoredTokens[]): void {
  const file = tokensPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload: YahooTokensFile = { users };
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function upsertYahooTokens(entry: YahooStoredTokens): void {
  const users = readYahooTokens().filter((u) => u.userId !== entry.userId);
  users.push(entry);
  writeYahooTokens(users);
}

export function isYahooOAuthConfigured(): boolean {
  return Boolean(
    process.env.YAHOO_CLIENT_ID?.trim() &&
      process.env.YAHOO_CLIENT_SECRET?.trim() &&
      process.env.YAHOO_REDIRECT_URI?.trim(),
  );
}
