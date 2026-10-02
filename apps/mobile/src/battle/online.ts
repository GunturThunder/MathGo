import { getArena, type ArenaId, type Seat } from '@mathgo/game-core';
import type { ServerMessage } from '@mathgo/protocol';
import type { BattleSummary } from './battle-result';
import { formatClock, type BattleView, type Fighters } from './battle-view';
import type { BattleEffect, Outcome, Side } from './effects';

// An online battle (S3-12) as the server describes it: the app shows server state and sends
// answers; it never decides an answer, damage or the result (the server is authoritative).

type StateMessage = Extract<ServerMessage, { type: 'state' }>['payload'];
type PlayerView = StateMessage['players'][number];
type EndMessage = Extract<ServerMessage, { type: 'end' }>['payload'];

export const ONLINE_HP = 100;
const WARNING_MS = 10_000;

export interface OnlineBattle {
  readonly seat: Seat | null;
  readonly arena: ArenaId | null;
  readonly durationMs: number;
  /** Question text by index, as the server sends it (no answers). */
  readonly questions: Readonly<Record<number, string>>;
  readonly players: readonly [PlayerView, PlayerView];
  /** Battle time (server clock) at the last update, and the local time it arrived. */
  readonly serverNow: number;
  readonly receivedAt: number | null;
  readonly end: EndMessage | null;
}

const fresh = (hp: number): PlayerView => ({
  hp,
  streak: 0,
  comboReady: false,
  lockedUntil: 0,
  questionIndex: 0,
});

export const NEW_ONLINE_BATTLE: OnlineBattle = {
  seat: null,
  arena: null,
  durationMs: 90_000,
  questions: {},
  players: [fresh(ONLINE_HP), fresh(ONLINE_HP)],
  serverNow: 0,
  receivedAt: null,
  end: null,
};

function outcomeFor(result: EndMessage['result'], seat: Seat): Outcome {
  if (result.outcome === 'draw') return 'draw';
  return result.winner === seat ? 'win' : 'lose';
}

/** Applies one server message. `localNow` is the phone's clock (ms) when it arrived. */
export function reduceOnline(
  battle: OnlineBattle,
  message: ServerMessage,
  localNow: number,
): { battle: OnlineBattle; effects: BattleEffect[] } {
  switch (message.type) {
    case 'joined':
      // `joined` comes again before a rematch: a new battle in the same room.
      return {
        battle: {
          ...NEW_ONLINE_BATTLE,
          seat: message.payload.seat,
          arena: message.payload.arena,
          durationMs: message.payload.durationMs,
        },
        effects: [],
      };
    case 'questions': {
      const questions = { ...battle.questions };
      for (const q of message.payload.questions) questions[q.index] = q.text;
      // The server starts the clock as it sends the first questions.
      const receivedAt = battle.receivedAt ?? localNow;
      return { battle: { ...battle, questions, receivedAt }, effects: [] };
    }
    case 'state': {
      const { seat } = battle;
      const side = (s: Seat): Side => (s === seat ? 'me' : 'rival');
      const effects = message.payload.events.flatMap((e): BattleEffect[] => {
        if (seat === null) return [];
        if (e.type === 'hit')
          return [
            { kind: 'hit', by: side(e.seat), damage: e.damage, fast: e.speedBonus, combo: e.combo },
          ];
        if (e.type === 'combo-ready') return [{ kind: 'combo-ready', side: side(e.seat) }];
        if (e.type === 'miss') return [{ kind: 'miss', side: side(e.seat) }];
        return [];
      });
      return {
        battle: {
          ...battle,
          players: message.payload.players,
          serverNow: message.payload.now,
          receivedAt: localNow,
        },
        effects,
      };
    }
    case 'end': {
      const effects: BattleEffect[] =
        battle.seat === null
          ? []
          : [
              {
                kind: 'end',
                outcome: outcomeFor(message.payload.result, battle.seat),
                reason: message.payload.result.reason,
              },
            ];
      return { battle: { ...battle, end: message.payload }, effects };
    }
    default:
      return { battle, effects: [] };
  }
}

/** Battle time now: the last server time plus what passed on the phone since. */
export function battleTime(battle: OnlineBattle, localNow: number): number {
  if (battle.receivedAt === null) return 0;
  const t = battle.serverNow + (localNow - battle.receivedAt);
  return Math.min(battle.durationMs, Math.max(battle.serverNow, t));
}

const opponent = (seat: Seat): Seat => (seat === 0 ? 1 : 0);

/** The question this player is answering, if it has arrived. */
export function currentQuestion(battle: OnlineBattle): { index: number; text: string } | null {
  if (battle.seat === null) return null;
  const index = battle.players[battle.seat].questionIndex;
  const text = battle.questions[index];
  return text === undefined ? null : { index, text };
}

/** What the battle screen shows; null until the server has said which seat is ours. */
export function onlineView(
  battle: OnlineBattle,
  fighters: Fighters,
  localNow: number,
): BattleView | null {
  if (battle.seat === null || battle.arena === null) return null;
  const now = battle.end === null ? battleTime(battle, localNow) : battle.serverNow;
  const left = Math.max(0, battle.durationMs - now);
  const me = battle.players[battle.seat];
  const rival = battle.players[opponent(battle.seat)];
  const fighter = (f: Fighters['me'], hp: number) => ({
    ...f,
    hp,
    hpShare: Math.min(1, hp / ONLINE_HP),
  });
  return {
    arena: battle.arena,
    arenaName: getArena(battle.arena).name,
    timerText: formatClock(left),
    timeShare: left / battle.durationMs,
    timerWarning: left <= WARNING_MS,
    questionNumber: me.questionIndex + 1,
    me: fighter(fighters.me, me.hp),
    rival: fighter(fighters.rival, rival.hp),
    comboLit: me.comboReady ? 3 : Math.min(me.streak, 3),
    comboReady: me.comboReady,
    locked: battle.end === null && now < me.lockedUntil,
  };
}

/** The result screen's numbers, from the server's end message. */
export function onlineSummary(battle: OnlineBattle, fighters: Fighters): BattleSummary | null {
  if (battle.end === null || battle.seat === null) return null;
  const { result, stats } = battle.end;
  const mine = stats[battle.seat];
  const me = battle.players[battle.seat];
  const rival = battle.players[opponent(battle.seat)];
  return {
    outcome: outcomeFor(result, battle.seat),
    reason: result.reason,
    secondsLeft: Math.max(0, Math.floor((battle.durationMs - battle.serverNow) / 1000)),
    correct: mine.correct,
    answered: mine.correct + mine.wrong,
    bestCombo: mine.bestStreak,
    me: { name: fighters.me.name, damage: ONLINE_HP - rival.hp },
    rival: { name: fighters.rival.name, damage: ONLINE_HP - me.hp },
  };
}
