import { describe, expect, it } from "vitest";
import type { CatalogAsset } from "@/lib/trade-types";
import {
  TEAM_SIDEBAR_SEARCH_MIN_PLAYER_VALUE,
  filterTradeCatalogSuggestions,
} from "@/lib/trade-catalog-filter";

const eff = { superflex: false, leagueFormatApplied: true };

function player(id: string, name: string, value: number): CatalogAsset {
  return {
    id,
    kind: "player",
    name,
    position: "WR",
    team: "CIN",
    value,
  };
}

describe("filterTradeCatalogSuggestions", () => {
  it("sorts non-empty query matches by effective trade value (high first)", () => {
    const catalog: CatalogAsset[] = [
      player("1", "Chase Low", 400),
      player("2", "Ja'Marr Chase", 9800),
      player("3", "Chase Mid", 5000),
    ];
    const out = filterTradeCatalogSuggestions(catalog, "chase", eff, { includeEmptyQueryDefaults: false });
    expect(out.map((a) => a.id)).toEqual(["2", "3", "1"]);
  });

  it("drops low-value players when minPlayerEffectiveValue is set (sidebar)", () => {
    const catalog: CatalogAsset[] = [
      player("1", "Chase Low", 400),
      player("2", "Ja'Marr Chase", 9800),
      player("3", "Chase Edge", 1499),
      player("4", "Chase Floor", 1500),
    ];
    const out = filterTradeCatalogSuggestions(catalog, "chase", eff, {
      includeEmptyQueryDefaults: false,
      minPlayerEffectiveValue: TEAM_SIDEBAR_SEARCH_MIN_PLAYER_VALUE,
    });
    expect(out.map((a) => a.id)).toEqual(["2", "4"]);
  });

  it("does not filter by min value when option omitted (main catalog search)", () => {
    const catalog: CatalogAsset[] = [player("1", "Chase Low", 400), player("2", "Ja'Marr Chase", 9800)];
    const out = filterTradeCatalogSuggestions(catalog, "chase", eff, { includeEmptyQueryDefaults: false });
    expect(out).toHaveLength(2);
  });
});
