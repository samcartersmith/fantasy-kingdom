import curatedSnapshotJson from "@/data/trade-model/curated-snapshot.json";
import fantasyProfileJson from "@/data/trade-model/player-fantasy-profile.json";
import draftRoundJson from "@/data/trade-model/player-nfl-draft-round.json";
import { applyPickFairTradeModel, getLocalPickAssets } from "@/lib/catalog";
import { fetchSleeperNflPlayersMap, fetchSleeperTrendingAdds } from "@/lib/sleeper-fetch";
import { sleeperPlayersMapToCatalogModeled, type TradeCalculatorDisplayAnchor } from "@/lib/sleeper-map";
import { buildFpAnchors, buildRichStatAnchors } from "@/lib/trade-model/fp-baseline";
import type { FantasyProfilePayload } from "@/lib/trade-model/fp-baseline";
import { createCuratedProviders } from "@/lib/trade-model/providers";
import { buildTradeSpinePrecompute } from "@/lib/trade-model/trade-spine";
import type { CatalogAsset } from "@/lib/trade-types";
import type { CuratedTradeSnapshot, LeagueContext } from "@/lib/trade-model/types";
import { computeVbdComputation } from "@/lib/trade-model/vbd";

const curatedSnapshot = curatedSnapshotJson as CuratedTradeSnapshot;
const fantasyProfilePayload = fantasyProfileJson as FantasyProfilePayload;
const nflDraftRoundBySleeperId = draftRoundJson as Record<string, number>;

export type ModeledCatalogBundle = {
  assets: CatalogAsset[];
  displayAnchor: TradeCalculatorDisplayAnchor;
};

export function createModeledCatalogScoringContext(league: LeagueContext) {
  const providers = createCuratedProviders(curatedSnapshot);
  const anchors = buildFpAnchors(fantasyProfilePayload.profiles, league.ppr);
  const richAnchors = buildRichStatAnchors(fantasyProfilePayload.profiles, league.ppr);
  const vbd = computeVbdComputation(fantasyProfilePayload.profiles, league.ppr, league);
  const tradeSpine = buildTradeSpinePrecompute(
    fantasyProfilePayload.profiles,
    league.ppr,
    vbd.bySleeperId,
    richAnchors,
    anchors,
  );
  const fp = {
    snapshotAsOf: fantasyProfilePayload.snapshotAsOf,
    profiles: fantasyProfilePayload.profiles,
    anchors,
    richAnchors,
    vbdBySleeperId: vbd.bySleeperId,
    vbdScale: vbd.scale,
    tradeSpine,
  };
  return { providers, fp, nflDraftRoundBySleeperId };
}

export async function getModeledPlayerCatalog(
  league: LeagueContext,
): Promise<{ ok: true; assets: CatalogAsset[]; displayAnchor: TradeCalculatorDisplayAnchor } | { ok: false; error: string }> {
  const [playersResult, trendingAdds] = await Promise.all([
    fetchSleeperNflPlayersMap(),
    fetchSleeperTrendingAdds(120, 72),
  ]);

  if (!playersResult.ok) {
    return { ok: false, error: `Sleeper players API returned ${playersResult.status}` };
  }

  const { providers, fp, nflDraftRoundBySleeperId } = createModeledCatalogScoringContext(league);

  const { assets: players, displayAnchor } = sleeperPlayersMapToCatalogModeled(
    playersResult.data,
    trendingAdds,
    providers,
    league,
    fp,
    nflDraftRoundBySleeperId,
  );
  const picks = applyPickFairTradeModel(getLocalPickAssets(), providers);

  return { ok: true, assets: [...picks, ...players], displayAnchor };
}

export function catalogBySleeperPlayerId(assets: CatalogAsset[]): Map<string, CatalogAsset> {
  const m = new Map<string, CatalogAsset>();
  for (const a of assets) {
    if (a.kind === "player" && a.sleeperPlayerId) {
      m.set(a.sleeperPlayerId, a);
    }
  }
  return m;
}
