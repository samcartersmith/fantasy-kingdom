import fs from "fs";
import path from "path";

type FsCacheMeta = { written_at: string };

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function cacheDir(): string {
  const override = process.env.PROJECTION_CACHE_DIR?.trim();
  if (override) return path.isAbsolute(override) ? override : path.join(process.cwd(), override);
  return "/tmp/sp-projections";
}

function rowsPath(season: string, week: number): string {
  return path.join(cacheDir(), season, `${week}.json`);
}

function metaPath(season: string, week: number): string {
  return path.join(cacheDir(), season, `${week}.meta.json`);
}

export function readProjectionRowsFromFs(
  season: string,
  week: number,
): Record<string, unknown>[] | null {
  if (process.env.NODE_ENV === "test") return null;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath(season, week), "utf8")) as FsCacheMeta;
    if (Date.now() - new Date(meta.written_at).getTime() > CACHE_TTL_MS) return null;
    return JSON.parse(fs.readFileSync(rowsPath(season, week), "utf8")) as Record<string, unknown>[];
  } catch {
    return null;
  }
}

export function writeProjectionRowsToFs(
  season: string,
  week: number,
  rows: Record<string, unknown>[],
): void {
  if (process.env.NODE_ENV === "test") return;
  try {
    const dir = path.join(cacheDir(), season);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(rowsPath(season, week), JSON.stringify(rows), "utf8");
    fs.writeFileSync(
      metaPath(season, week),
      JSON.stringify({ written_at: new Date().toISOString() }),
      "utf8",
    );
  } catch {
    // fs errors must never break the API
  }
}
