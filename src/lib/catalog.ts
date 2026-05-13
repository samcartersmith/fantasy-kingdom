import picksData from "@/data/players-picks.json";
import type { CatalogAsset } from "@/lib/trade-types";
import { scorePick } from "@/lib/trade-model/score-pick";
import { tryParsePickId } from "@/lib/trade-model/pick-parse";
import type { TradeModelProviders } from "@/lib/trade-model/types";

/** Local draft pick rows (Sleeper does not ship dynasty pick “players” in `players/nfl`). */
export function getLocalPickAssets(): CatalogAsset[] {
  return picksData.assets.filter((a): a is CatalogAsset => a.kind === "pick");
}

/** Re-score picks using the fair-trade pick model (anchor + class strength + time discount). */
export function applyPickFairTradeModel(picks: CatalogAsset[], providers: TradeModelProviders): CatalogAsset[] {
  return picks.map((p) => {
    const parsed = tryParsePickId(p.id);
    if (!parsed) {
      return p;
    }
    const scored = scorePick(
      {
        year: parsed.year,
        round: parsed.round,
        bucket: parsed.bucket,
        anchorValue: p.value,
      },
      providers,
    );
    return {
      ...p,
      value: scored.value,
      evaluation: { confidence01: scored.confidence01, components: scored.components },
    };
  });
}
