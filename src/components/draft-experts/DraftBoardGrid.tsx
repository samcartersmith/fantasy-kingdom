"use client";

import { useMemo, useState } from "react";
import { draftPositionCellClass } from "@/components/draft-experts/draft-position-theme";
import { DraftSlotTradePill } from "@/components/draft-experts/DraftSlotTradePill";
import { formatVsSlotRatio, vsSlotRatioMeetsBar } from "@/components/draft-experts/format-vs-slot";
import { PlayerHeadshot } from "@/components/trade/PlayerHeadshot";
import { boardSkipLabel, type DraftBoardPickRow } from "@/lib/draft-experts-build";
import {
  buildDraftBoardMatrix,
  formatDraftSlotForPick,
  isGradedBoardPick,
  type DraftSlotColumnHeader,
} from "@/lib/draft-board-slot";

const COL_MIN = "11.5rem";

type Props = {
  boardPicks: DraftBoardPickRow[];
  teamsInDraft: number;
  slotHeaders: DraftSlotColumnHeader[];
  managers?: Record<string, { roster_id: number; name: string; avatarUrl?: string }>;
  highlightRosterId?: number | null;
};

function ManagerAvatar({ name, url }: { name: string; url?: string }) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Sleeper CDN
      <img
        src={url}
        alt=""
        className="h-9 w-9 rounded-full object-cover border border-white/15 shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/40 text-xs font-semibold text-dash-text"
      aria-hidden
    >
      {initial}
    </span>
  );
}

function columnHasRoster(
  col: DraftSlotColumnHeader,
  cellsInColumn: (DraftBoardPickRow | null)[],
  rosterId: number,
): boolean {
  if (col.roster_id === rosterId) return true;
  return cellsInColumn.some((c) => c?.roster_id === rosterId);
}

