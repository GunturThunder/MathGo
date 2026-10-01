/** FR-02: pair within ±100 trophies, widening by 50 every 5 s of waiting. */
export const MATCH_WINDOW = { base: 100, step: 50, everyMs: 5_000 } as const;

export interface QueueEntry {
  readonly userId: string;
  readonly trophies: number;
  /** When the player joined the queue (ms, server clock). */
  readonly joinedAt: number;
}

/** How far from their own trophies a player accepts an opponent, after waiting until `now`. */
export function windowFor(entry: QueueEntry, now: number): number {
  const waited = Math.max(0, now - entry.joinedAt);
  return MATCH_WINDOW.base + MATCH_WINDOW.step * Math.floor(waited / MATCH_WINDOW.everyMs);
}

/** Two players may meet when their gap fits the wider window: waiting longer helps both. */
export function canPair(a: QueueEntry, b: QueueEntry, now: number): boolean {
  return Math.abs(a.trophies - b.trophies) <= Math.max(windowFor(a, now), windowFor(b, now));
}

/**
 * One matchmaking tick. The longest-waiting player is served first, with the closest unpaired
 * player by trophies on either side, if the pair fits the window. Nobody appears in two pairs.
 */
export function pairPlayers(
  entries: readonly QueueEntry[],
  now: number,
): [QueueEntry, QueueEntry][] {
  const byTrophies = [...entries].sort(
    (a, b) => a.trophies - b.trophies || a.joinedAt - b.joinedAt,
  );
  const position = new Map(byTrophies.map((e, i) => [e.userId, i]));
  const byWait = [...entries].sort((a, b) => a.joinedAt - b.joinedAt);
  const paired = new Set<string>();
  const pairs: [QueueEntry, QueueEntry][] = [];

  const nearestUnpaired = (from: number, step: 1 | -1): QueueEntry | undefined => {
    for (let i = from + step; i >= 0 && i < byTrophies.length; i += step) {
      const entry = byTrophies[i];
      if (entry !== undefined && !paired.has(entry.userId)) return entry;
    }
    return undefined;
  };

  for (const player of byWait) {
    if (paired.has(player.userId)) continue;
    const at = position.get(player.userId) ?? 0;
    const candidates = [nearestUnpaired(at, -1), nearestUnpaired(at, 1)]
      .filter((c): c is QueueEntry => c !== undefined && canPair(player, c, now))
      .sort(
        (a, b) => Math.abs(a.trophies - player.trophies) - Math.abs(b.trophies - player.trophies),
      );
    const opponent = candidates[0];
    if (opponent === undefined) continue;
    paired.add(player.userId).add(opponent.userId);
    pairs.push([player, opponent]);
  }
  return pairs;
}
