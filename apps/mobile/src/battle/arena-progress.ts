import { ARENAS, arenaForTrophies, type ArenaId } from '@mathgo/game-core';

// Where a player stands on the trophy road (S5-06, design: Home's arena card).

export interface ArenaProgress {
  readonly arena: ArenaId;
  readonly name: string;
  readonly trophies: number;
  /** The next arena's floor, or null in the top arena. */
  readonly next: number | null;
  /** The next arena's name, or null in the top arena. */
  readonly nextName: string | null;
  /** 0 to 1: from this arena's floor to the next one's. 1 in the top arena. */
  readonly share: number;
  /** Trophies still needed for the next arena, or null in the top arena. */
  readonly toGo: number | null;
}

export function arenaProgress(trophies: number): ArenaProgress {
  const safe = Number.isInteger(trophies) && trophies >= 0 ? trophies : 0;
  const arena = arenaForTrophies(safe);
  const nextArena = ARENAS.find((a) => a.id === arena.id + 1);
  if (nextArena === undefined) {
    return {
      arena: arena.id,
      name: arena.name,
      trophies: safe,
      next: null,
      nextName: null,
      share: 1,
      toGo: null,
    };
  }
  const span = nextArena.minTrophies - arena.minTrophies;
  return {
    arena: arena.id,
    name: arena.name,
    trophies: safe,
    next: nextArena.minTrophies,
    nextName: nextArena.name,
    share: Math.min(1, (safe - arena.minTrophies) / span),
    toGo: nextArena.minTrophies - safe,
  };
}
