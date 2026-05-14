/**
 * Map Sleeper skill players to nflverse GSIS when Sleeper `gsis_id` is null/missing.
 * Uses nflverse `players.csv` (display_name + latest_team + position) ↔ Sleeper
 * (`search_full_name` or normalized first+last + team + primary skill position).
 * All fantasy points still come from nflverse reg-season stats keyed by GSIS.
 */
import { normalizeGsis, primarySkillPosition } from "./sleeper-players-http.mjs";

const SKILL = new Set(["QB", "RB", "WR", "TE"]);

/**
 * Mirrors Sleeper `search_full_name` when present; otherwise first+last stripped alnum.
 * @param {object} raw Sleeper players/nfl row
 */
export function sleeperSearchFullNormalized(raw) {
  const s = raw.search_full_name;
  if (typeof s === "string" && s.trim()) return s.trim().toLowerCase();
  const f = String(raw.first_name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const l = String(raw.last_name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `${f}${l}`;
}

/**
 * @param {object[]} rows nflverse `players.csv` parsed rows
 * @returns {Map<string, string>} key `${searchFull}|${TEAM}|${POS}` → gsis_id
 */
export function buildSearchKeyToGsisFromNflversePlayersRows(rows) {
  const m = new Map();
  for (const r of rows) {
    const pos = String(r.position ?? "").trim().toUpperCase();
    if (!SKILL.has(pos)) continue;
    const gsis = String(r.gsis_id ?? "").trim();
    if (!gsis) continue;
    const team = String(r.latest_team ?? "").trim().toUpperCase();
    if (!team) continue;
    const dn = String(r.display_name ?? "").trim();
    const sf = dn.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!sf) continue;
    const key = `${sf}|${team}|${pos}`;
    if (!m.has(key)) m.set(key, gsis);
  }
  return m;
}

/**
 * @param {object} raw Sleeper players/nfl row
 * @param {Map<string, string>} playersCsvKeyToGsis from {@link buildSearchKeyToGsisFromNflversePlayersRows}
 */
export function resolveGsisForSleeperSkillPlayer(raw, playersCsvKeyToGsis) {
  const direct = normalizeGsis(raw.gsis_id);
  if (direct) return direct;
  const pos = primarySkillPosition(raw);
  if (!pos) return null;
  const team = String(raw.team ?? "").trim().toUpperCase();
  if (!team) return null;
  const sf = sleeperSearchFullNormalized(raw);
  if (!sf) return null;
  return playersCsvKeyToGsis.get(`${sf}|${team}|${pos}`) ?? null;
}
