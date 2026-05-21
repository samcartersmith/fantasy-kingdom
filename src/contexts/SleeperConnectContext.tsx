"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSleeperConnect } from "@/hooks/useSleeperConnect";
import {
  isSleeperConnectComplete,
  readSleeperConnectStorage,
  SLEEPER_CONNECT_CHANGED_EVENT,
  type SleeperConnectStored,
} from "@/lib/sleeper-connect-storage";

export type SleeperConnectionSummary = {
  username: string;
  leagueName?: string;
  teamName?: string;
  isComplete: boolean;
};

type SleeperConnectContextValue = ReturnType<typeof useSleeperConnect> & {
  connectionSummary: SleeperConnectionSummary | null;
  connectModalOpen: boolean;
  openConnectModal: () => void;
  closeConnectModal: () => void;
  appearanceModalOpen: boolean;
  openAppearanceModal: () => void;
  closeAppearanceModal: () => void;
  settingsModalOpen: boolean;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  refreshConnectionSummary: () => void;
};

const SleeperConnectContext = createContext<SleeperConnectContextValue | null>(null);

function summaryFromStored(stored: SleeperConnectStored | null): SleeperConnectionSummary | null {
  if (!stored) return null;
  return {
    username: stored.username,
    leagueName: stored.selectedLeagueName,
    teamName: stored.selectedTeamName,
    isComplete: isSleeperConnectComplete(stored),
  };
}

export function SleeperConnectProvider({ children }: { children: ReactNode }) {
  const sleeper = useSleeperConnect({ mode: "full", autoRestore: true });
  const [connectionSummary, setConnectionSummary] = useState<SleeperConnectionSummary | null>(() =>
    summaryFromStored(readSleeperConnectStorage()),
  );
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [appearanceModalOpen, setAppearanceModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const refreshConnectionSummary = useCallback(() => {
    setConnectionSummary(summaryFromStored(readSleeperConnectStorage()));
  }, []);

  useEffect(() => {
    refreshConnectionSummary();
  }, [
    refreshConnectionSummary,
    sleeper.selectedLeagueId,
    sleeper.selectedRosterId,
    sleeper.username,
    sleeper.restoring,
  ]);

  useEffect(() => {
    const onChanged = () => refreshConnectionSummary();
    window.addEventListener(SLEEPER_CONNECT_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(SLEEPER_CONNECT_CHANGED_EVENT, onChanged);
  }, [refreshConnectionSummary]);

  const openConnectModal = useCallback(() => {
    setAppearanceModalOpen(false);
    setSettingsModalOpen(false);
    sleeper.beginConnectWizard({ reset: false });
    setConnectModalOpen(true);
  }, [sleeper]);

  const closeConnectModal = useCallback(() => {
    setConnectModalOpen(false);
    refreshConnectionSummary();
  }, [refreshConnectionSummary]);

  const openAppearanceModal = useCallback(() => {
    setConnectModalOpen(false);
    setSettingsModalOpen(false);
    setAppearanceModalOpen(true);
  }, []);

  const closeAppearanceModal = useCallback(() => setAppearanceModalOpen(false), []);

  const openSettingsModal = useCallback(() => {
    setConnectModalOpen(false);
    setAppearanceModalOpen(false);
    setSettingsModalOpen(true);
  }, []);

  const closeSettingsModal = useCallback(() => setSettingsModalOpen(false), []);

  const value = useMemo<SleeperConnectContextValue>(
    () => ({
      ...sleeper,
      connectionSummary,
      connectModalOpen,
      openConnectModal,
      closeConnectModal,
      appearanceModalOpen,
      openAppearanceModal,
      closeAppearanceModal,
      settingsModalOpen,
      openSettingsModal,
      closeSettingsModal,
      refreshConnectionSummary,
    }),
    [
      sleeper,
      connectionSummary,
      connectModalOpen,
      openConnectModal,
      closeConnectModal,
      appearanceModalOpen,
      openAppearanceModal,
      closeAppearanceModal,
      settingsModalOpen,
      openSettingsModal,
      closeSettingsModal,
      refreshConnectionSummary,
    ],
  );

  return (
    <SleeperConnectContext.Provider value={value}>{children}</SleeperConnectContext.Provider>
  );
}

export function useSleeperConnectContext(): SleeperConnectContextValue {
  const ctx = useContext(SleeperConnectContext);
  if (!ctx) {
    throw new Error("useSleeperConnectContext must be used within SleeperConnectProvider");
  }
  return ctx;
}
