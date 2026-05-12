import picksData from "@/data/players-picks.json";
import type { CatalogAsset } from "@/lib/trade-types";

/** Local draft pick rows (Sleeper does not ship dynasty pick “players” in `players/nfl`). */
export function getLocalPickAssets(): CatalogAsset[] {
  return picksData.assets.filter((a): a is CatalogAsset => a.kind === "pick");
}
