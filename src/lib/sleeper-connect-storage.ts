export const SLEEPER_CONNECT_STORAGE_KEY = "fk:sleeper-connect";

export type SleeperConnectStored = {
  username: string;
  userId: string;
  selectedLeagueId?: string;
  selectedLeagueName?: string;
  selectedRosterId?: string;
  selectedTeamName?: string;
};

export function isSleeperConnectComplete(
  stored: SleeperConnectStored | null,
): stored is SleeperConnectStored & {
  selectedLeagueId: string;
  selectedRosterId: string;
} {
  return Boolean(stored?.selectedLeagueId && stored?.selectedRosterId);
}

export function readSleeperConnectStorage(): SleeperConnectStored | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SLEEPER_CONNECT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const {
      username,
      userId,
      selectedLeagueId,
      selectedLeagueName,
      selectedRosterId,
      selectedTeamName,
    } = parsed as SleeperConnectStored;
    if (typeof username !== "string" || !username.trim()) return null;
    if (typeof userId !== "string" || !userId.trim()) return null;
    const out: SleeperConnectStored = {
      username: username.trim(),
      userId: userId.trim(),
    };
    if (typeof selectedLeagueId === "string" && selectedLeagueId.trim()) {
      out.selectedLeagueId = selectedLeagueId.trim();
    }
    if (typeof selectedLeagueName === "string" && selectedLeagueName.trim()) {
      out.selectedLeagueName = selectedLeagueName.trim();
    }
    if (typeof selectedRosterId === "string" && selectedRosterId.trim()) {
      out.selectedRosterId = selectedRosterId.trim();
    }
    if (typeof selectedTeamName === "string" && selectedTeamName.trim()) {
      out.selectedTeamName = selectedTeamName.trim();
    }
    return out;
  } catch {
    return null;
  }
}

export function writeSleeperConnectStorage(next: SleeperConnectStored): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SLEEPER_CONNECT_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("fk:sleeper-connect-changed"));
  } catch {
    /* ignore quota / private mode */
  }
}

export function patchSleeperConnectStorage(
  patch: Partial<
    Pick<
      SleeperConnectStored,
      | "selectedLeagueId"
      | "selectedLeagueName"
      | "selectedRosterId"
      | "selectedTeamName"
    >
  >,
): void {
  const current = readSleeperConnectStorage();
  if (!current) return;
  writeSleeperConnectStorage({ ...current, ...patch });
}

export function clearSleeperConnectStorage(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(SLEEPER_CONNECT_STORAGE_KEY);
    window.dispatchEvent(new Event("fk:sleeper-connect-changed"));
  } catch {
    /* ignore */
  }
}

export const SLEEPER_CONNECT_CHANGED_EVENT = "fk:sleeper-connect-changed";
