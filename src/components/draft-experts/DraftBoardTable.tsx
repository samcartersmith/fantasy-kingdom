"use client";

import { DraftSlotTradePill } from "@/components/draft-experts/DraftSlotTradePill";
import { formatVsSlotRatio, vsSlotRatioMeetsBar } from "@/components/draft-experts/format-vs-slot";
import { PickTradeBadge } from "@/components/draft-experts/PickTradeBadge";
import type { DraftExpertsPickRow } from "@/lib/draft-experts-build";
import { formatDraftSlotForPick } from "@/lib/draft-board-slot";

type Props = {
  picks: DraftExpertsPickRow[];
  leagueSize: number;
};

export function DraftBoardTable({ picks, leagueSize }: Props) {
  if (picks.length === 0) {
    return (
      <p className="text-sm text-dash-text/75 leading-relaxed">
        No graded picks for this draft year.
      </p>
    );
  }

  return (
    <div className="dash-scrollbar overflow-x-auto overscroll-contain -mx-1 px-1">
      <table className="w-full min-w-[44rem] text-sm border-collapse">
        <thead>
          <tr className="border-b border-white/15 text-left">
            <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wide text-dash-text/65">
              Slot
            </th>
            <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wide text-dash-text/65">
              Manager
            </th>
            <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wide text-dash-text/65">
              Player
            </th>
            <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wide text-dash-text/65">
              Pos
            </th>
            <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wide text-dash-text/65 text-right">
              Pick pts
            </th>
            <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wide text-dash-text/65 text-right">
              Trade pts
            </th>
            <th className="py-2 font-semibold text-xs uppercase tracking-wide text-dash-text/65 text-right">
              vs slot
            </th>
          </tr>
        </thead>
        <tbody>
          {picks.map((row) => {
            const showSlotTrade =
              row.isSlotTrade &&
              row.tradedToName &&
              row.slotOwnerName &&
              row.tradedToName !== row.slotOwnerName;

            return (
              <tr
                key={`${row.pick_no}-${row.playerId}`}
                className="border-b border-white/8 hover:bg-white/[0.04]"
              >
                <td
                  className="py-2.5 pr-3 tabular-nums font-medium text-dash-text"
                  title={`Overall pick ${row.pick_no}`}
                >
                  {formatDraftSlotForPick(row, leagueSize)}
                </td>
                <td className="py-2.5 pr-3 text-dash-text max-w-[10rem]">
                  <span className="block truncate">
                    {showSlotTrade ? row.slotOwnerName : row.managerName}
                  </span>
                  {showSlotTrade ? (
                    <DraftSlotTradePill tradedToName={row.tradedToName!} className="mt-1" />
                  ) : (
                    <PickTradeBadge
                      isTradedOrProxy={row.isTradedOrProxy ?? false}
                      pickedByName={row.pickedByName}
                      className="mt-1"
                    />
                  )}
                </td>
                <td className="py-2.5 pr-3 font-medium text-dash-text max-w-[10rem] truncate">
                  {row.playerName}
                </td>
                <td className="py-2.5 pr-3 text-dash-text/75">{row.position}</td>
                <td className="py-2.5 pr-3 tabular-nums text-dash-text/80 text-right">
                  {row.slotPoints.toLocaleString()}
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-dash-text text-right">
                  {row.currentValue.toLocaleString()}
                </td>
                <td className="py-2.5 tabular-nums text-right font-medium">
                  <span
                    className={
                      vsSlotRatioMeetsBar(row.vsSlotRatio) ? "text-dash-primary" : "text-dash-text/75"
                    }
                  >
                    {formatVsSlotRatio(row.vsSlotRatio)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
