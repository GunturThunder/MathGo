import { performance } from 'node:perf_hooks';
import { Client, type Room } from '@colyseus/sdk';
import { evaluate, parse } from '@mathgo/game-core';
import { PROTOCOL_VERSION, QUEUE_ROOM, parseServerMessage } from '@mathgo/protocol';

/** Shared counters for every bot in one load test (S4-07). */
export class LoadStats {
  readonly rttsMs: number[] = [];
  joined = 0;
  joinFailed = 0;
  /** Left or lost the connection before the battle ended. */
  dropped = 0;
  invalidMessages = 0;
  /** roomId → how many of its players saw the end, and why it ended. */
  readonly rooms = new Map<string, { ended: number; reason: string | null }>();
}

export interface BotOptions {
  readonly endpoint: string;
  /** An access token for a real account (from POST /auth/guest): the queue looks up trophies. */
  readonly token: string;
  readonly stats: LoadStats;
  /** Time to "read and type" an answer, like a player (ms, inclusive). */
  readonly thinkMs?: readonly [number, number];
  /** Share of answers that are right. */
  readonly accuracy?: number;
  /** Give up waiting for an opponent or the end after this long. */
  readonly timeoutMs?: number;
}

const between = ([min, max]: readonly [number, number]) => min + Math.random() * (max - min);

/**
 * One player for the load test: queues for a random battle, reads each question's text, works out
 * the answer like a person would (game-core's parser), answers after a human pause, and records
 * the round trip from sending an answer to receiving its hit or miss. Resolves when it leaves.
 */
export async function runBot(options: BotOptions): Promise<void> {
  const { stats, thinkMs = [2_000, 6_000], accuracy = 0.9, timeoutMs = 150_000 } = options;
  // Random matchmaking, like the app: wait in the queue, then take the reserved seat.
  let room: Room;
  try {
    const client = new Client(options.endpoint);
    const queue = await client.joinOrCreate(QUEUE_ROOM, {
      protocolVersion: PROTOCOL_VERSION,
      token: options.token,
    });
    queue.onMessage('queued', () => undefined);
    const reservation = await new Promise<unknown>((resolve, reject) => {
      const giveUp = setTimeout(() => reject(new Error('no match')), timeoutMs);
      queue.onMessage('matched', (payload: { reservation: unknown }) => {
        clearTimeout(giveUp);
        resolve(payload.reservation);
      });
    });
    void queue.leave(true);
    room = await client.consumeSeatReservation(
      reservation as Parameters<Client['consumeSeatReservation']>[0],
    );
  } catch {
    stats.joinFailed++;
    return;
  }
  stats.joined++;

  const questions = new Map<number, string>();
  const sentAt = new Map<number, number>();
  let seat: 0 | 1 | null = null;
  let next = 0;
  let timer: NodeJS.Timeout | null = null;
  let ended = false;

  const roomStats = () => {
    let entry = stats.rooms.get(room.roomId);
    if (entry === undefined) {
      entry = { ended: 0, reason: null };
      stats.rooms.set(room.roomId, entry);
    }
    return entry;
  };
  roomStats();

  const scheduleAnswer = (delayMs: number) => {
    if (timer !== null || ended) return;
    timer = setTimeout(() => {
      timer = null;
      const text = questions.get(next);
      if (text === undefined) return; // not arrived yet: answered when it does
      const right = evaluate(parse(text)).value;
      const value = Math.random() < accuracy ? right : right + 1;
      sentAt.set(next, performance.now());
      room.send('answer', { questionIndex: next, value });
    }, delayMs);
  };

  return new Promise<void>((resolve) => {
    const giveUp = setTimeout(() => void room.leave(true), timeoutMs);
    const finish = () => {
      clearTimeout(giveUp);
      if (timer !== null) clearTimeout(timer);
      resolve();
    };

    room.onMessage('*', (type: string | number, payload: unknown) => {
      const parsed = parseServerMessage(String(type), payload);
      if (!parsed.ok) {
        stats.invalidMessages++;
        return;
      }
      const message = parsed.message;
      switch (message.type) {
        case 'joined':
          seat = message.payload.seat;
          break;
        case 'questions': {
          const first = questions.size === 0;
          for (const q of message.payload.questions) questions.set(q.index, q.text);
          if (first) scheduleAnswer(between(thinkMs));
          break;
        }
        case 'state':
          for (const event of message.payload.events) {
            if ((event.type === 'hit' || event.type === 'miss') && event.seat === seat) {
              const at = sentAt.get(event.questionIndex);
              if (at !== undefined) stats.rttsMs.push(performance.now() - at);
              next = event.questionIndex + 1;
              // A miss locks input for 1 s before the next question shows.
              scheduleAnswer(between(thinkMs) + (event.type === 'miss' ? 1_000 : 0));
            }
          }
          break;
        case 'end': {
          ended = true;
          const entry = roomStats();
          entry.ended++;
          entry.reason = message.payload.result.reason;
          void room.leave(true);
          break;
        }
        default:
          break;
      }
    });
    room.onLeave(() => {
      if (!ended) stats.dropped++;
      finish();
    });
  });
}

/** A new guest account's access token, from the api (adult birth year, so online play). */
export async function guestToken(api: string): Promise<string> {
  const res = await fetch(`${api}/auth/guest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ birthYear: 1990 }),
  });
  if (!res.ok) throw new Error(`guest sign-up failed: ${res.status}`);
  return ((await res.json()) as { accessToken: string }).accessToken;
}
