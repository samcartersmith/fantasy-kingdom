import { describe, expect, it } from "vitest";
import {
  isSleeperTeamDefenseId,
  rawPositionHintForPlayerId,
  skillPositionsFromProjectionStats,
} from "@/lib/season-predictions/projection-position-inference";

describe("isSleeperTeamDefenseId", () => {
  it("recognizes NFL team abbreviations used as DEF ids", () => {
    expect(isSleeperTeamDefenseId("SF")).toBe(true);
    expect(isSleeperTeamDefenseId("jax")).toBe(true);
    expect(isSleeperTeamDefenseId("8228")).toBe(false);
  });
});

describe("skillPositionsFromProjectionStats", () => {
  it("infers RB from rush-heavy rows without position", () => {
    expect(
      skillPositionsFromProjectionStats({
        player_id: "8151",
        stats: { rush_att: 13.51, rec_tgt: 4.18 },
      }),
    ).toEqual(["RB"]);
  });

  it("infers QB from passing stats", () => {
    expect(
      skillPositionsFromProjectionStats({
        stats: { pass_att: 32, rush_att: 2, rec_tgt: 0 },
      }),
    ).toEqual(["QB", "RB"]);
  });
});

describe("rawPositionHintForPlayerId", () => {
  it("maps team codes to DEF", () => {
    expect(rawPositionHintForPlayerId("SF", null)).toBe("DEF");
    expect(rawPositionHintForPlayerId("9488", "WR")).toBe("WR");
  });
});
