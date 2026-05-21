"use client";

import type { ReactNode } from "react";
import { AppearanceModal } from "@/components/account/AppearanceModal";
import { SettingsModal } from "@/components/account/SettingsModal";
import { SleeperConnectModal } from "@/components/account/SleeperConnectModal";
import { SleeperConnectProvider } from "@/contexts/SleeperConnectContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SleeperConnectProvider>
      {children}
      <SleeperConnectModal />
      <AppearanceModal />
      <SettingsModal />
    </SleeperConnectProvider>
  );
}
