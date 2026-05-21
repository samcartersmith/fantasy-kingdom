import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  clearSleeperConnectStorage,
  isSleeperConnectComplete,
  readSleeperConnectStorage,
  SLEEPER_CONNECT_STORAGE_KEY,
  writeSleeperConnectStorage,
} from "@/lib/sleeper-connect-storage";

function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe("sleeper-connect-storage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createLocalStorageMock());
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("round-trips a valid connection with league and team names", () => {
    writeSleeperConnectStorage({
      username: "testuser",
      userId: "u1",
      selectedLeagueId: "lg1",
      selectedLeagueName: "Dynasty League",
      selectedRosterId: "3",
      selectedTeamName: "My Squad",
    });
    expect(readSleeperConnectStorage()).toEqual({
      username: "testuser",
      userId: "u1",
      selectedLeagueId: "lg1",
      selectedLeagueName: "Dynasty League",
      selectedRosterId: "3",
      selectedTeamName: "My Squad",
    });
  });

  it("isSleeperConnectComplete requires league and roster ids", () => {
    expect(isSleeperConnectComplete(null)).toBe(false);
    expect(isSleeperConnectComplete({ username: "a", userId: "b" })).toBe(false);
    expect(
      isSleeperConnectComplete({
        username: "a",
        userId: "b",
        selectedLeagueId: "lg1",
        selectedRosterId: "2",
      }),
    ).toBe(true);
  });

  it("rejects invalid stored payloads", () => {
    localStorage.setItem(SLEEPER_CONNECT_STORAGE_KEY, JSON.stringify({ username: "x" }));
    expect(readSleeperConnectStorage()).toBeNull();
    localStorage.setItem(SLEEPER_CONNECT_STORAGE_KEY, "not-json");
    expect(readSleeperConnectStorage()).toBeNull();
  });

  it("clears storage", () => {
    writeSleeperConnectStorage({ username: "a", userId: "b" });
    clearSleeperConnectStorage();
    expect(readSleeperConnectStorage()).toBeNull();
  });
});
