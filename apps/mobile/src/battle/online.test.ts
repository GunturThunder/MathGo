import type { ServerMessage } from '@mathgo/protocol';
import {
  NEW_ONLINE_BATTLE,
  battleTime,
  currentQuestion,
  onlineSummary,
  onlineView,
  preStart,
  reduceOnline,
  rivalAwaySeconds,
  type OnlineBattle,
} from './online';

const fighters = { me: { name: 'Kamu', trophies: null }, rival: { name: 'Lawan', trophies: null } };
const player = (hp: number, extra: object = {}) => ({
  hp,
  streak: 0,
  comboReady: false,
  lockedUntil: 0,
  questionIndex: 0,
  ...extra,
});

function play(messages: [ServerMessage, number][]): { battle: OnlineBattle; effects: unknown[] } {
  let battle = NEW_ONLINE_BATTLE;
  const effects: unknown[] = [];
  for (const [message, at] of messages) {
    const r = reduceOnline(battle, message, at);
    battle = r.battle;
    effects.push(...r.effects);
  }
  return { battle, effects };
}

const joined: ServerMessage = {
  type: 'joined',
  payload: { seat: 1, arena: 3, durationMs: 90_000 },
};
const questions: ServerMessage = {
  type: 'questions',
  payload: {
    questions: [
      { index: 0, text: '7 × 8' },
      { index: 1, text: '6 × 9' },
    ],
  },
};