export function DraftBoardGrid({
  boardPicks,
  teamsInDraft,
  slotHeaders,
  managers,
  highlightRosterId,
}: Props) {
  const matrix = useMemo(
    () => buildDraftBoardMatrix(boardPicks, teamsInDraft, managers, slotHeaders),
    [boardPicks, teamsInDraft, managers, slotHeaders],
  );

  if (boardPicks.length === 0) {
    return (
      <p className="text-sm text-dash-text/75 leading-relaxed">
        No picks recorded for this draft year.
      </p>
    );
  }

  const { columns, cells } = matrix;
  const colCount = matrix.leagueSize;
  const rowCount = cells.length;
  const skippedCount = boardPicks.filter((p) => p.status === "skipped").length;

  const gridStyle = {
    gridTemplateColumns: `repeat(${colCount}, minmax(${COL_MIN}, 1fr))`,
    gridTemplateRows: `auto repeat(${rowCount}, minmax(7.75rem, auto))`,
    minWidth: `calc(${colCount} * ${COL_MIN})`,
  } as const;

  return (
    <div className="space-y-2">
      {skippedCount > 0 ? (
        <p className="text-xs text-dash-text/60 leading-relaxed">
          Muted dashed cells could not be graded (often missing from the Sleeper player cache).
          → pills mark picks traded to the team that drafted the player.
        </p>
      ) : null}
      <div className="dash-scrollbar overflow-x-auto overscroll-contain -mx-1 px-1 pb-1">
        <div className="grid gap-2 w-full" style={gridStyle}>
          {columns.map((col, colIdx) => {
            const colCells = cells.map((row) => row[colIdx] ?? null);
            const highlighted =
              highlightRosterId != null && columnHasRoster(col, colCells, highlightRosterId);
            const muted = highlightRosterId != null && !highlighted;

            return (
              <div
                key={`header-slot-${col.draft_slot}`}
                className={`flex flex-col items-center justify-end gap-1.5 px-2 pb-2 min-h-[3.25rem] rounded-[var(--dash-radius-sm)] ${
                  highlighted ? "ring-2 ring-dash-primary/70 bg-dash-primary/10" : ""
                } ${muted ? "opacity-70" : ""}`}
              >
                <ManagerAvatar name={col.managerName} url={col.avatarUrl} />
                <span className="text-[11px] font-medium text-dash-text text-center line-clamp-2 leading-snug w-full">
                  {col.managerName}
                </span>
              </div>
            );
          })}

          {cells.map((row, rowIdx) =>
            row.map((cell, colIdx) => {
              const col = columns[colIdx]!;
              const colCells = cells.map((r) => r[colIdx] ?? null);
              const highlighted =
                highlightRosterId != null && columnHasRoster(col, colCells, highlightRosterId);
              const muted = highlightRosterId != null && !highlighted;

              if (!cell) {
                return (
                  <div
                    key={`empty-${rowIdx}-${colIdx}`}
                    className={`min-h-[7.75rem] rounded-[var(--dash-radius-sm)] border border-dashed border-white/8 bg-black/15 ${
                      highlighted ? "ring-2 ring-dash-primary/40" : ""
                    } ${muted ? "opacity-70" : ""}`}
                    aria-hidden
                  />
                );
              }

              const slotLabel = formatDraftSlotForPick(cell, teamsInDraft);
              const showTradePill = cell.isSlotTrade && cell.tradedToName;

              if (!isGradedBoardPick(cell)) {
                return (
                  <div
                    key={`skip-${cell.pick_no}-${colIdx}`}
                    className={`min-h-[7.75rem] rounded-[var(--dash-radius-sm)] border border-dashed border-white/20 bg-black/30 p-2 flex flex-col overflow-hidden ${
                      highlighted ? "ring-2 ring-dash-primary/40" : ""
                    } ${muted ? "opacity-70" : ""}`}
                    title={`Overall pick ${cell.pick_no}`}
                  >
                    <div className="flex items-start justify-between gap-1.5 shrink-0">
                      <div className="min-w-0 flex-1">
                        {cell.playerName ? (
                          <p className="text-xs font-medium text-dash-text/80 line-clamp-2 leading-snug">
                            {cell.playerName}
                          </p>
                        ) : (
                          <p className="text-xs font-medium text-dash-text/55">Pick not graded</p>
                        )}
                        <p className="text-[10px] text-dash-text/55 mt-0.5 leading-snug">
                          {boardSkipLabel(cell.skipReason)}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] font-bold tabular-nums text-dash-text/70">
                        {slotLabel}
                      </span>
                    </div>
                    {showTradePill ? (
                      <div className="mt-1.5 shrink-0">
                        <DraftSlotTradePill tradedToName={cell.tradedToName!} className="max-w-full" />
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <div
                  key={`${cell.pick_no}-${cell.playerId}`}
                  className={`min-h-[7.75rem] rounded-[var(--dash-radius-sm)] border p-2 flex flex-col overflow-hidden motion-safe:transition motion-safe:duration-150 motion-safe:hover:-translate-y-0.5 motion-safe:hover:border-white/25 ${draftPositionCellClass(cell.position)} ${
                    highlighted ? "ring-2 ring-dash-primary/60" : ""
                  } ${muted ? "opacity-70" : ""}`}
                  title={`Overall pick ${cell.pick_no}`}
                >
                  <div className="flex items-start justify-between gap-1.5 shrink-0 min-w-0">
                    <p className="text-xs font-semibold text-dash-text leading-snug line-clamp-2 min-w-0 flex-1">
                      {cell.playerName}
                    </p>
                    <span className="shrink-0 text-[11px] font-bold tabular-nums text-dash-text/90 leading-none">
                      {slotLabel}
                    </span>
                  </div>
                  <p className="text-[10px] text-dash-text/75 mt-0.5 leading-tight shrink-0">
                    {cell.position} - {cell.team}
                  </p>
                  {showTradePill ? (
                    <div className="mt-1.5 shrink-0 max-w-full">
                      <DraftSlotTradePill tradedToName={cell.tradedToName!} className="max-w-full" />
                    </div>
                  ) : null}
                  <div className="flex-1 min-h-1" />
                  <div className="flex items-end justify-between gap-1.5 shrink-0 mt-auto pt-1 min-w-0">
                    <span
                      className={`text-[10px] font-semibold tabular-nums shrink-0 ${
                        vsSlotRatioMeetsBar(cell.vsSlotRatio)
                          ? "text-dash-primary"
                          : "text-dash-text/70"
                      }`}
                    >
                      {formatVsSlotRatio(cell.vsSlotRatio)}
                    </span>
                    <div className="size-9 shrink-0 overflow-hidden rounded-full border border-white/20 bg-black/40">
                      <PlayerHeadshot
                        imageUrl={cell.imageUrl}
                        name={cell.playerName}
                        className="!size-9 !min-w-9 !max-w-9 !rounded-full"
                      />
                    </div>
                  </div>
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
