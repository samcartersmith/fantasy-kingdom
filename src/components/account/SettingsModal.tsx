"use client";

import { useEffect, useId } from "react";
import { AccountModalShell } from "@/components/account/AccountModalShell";
import { useSleeperConnectContext } from "@/contexts/SleeperConnectContext";

export function SettingsModal() {
  const titleId = useId();
  const { settingsModalOpen, closeSettingsModal } = useSleeperConnectContext();

  useEffect(() => {
    if (!settingsModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSettingsModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsModalOpen, closeSettingsModal]);

  return (
    <AccountModalShell
      open={settingsModalOpen}
      onClose={closeSettingsModal}
      title="Settings"
      titleId={titleId}
    >
      <p className="text-sm text-dash-text/75 leading-relaxed">
        More settings are on the way — league defaults for the trade calculator, notification
        preferences, and data export.
      </p>
    </AccountModalShell>
  );
}
