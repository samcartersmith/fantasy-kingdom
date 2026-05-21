"use client";

import { useEffect, useId } from "react";
import { AccountModalShell } from "@/components/account/AccountModalShell";
import { useSleeperConnectContext } from "@/contexts/SleeperConnectContext";
import { useDraftBoardView, type DraftBoardViewMode } from "@/hooks/useDraftBoardView";

const btnPress =
  "cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface";

function ViewOption({
  id,
  name,
  value,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  name: string;
  value: DraftBoardViewMode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (mode: DraftBoardViewMode) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex gap-3 rounded-[var(--dash-radius-sm)] border px-4 py-3 cursor-pointer motion-safe:transition-colors ${
        checked
          ? "border-dash-primary/60 bg-dash-primary/10"
          : "border-dash-border bg-black/20 hover:border-white/20"
      }`}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-1 shrink-0 accent-[var(--dash-primary)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-dash-text">{label}</span>
        <span className="block text-xs text-dash-text/65 mt-0.5">{description}</span>
      </span>
    </label>
  );
}

export function AppearanceModal() {
  const titleId = useId();
  const { appearanceModalOpen, closeAppearanceModal } = useSleeperConnectContext();
  const [boardView, setBoardView] = useDraftBoardView();

  useEffect(() => {
    if (!appearanceModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAppearanceModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [appearanceModalOpen, closeAppearanceModal]);

  return (
    <AccountModalShell
      open={appearanceModalOpen}
      onClose={closeAppearanceModal}
      title="Appearance"
      titleId={titleId}
      description="Preferences are saved on this device."
    >
      <fieldset className="space-y-3 border-0 p-0 m-0">
        <legend className="text-sm font-semibold text-dash-text mb-3">Draft Experts board</legend>
        <ViewOption
          id="board-view-table"
          name="draft-board-view"
          value="table"
          label="Table"
          description="Compact rows with position colors and trade value columns."
          checked={boardView === "table"}
          onChange={setBoardView}
        />
        <ViewOption
          id="board-view-grid"
          name="draft-board-view"
          value="grid"
          label="Grid"
          description="Draft board layout by round and pick slot."
          checked={boardView === "grid"}
          onChange={setBoardView}
        />
      </fieldset>
      <div className="pt-6 flex justify-end">
        <button type="button" className={`${btnPress} min-h-10 px-4 rounded-[var(--dash-radius-sm)] bg-dash-primary text-sm font-semibold text-dash-text hover:bg-dash-primary/90`} onClick={closeAppearanceModal}>
          Done
        </button>
      </div>
    </AccountModalShell>
  );
}
