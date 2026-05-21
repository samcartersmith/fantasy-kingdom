"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSleeperConnectContext } from "@/contexts/SleeperConnectContext";

const btnPress =
  "cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-home-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#050a14]";

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}

export function UserAccountMenu() {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const {
    connectionSummary,
    openConnectModal,
    openAppearanceModal,
    openSettingsModal,
    disconnectConnection,
    refreshConnectionSummary,
  } = useSleeperConnectContext();

  const closeMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, closeMenu]);

  const handleConnect = () => {
    closeMenu();
    refreshConnectionSummary();
    openConnectModal();
  };

  const handleAppearance = () => {
    closeMenu();
    openAppearanceModal();
  };

  const handleSettings = () => {
    closeMenu();
    openSettingsModal();
  };

  const handleDisconnect = () => {
    closeMenu();
    disconnectConnection();
    refreshConnectionSummary();
  };

  const connected = connectionSummary?.isComplete;
  const connectLabel = connected ? "Change connection" : "Connect";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`${btnPress} relative inline-flex items-center justify-center min-h-10 min-w-10 rounded-[var(--dash-radius-sm)] border border-white/15 bg-black/25 text-dash-text/90 hover:bg-white/10 hover:text-dash-text`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={connected ? "Account menu, Sleeper connected" : "Account menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <PersonIcon />
        {connected ? (
          <span
            className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-home-accent ring-2 ring-[#050a14]"
            aria-hidden
          />
        ) : null}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-[var(--dash-radius-md)] border border-dash-border bg-dash-surface-elevated py-1 shadow-xl"
        >
          {connectionSummary ? (
            <div className="px-4 py-3 border-b border-dash-border/80">
              <p className="text-xs font-semibold uppercase tracking-wide text-dash-text/55">
                Sleeper
              </p>
              <p className="text-sm font-medium text-dash-text truncate mt-0.5">
                @{connectionSummary.username}
              </p>
              {connected ? (
                <p className="text-xs text-dash-text/65 truncate mt-1">
                  {[connectionSummary.leagueName, connectionSummary.teamName]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : (
                <p className="text-xs text-dash-text/55 mt-1">Not fully connected</p>
              )}
            </div>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-4 py-2.5 text-sm text-dash-text hover:bg-white/8"
            onClick={handleConnect}
          >
            {connectLabel}
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-4 py-2.5 text-sm text-dash-text hover:bg-white/8"
            onClick={handleAppearance}
          >
            Appearance
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-4 py-2.5 text-sm text-dash-text hover:bg-white/8"
            onClick={handleSettings}
          >
            Settings
          </button>
          {connected ? (
            <>
              <div className="my-1 border-t border-dash-border/80" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="w-full text-left px-4 py-2.5 text-sm text-dash-danger/90 hover:bg-dash-danger/10"
                onClick={handleDisconnect}
              >
                Disconnect
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