describe('online battle (S3-12)', () => {
  it('nothing to show until the server gives a seat', () => {
    expect(onlineView(NEW_ONLINE_BATTLE, fighters, 0)).toBeNull();
  });

  it('the clock starts with the first questions and runs on the phone between updates', () => {
    const { battle } = play([
      [joined, 1_000],
      [questions, 2_000],
    ]);
    expect(battleTime(battle, 2_000)).toBe(0);
    expect(battleTime(battle, 32_000)).toBe(30_000);
    expect(onlineView(battle, fighters, 32_000)?.timerText).toBe('1:00');
    expect(battleTime(battle, 200_000)).toBe(90_000);
    expect(currentQuestion(battle)).toEqual({ index: 0, text: '7 × 8' });
  });

  it('server state wins: HP, question, lock, combo, seen from my seat', () => {
    const state: ServerMessage = {
      type: 'state',
      payload: {
        now: 12_000,
        players: [player(85), player(100, { questionIndex: 1, streak: 1, lockedUntil: 13_000 })],
        events: [
          {
            type: 'hit',
            seat: 0,
            questionIndex: 0,
            damage: 15,
            speedBonus: true,
            combo: false,
            targetHp: 85,
          },
        ],
      },
    };
    const { battle, effects } = play([
      [joined, 0],
      [questions, 0],
      [state, 12_500],
    ]);
    expect(effects).toEqual([{ kind: 'hit', by: 'rival', damage: 15, fast: true, combo: false }]);
    // Re-synced to the server clock: 12 s at the moment the update arrived.
    expect(battleTime(battle, 12_500)).toBe(12_000);
    const view = onlineView(battle, fighters, 12_500)!;
    expect(view).toMatchObject({
      arena: 3,
      arenaName: 'Times Tower',
      questionNumber: 2,
      comboLit: 1,
      locked: true,
    });
    expect(view.me.hp).toBe(100);
    expect(view.rival.hp).toBe(85);
    expect(currentQuestion(battle)).toEqual({ index: 1, text: '6 × 9' });
    expect(onlineView(battle, fighters, 13_500)?.locked).toBe(false);
  });

  it('my wrong answer and my combo come back as effects', () => {
    const state: ServerMessage = {
      type: 'state',
      payload: {
        now: 5_000,
        players: [player(100), player(100, { lockedUntil: 6_000 })],
        events: [
          { type: 'miss', seat: 1, questionIndex: 0, lockedUntil: 6_000 },
          { type: 'combo-ready', seat: 0 },
        ],
      },
    };
    expect(
      play([
        [joined, 0],
        [state, 5_000],
      ]).effects,
    ).toEqual([
      { kind: 'miss', side: 'me' },
      { kind: 'combo-ready', side: 'rival' },
    ]);
  });

  it('the end: effect, frozen clock and the result summary from the server stats', () => {
    const last: ServerMessage = {
      type: 'state',
      payload: { now: 61_000, players: [player(0), player(40)], events: [] },
    };
    const end: ServerMessage = {
      type: 'end',
      payload: {
        result: { outcome: 'win', winner: 1, reason: 'ko' },
        stats: [
          { correct: 6, wrong: 2, bestStreak: 3 },
          { correct: 9, wrong: 1, bestStreak: 5 },
        ],
        trophies: null,
      },
    };
    const { battle, effects } = play([
      [joined, 0],
      [questions, 0],
      [last, 61_000],
      [end, 61_100],
    ]);
    expect(effects.at(-1)).toEqual({ kind: 'end', outcome: 'win', reason: 'ko' });
    expect(onlineView(battle, fighters, 80_000)?.timerText).toBe('0:29');
    expect(onlineSummary(battle, fighters)).toEqual({
      outcome: 'win',
      reason: 'ko',
      secondsLeft: 29,
      correct: 9,
      answered: 10,
      bestCombo: 5,
      me: { name: 'Kamu', damage: 100 },
      rival: { name: 'Lawan', damage: 60 },
    });
  });

  it('joined again (rematch) starts a fresh battle', () => {
    const state: ServerMessage = {
      type: 'state',
      payload: { now: 9_000, players: [player(50), player(70)], events: [] },
    };
    const { battle } = play([
      [joined, 0],
      [questions, 0],
      [state, 9_000],
      [joined, 20_000],
    ]);
    expect(battle.players[0].hp).toBe(100);
    expect(battle.receivedAt).toBeNull();
    expect(battle.questions).toEqual({});
  });

  it('before the start: waiting, then 3-2-1 from the server countdown (S4-10)', () => {
    const waiting = play([[joined, 0]]).battle;
    expect(preStart(waiting, 500)).toEqual({ kind: 'waiting' });
    const counting = play([
      [joined, 0],
      [{ type: 'countdown', payload: { startsInMs: 3_000 } }, 1_000],
    ]).battle;
    expect(preStart(counting, 1_000)).toEqual({ kind: 'countdown', n: 3 });
    expect(preStart(counting, 2_500)).toEqual({ kind: 'countdown', n: 2 });
    expect(preStart(counting, 3_900)).toEqual({ kind: 'countdown', n: 1 });
    const started = reduceOnline(counting, questions, 4_000).battle;
    expect(preStart(started, 4_000)).toBeNull();
  });

  it('the opponent drops and comes back; their seconds count down on battle time (S4-10)', () => {
    const away: ServerMessage = {
      type: 'presence',
      payload: { seat: 0, connected: false, reconnectBy: 25_000 },
    };
    const back: ServerMessage = { type: 'presence', payload: { seat: 0, connected: true } };
    const state: ServerMessage = {
      type: 'state',
      payload: { now: 10_000, players: [player(100), player(100)], events: [] },
    };
    const gone = play([
      [joined, 0],
      [questions, 0],
      [state, 10_000],
      [away, 10_000],
    ]).battle;
    expect(rivalAwaySeconds(gone, 10_000)).toBe(15);
    expect(rivalAwaySeconds(gone, 21_500)).toBe(4);
    expect(rivalAwaySeconds(reduceOnline(gone, back, 12_000).battle, 12_000)).toBeNull();
    // Our own presence is never shown as "opponent away".
    const mine: ServerMessage = {
      type: 'presence',
      payload: { seat: 1, connected: false, reconnectBy: 25_000 },
    };
    expect(rivalAwaySeconds(reduceOnline(gone, mine, 12_000).battle, 12_000)).toBe(13);
    expect(reduceOnline(play([[joined, 0]]).battle, mine, 0).battle.rivalAwayUntil).toBeNull();
  });
});
