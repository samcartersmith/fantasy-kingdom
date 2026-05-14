/**
 * nflverse release URLs for regular-season player stat summaries.
 * @see https://github.com/nflverse/nflverse-data/releases (stats_player)
 */
export function nflversePlayerRegStatsUrl(season, fileType = "csv") {
  return `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_${season}.${fileType}`;
}
