import {
  catalogBySleeperPlayerId,
  createModeledCatalogScoringContext,
  getModeledPlayerCatalog,
} from "@/lib/get-modeled-catalog";
import {
  rawTradeValueToCalculatorDisplay,
  scoreSleeperPlayerRawTradeValue,
  type TradeCalculatorDisplayAnchor,
} from "@/lib/sleeper-map";
import type { LeagueContext } from "@/lib/trade-model/types";
import type { SleeperNflPlayer, SleeperNflPlayersMap } from "@/lib/sleeper-types";

export type DraftPlayerTradeValueResolver = {
  getTradeCalculatorValue(playerId: string, player: SleeperNflPlayer | null): number | null;
};

export async function buildDraftPlayerTradeValueResolver(
  league: LeagueContext,
  playersMap: SleeperNflPlayersMap,
  trendingAdds: Map<string, number>,
): Promise<DraftPlayerTradeValueResolver | null> {
  const catalog = await getModeledPlayerCatalog(league);
  if (!catalog.ok) return null;

  const byId = catalogBySleeperPlayerId(catalog.assets);
  const scoring = createModeledCatalogScoringContext(league);
  const anchor: TradeCalculatorDisplayAnchor = catalog.displayAnchor;

  return {
    getTradeCalculatorValue(playerId: string, player: SleeperNflPlayer | null): number | null {
      const hit = byId.get(playerId);
      if (hit?.kind === "player") return hit.value;

      const raw = player ?? playersMap[playerId];
      if (!raw) return null;

      const rawValue = scoreSleeperPlayerRawTradeValue(
        raw,
        trendingAdds,
        scoring.providers,
        league,
        scoring.fp,
        scoring.nflDraftRoundBySleeperId,
      );
      if (rawValue == null) return null;
      return rawTradeValueToCalculatorDisplay(rawValue, anchor);
    },
  };
}
