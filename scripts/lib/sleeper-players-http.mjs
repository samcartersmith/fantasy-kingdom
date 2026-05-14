import https from "node:https";

export function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: "application/json" } }, (res) => {
        let body = "";
        res.on("data", (c) => {
          body += c;
        });
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`GET ${url} -> ${res.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

const SKILL_ORDER = ["QB", "RB", "WR", "TE"];
const SKILL = new Set(SKILL_ORDER);

export function primarySkillPosition(raw) {
  const fromFantasy = (raw.fantasy_positions ?? []).map((p) => String(p).trim().toUpperCase());
  for (const want of SKILL_ORDER) {
    if (fromFantasy.includes(want)) return want;
  }
  const base = String(raw.position ?? "")
    .trim()
    .toUpperCase();
  if (SKILL.has(base)) return base;
  return null;
}

/** Normalize Sleeper gsis_id (often has leading spaces) to match nflverse player_id. */
export function normalizeGsis(gsis) {
  if (gsis == null) return null;
  const s = String(gsis).trim().replace(/\s+/g, "");
  if (!s || s === "null" || s === "undefined") return null;
  return s;
}

/**
 * @returns {{ byGsis: Map<string, { sleeperId: string, pos: string, raw: object }>, stats: object }}
 */
export function buildSleeperGsisSkillIndex(playersMap) {
  const byGsis = new Map();
  for (const [key, raw] of Object.entries(playersMap)) {
    if (!raw || raw.sport !== "nfl") continue;
    const sleeperId = String(raw.player_id ?? key);
    const pos = primarySkillPosition(raw);
    if (!pos) continue;
    const gsis = normalizeGsis(raw.gsis_id);
    if (!gsis) continue;
    byGsis.set(gsis, { sleeperId, pos, raw });
  }
  return { byGsis };
}
