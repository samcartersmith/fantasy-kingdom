import { effectiveValue, type CatalogAsset } from "@/lib/trade-types";

/** Margin (trade points) below which two sides are treated as “roughly even.” */
export const TRADE_EVEN_MARGIN_POINTS = 200;

/** Above the even margin but below this, we call the trade a “lean” rather than clearly lopsided. */
export const TRADE_CLEARLY_UNEVEN_POINTS = 500;

export function gapPoints(total1: number, total2: number): number {
  return Math.abs(total1 - total2);
}

export function tradeDelta(total1: number, total2: number): number {
  return total1 - total2;
}

export type FairnessTier = "even" | "lean" | "uneven";

export function fairnessTierFromDelta(delta: number): FairnessTier {
  const abs = Math.abs(delta);
  if (abs < TRADE_EVEN_MARGIN_POINTS) return "even";
  if (abs < TRADE_CLEARLY_UNEVEN_POINTS) return "lean";
  return "uneven";
}

/** Same copy as the Comparison card verdict line. */
export function comparisonVerdict(total1: number, total2: number): string {
  const delta = tradeDelta(total1, total2);
  const abs = Math.abs(delta);
  if (total1 === 0 && total2 === 0) {
    return "Add assets to each side to compare totals.";
  }
  if (abs < TRADE_EVEN_MARGIN_POINTS) {
    return "Roughly even — within a small demo margin.";
  }
  if (delta > 0) {
    return `Team 1 is ahead by about ${abs.toLocaleString()} trade points.`;
  }
  return `Team 2 is ahead by about ${abs.toLocaleString()} trade points.`;
}

/** One-line summary for the evaluate modal headline. */
export function tradeEvaluationHeadline(total1: number, total2: number): string {
  const delta = tradeDelta(total1, total2);
  const abs = Math.abs(delta);
  if (abs < TRADE_EVEN_MARGIN_POINTS) {
    return "This trade is roughly even on combined trade points.";
  }
  if (delta > 0) {
    return `Team 1 is ahead by about ${abs.toLocaleString()} trade points.`;
  }
  return `Team 2 is ahead by about ${abs.toLocaleString()} trade points.`;
}

export function fairnessNarrative(tier: FairnessTier, delta: number): string {
  const abs = Math.abs(delta);
  switch (tier) {
    case "even":
      return "Totals are within the same small margin used elsewhere in this calculator, so the sides look broadly fair on points alone.";
    case "lean":
      return `One side leads by ${abs.toLocaleString()} trade points — noticeable, but not extreme. You might still accept it for roster fit or timeline.`;
    case "uneven":
      return `The gap is about ${abs.toLocaleString()} trade points — that is a clearly lopsided package on this model before considering fit or context.`;
  }
}

export type LighterSide = 1 | 2 | null;

/** Which side should add value to balance (null if even). */
export function lighterSide(total1: number, total2: number): LighterSide {
  const delta = tradeDelta(total1, total2);
  if (Math.abs(delta) < TRADE_EVEN_MARGIN_POINTS) return null;
  return delta > 0 ? 2 : 1;
}

export const WHY_UNEVEN_TRADE_BULLETS: readonly string[] = [
  "Positional scarcity or roster construction might matter more than raw totals for your league.",
  "Win-now vs rebuild timelines are not reflected in trade points.",
  "Injury risk, suspensions, and landing spots are only partially captured.",
  "These values are a model, not the market — your leaguemates may disagree.",
];

/**
 * Pick a catalog asset whose effective trade points are closest to `targetGap`
 * (e.g. to suggest a concrete add-on for the lighter side). Excludes ids already on the trade.
 */
export function pickCatalogAssetNearGap(
  catalog: CatalogAsset[],
  excludeIds: ReadonlySet<string>,
  targetGap: number,
  effOpts: { superflex: boolean; leagueFormatApplied?: boolean },
): { asset: CatalogAsset; value: number } | null {
  if (targetGap <= 0 || catalog.length === 0) return null;
  const candidates = catalog.filter((a) => !excludeIds.has(a.id));
  if (candidates.length === 0) return null;
  let best: CatalogAsset | null = null;
  let bestDiff = Infinity;
  for (const a of candidates) {
    const v = effectiveValue(a, effOpts);
    const diff = Math.abs(v - targetGap);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = a;
    }
  }
  if (!best) return null;
  return { asset: best, value: effectiveValue(best, effOpts) };
}

export type BalanceExample = { name: string; value: number };

export function balanceSuggestion(
  lighter: LighterSide,
  gap: number,
  example?: BalanceExample | null,
): string {
  if (lighter === null) return "";
  const pts = gap.toLocaleString();
  const heavier = lighter === 1 ? 2 : 1;
  const margin = TRADE_EVEN_MARGIN_POINTS.toLocaleString();
  if (example) {
    return `To land within about ${margin} trade points of “even,” Team ${lighter} would need to add roughly ${pts} trade points. ${example.name} (${example.value.toLocaleString()} pts). Try adding it on Team ${lighter}, or have Team ${heavier} remove similar value.`;
  }
  return `To land within about ${margin} trade points of “even,” Team ${lighter} would need to add roughly ${pts} trade points of value (for example, a pick or player from the catalog), or Team ${heavier} could remove a piece of similar size.`;
}
