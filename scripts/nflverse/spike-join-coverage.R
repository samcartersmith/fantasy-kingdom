#!/usr/bin/env Rscript
#' Optional cross-check: join coverage using nflreadr (same idea as node scripts/nflverse-join-coverage-spike.mjs).
#' Requires: install.packages(c("nflreadr", "jsonlite"))
suppressPackageStartupMessages({
  if (!requireNamespace("nflreadr", quietly = TRUE)) stop("Install nflreadr: install.packages('nflreadr')")
  if (!requireNamespace("jsonlite", quietly = TRUE)) stop("Install jsonlite: install.packages('jsonlite')")
})

players <- jsonlite::fromJSON("https://api.sleeper.app/v1/players/nfl", simplifyVector = FALSE)
skill <- c("QB", "RB", "WR", "TE")
is_skill <- function(p) {
  fp <- character()
  if (!is.null(p$fantasy_positions) && length(p$fantasy_positions) > 0) {
    fp <- vapply(p$fantasy_positions, function(x) toupper(as.character(x)), "")
  }
  pos <- toupper(as.character(if (is.null(p$position)) "" else p$position))
  any(fp %in% skill) || pos %in% skill
}
norm_gsis <- function(x) {
  if (is.null(x)) return(NA_character_)
  s <- trimws(as.character(x))
  if (!nzchar(s)) return(NA_character_)
  gsub("\\s+", "", s)
}

sleep_gsis <- character()
for (nm in names(players)) {
  p <- players[[nm]]
  if (is.null(p$sport) || p$sport != "nfl") next
  if (!is_skill(p)) next
  g <- norm_gsis(p$gsis_id)
  if (!is.na(g)) sleep_gsis <- c(sleep_gsis, g)
}
sleep_gsis <- unique(sleep_gsis)

rows <- nflreadr::load_player_stats(seasons = c(2023L, 2024L, 2025L), summary_level = "reg", file_type = "csv")
rows <- rows[toupper(rows$position) %in% skill & toupper(rows$season_type) == "REG", ]
nfl_ids <- unique(rows$player_id)

matched <- sum(sleep_gsis %in% nfl_ids)
cat(jsonlite::toJSON(list(
  source = "R nflreadr::load_player_stats reg + Sleeper players/nfl",
  sleeper_skill_unique_gsis = length(sleep_gsis),
  nflverse_skill_unique_player_id = length(nfl_ids),
  sleeper_gsis_matched_in_nflverse = matched,
  match_rate = round(matched / length(sleep_gsis), 4)
), auto_unbox = TRUE, pretty = TRUE))
cat("\n")
