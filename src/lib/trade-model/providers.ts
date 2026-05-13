import type {
  CoordinatorProvider,
  CuratedTradeSnapshot,
  DraftClassProvider,
  InjuryAvailabilityProvider,
  OcContext,
  PlayerHistoryProvider,
  PlayerRoleProvider,
  PlayerScalarContext,
  TeamOffenseContext,
  TeamOffenseProvider,
} from "@/lib/trade-model/types";

const NEUTRAL = 0.5;

function tierFromMap(map: Record<string, number> | undefined, key: string): PlayerScalarContext {
  const v = map?.[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    return { tier01: NEUTRAL, missing: true };
  }
  return { tier01: clamp01(v), missing: false };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function createCuratedProviders(snapshot: CuratedTradeSnapshot): {
  teamOffense: TeamOffenseProvider;
  coordinator: CoordinatorProvider;
  history: PlayerHistoryProvider;
  role: PlayerRoleProvider;
  injury: InjuryAvailabilityProvider;
  draftClass: DraftClassProvider;
} {
  const teamOffense: TeamOffenseProvider = {
    getTeamOffense(teamAbbr: string): TeamOffenseContext {
      const k = teamAbbr.trim().toUpperCase();
      const t = tierFromMap(snapshot.teamOffense01, k);
      return { tier01: t.tier01, missing: t.missing };
    },
  };

  const coordinator: CoordinatorProvider = {
    getOcQuality(teamAbbr: string, seasonYear: number): OcContext {
      const key = `${teamAbbr.trim().toUpperCase()}:${seasonYear}`;
      const t = tierFromMap(snapshot.ocQuality01, key);
      return { tier01: t.tier01, missing: t.missing };
    },
  };

  const history: PlayerHistoryProvider = {
    getHistoryTier(sleeperPlayerId: string): PlayerScalarContext {
      return tierFromMap(snapshot.playerHistory01, sleeperPlayerId);
    },
  };

  const role: PlayerRoleProvider = {
    getRoleTier(sleeperPlayerId: string): PlayerScalarContext {
      return tierFromMap(snapshot.playerRole01, sleeperPlayerId);
    },
  };

  const injury: InjuryAvailabilityProvider = {
    getAvailabilityTier(sleeperPlayerId: string): PlayerScalarContext {
      return tierFromMap(snapshot.injuryAvailability01, sleeperPlayerId);
    },
  };

  const draftClass: DraftClassProvider = {
    getClassStrength01(draftYear: number): PlayerScalarContext {
      return tierFromMap(snapshot.draftClassStrength01, String(draftYear));
    },
  };

  return { teamOffense, coordinator, history, role, injury, draftClass };
}
