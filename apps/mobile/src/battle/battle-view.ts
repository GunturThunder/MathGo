import { getArena, type ArenaId, type BattleState, type Seat } from '@mathgo/game-core';

// What the battle screen shows (S2-08), from a game-core battle state. The same view serves
// practice (local engine, S2-10) and online battles (server state, S3-12).

export interface FighterView {
  readonly name: string;
  readonly trophies: number;
  readonly hp: number;
  /** 0 to 1, for the HP bar. */
  readonly hpShare: number;
}

export interface BattleView {
  readonly arena: ArenaId;
  readonly arenaName: string;
  /** "1:07"; whole seconds, rounded up so 0:00 means time is up. */
  readonly timerText: string;
  /** 0 to 1: how much of the battle is left, for the ring. */
  readonly timeShare: number;
  /** The last 10 seconds. */
  readonly timerWarning: boolean;
  /** 1-based, as shown ("Q12"). */
  readonly questionNumber: number;
  readonly me: FighterView;
  readonly rival: FighterView;
  /** Flames lit, 0 to 3. */
  readonly comboLit: number;
  /** The next correct answer hits twice as hard. */
  readonly comboReady: boolean;
  /** The wrong-answer lock is on. */
  readonly locked: boolean;
}

export interface Fighters {
  readonly me: { readonly name: string; readonly trophies: number };
  readonly rival: { readonly name: string; readonly trophies: number };
}

const WARNING_MS = 10_000;

export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** `now` is ms since the battle start, on the same clock as `state`. */
export function battleView(
  state: BattleState,
  seat: Seat,
  fighters: Fighters,
  now: number,
): BattleView {
  const { rules } = state;
  const me = state.players[seat];
  const rival = state.players[seat === 0 ? 1 : 0];
  const left = Math.max(0, rules.durationMs - Math.max(now, state.now));
  const fighter = (f: Fighters['me'], hp: number): FighterView => ({
    ...f,
    hp,
    hpShare: Math.min(1, Math.max(0, hp / rules.hp)),
  });
  return {
    arena: state.level.arena,
    arenaName: getArena(state.level.arena).name,
    timerText: formatClock(left),
    timeShare: left / rules.durationMs,
    timerWarning: left <= WARNING_MS,
    questionNumber: me.questionIndex + 1,
    me: fighter(fighters.me, me.hp),
    rival: fighter(fighters.rival, rival.hp),
    comboLit: me.comboReady ? rules.comboStreak : Math.min(me.streak, rules.comboStreak),
    comboReady: me.comboReady,
    locked: state.result === null && now < me.lockedUntil,
  };
}
