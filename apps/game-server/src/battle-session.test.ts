import { generateQuestion } from '@mathgo/game-core';
import { parseServerMessage, type ServerMessage } from '@mathgo/protocol';
import { describe, expect, it } from 'vitest';
import { BattleSession, type Outgoing } from './battle-session.js';

const SEED = 77;
const LEVEL = { arena: 2, trophies: 300 } as const;
const answerOf = (index: number) => generateQuestion(SEED, index, LEVEL).answer;

const types = (out: Outgoing[]) => out.map((o) => `${String(o.to)}:${o.message.type}`);
const payloadOf = <T extends ServerMessage['type']>(out: Outgoing[], type: T) =>
  out.find((o) => o.message.type === type)?.message as Extract<ServerMessage, { type: T }>;

/** Every message the session sends must pass the app's parser. */
const valid = (out: Outgoing[]) =>
  out.every((o) => parseServerMessage(o.message.type, o.message.payload).ok);

describe('BattleSession', () => {
  it('a seated player learns their seat; questions wait for the start', () => {
    const out = new BattleSession(SEED, LEVEL).welcome(1);
    expect(types(out)).toEqual(['1:joined']);
    expect(payloadOf(out, 'joined').payload).toEqual({ seat: 1, arena: 2, durationMs: 90_000 });
    expect(valid(out)).toBe(true);
  });

  it('at the start both players get the same 3 queued questions, text only (race mode)', () => {
    const out = new BattleSession(SEED, LEVEL).start();
    expect(types(out)).toEqual(['0:questions', '1:questions']);
    const [first, second] = out.map((o) => o.message.payload);
    expect(first).toEqual(second);
    const { questions } = payloadOf(out, 'questions').payload;
    expect(questions.map((q) => q.index)).toEqual([0, 1, 2]);
    expect(questions[0]).toEqual({ index: 0, text: generateQuestion(SEED, 0, LEVEL).text });
    expect(valid(out)).toBe(true);
  });

  it('a correct answer updates both players and tops up the answerer to 3 questions', () => {
    const room = new BattleSession(SEED, LEVEL);
    room.start();
    const out = room.receive(0, 'answer', { questionIndex: 0, value: answerOf(0) }, 1_000);
    expect(types(out)).toEqual(['all:state', '0:questions']);
    const state = payloadOf(out, 'state').payload;
    expect(state.players[1].hp).toBe(85);
    expect(state.events[0]).toMatchObject({ type: 'hit', seat: 0, damage: 15 });
    expect(payloadOf(out, 'questions').payload.questions.map((q) => q.index)).toEqual([3]);
    expect(valid(out)).toBe(true);
  });

  it('a malformed message gets an invalid-message error and changes nothing', () => {
    const room = new BattleSession(SEED, LEVEL);
    room.start();
    const out = room.receive(0, 'answer', { questionIndex: 0, value: '12' }, 1_000);
    expect(types(out)).toEqual(['0:error']);
    expect(payloadOf(out, 'error').payload.code).toBe('invalid-message');
    expect(room.battle.players[1].hp).toBe(100);
  });

  it('ends the battle once, with stats and no trophies', () => {
    const room = new BattleSession(SEED, LEVEL);
    room.start();
    room.receive(1, 'answer', { questionIndex: 0, value: answerOf(0) + 1 }, 2_000);
    const out = room.tick(90_000);
    expect(types(out)).toEqual(['all:end']);
    expect(payloadOf(out, 'end').payload).toEqual({
      result: { outcome: 'draw', reason: 'time' },
      stats: [
        { correct: 0, wrong: 0, bestStreak: 0 },
        { correct: 0, wrong: 1, bestStreak: 0 },
      ],
      trophies: null,
    });
    expect(valid(out)).toBe(true);
    expect(room.tick(95_000)).toEqual([]);
    // A late answer is rejected to its sender only.
    const late = room.receive(0, 'answer', { questionIndex: 0, value: 1 }, 95_000);
    expect(types(late)).toEqual(['0:state']);
    expect(payloadOf(late, 'state').payload.events).toEqual([
      { type: 'rejected', seat: 0, reason: 'finished' },
    ]);
  });
});

describe('BattleSession rejections', () => {
  it('an answer during the wrong-answer lock is rejected to its sender only', () => {
    const room = new BattleSession(SEED, LEVEL);
    room.start();
    room.receive(0, 'answer', { questionIndex: 0, value: answerOf(0) + 1 }, 1_000);
    const out = room.receive(0, 'answer', { questionIndex: 1, value: answerOf(1) }, 1_500);
    expect(types(out)).toEqual(['0:state']);
    expect(payloadOf(out, 'state').payload.events).toEqual([
      { type: 'rejected', seat: 0, reason: 'locked' },
    ]);
  });
});
