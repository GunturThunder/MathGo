import { randomInt } from 'node:crypto';
import type { Redis } from 'ioredis';

/** No look-alikes (0/O, 1/I/L), so codes are easy to read aloud (PRD). 31 symbols. */
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;
/** A code lives while its room is used; 10 minutes without a join or leave and it expires. */
export const INVITE_IDLE_TTL_MS = 10 * 60_000;
/** How long an expired code is still recognised, to say "expired" instead of "not found". */
const SEEN_TTL_MS = 24 * 60 * 60_000;

export type InviteLookup =
  | { readonly status: 'ok'; readonly roomId: string }
  | { readonly status: 'expired' }
  | { readonly status: 'not-found' };

/** code → roomId with an idle TTL (Redis in services, memory in tests). */
export interface InviteStore {
  /** A new unused code for the room. */
  create(roomId: string): Promise<{ code: string; expiresAt: Date }>;
  resolve(code: string): Promise<InviteLookup>;
  /** Activity in the room: restart its code's idle timer. */
  touchRoom(roomId: string): Promise<void>;
  /** The room closed: its code stops working. */
  removeRoom(roomId: string): Promise<void>;
}

export function newInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  }
  return code;
}

/** Upper-cases and trims; null when it cannot be a code (so it is simply "not found"). */
export function normalizeInviteCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  const valid =
    code.length === INVITE_CODE_LENGTH && [...code].every((c) => INVITE_ALPHABET.includes(c));
  return valid ? code : null;
}

const keys = {
  code: (code: string) => `invite:${code}`,
  room: (roomId: string) => `invite-room:${roomId}`,
  seen: (code: string) => `invite-seen:${code}`,
};

export class RedisInviteStore implements InviteStore {
  constructor(
    private readonly redis: Redis,
    private readonly ttlMs = INVITE_IDLE_TTL_MS,
  ) {}

  async create(roomId: string) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = newInviteCode();
      // NX: never hand out a code that is in use or recently expired.
      const taken = (await this.redis.exists(keys.seen(code))) === 1;
      if (taken) continue;
      const ok = await this.redis.set(keys.code(code), roomId, 'PX', this.ttlMs, 'NX');
      if (ok !== 'OK') continue;
      await this.redis
        .multi()
        .set(keys.room(roomId), code, 'PX', this.ttlMs)
        .set(keys.seen(code), '1', 'PX', SEEN_TTL_MS)
        .exec();
      return { code, expiresAt: new Date(Date.now() + this.ttlMs) };
    }
    throw new Error('Could not find a free invite code');
  }

  async resolve(code: string): Promise<InviteLookup> {
    const roomId = await this.redis.get(keys.code(code));
    if (roomId !== null) return { status: 'ok', roomId };
    return (await this.redis.exists(keys.seen(code))) === 1
      ? { status: 'expired' }
      : { status: 'not-found' };
  }

  async touchRoom(roomId: string) {
    const code = await this.redis.get(keys.room(roomId));
    if (code === null) return;
    await this.redis
      .multi()
      .pexpire(keys.code(code), this.ttlMs)
      .pexpire(keys.room(roomId), this.ttlMs)
      .exec();
  }

  async removeRoom(roomId: string) {
    const code = await this.redis.get(keys.room(roomId));
    if (code === null) return;
    await this.redis.del(keys.code(code), keys.room(roomId));
  }
}

/** For tests: the same rules in memory, with a clock you control. */
export class MemoryInviteStore implements InviteStore {
  private readonly codes = new Map<string, { roomId: string; expiresAt: number }>();
  private readonly seen = new Map<string, number>();

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly ttlMs = INVITE_IDLE_TTL_MS,
  ) {}

  async create(roomId: string) {
    let code = newInviteCode();
    while (this.seen.has(code)) code = newInviteCode();
    const expiresAt = this.now() + this.ttlMs;
    this.codes.set(code, { roomId, expiresAt });
    this.seen.set(code, this.now() + SEEN_TTL_MS);
    return { code, expiresAt: new Date(expiresAt) };
  }

  async resolve(code: string): Promise<InviteLookup> {
    const entry = this.codes.get(code);
    if (entry !== undefined && entry.expiresAt > this.now())
      return { status: 'ok', roomId: entry.roomId };
    const seenUntil = this.seen.get(code);
    return seenUntil !== undefined && seenUntil > this.now()
      ? { status: 'expired' }
      : { status: 'not-found' };
  }

  async touchRoom(roomId: string) {
    for (const entry of this.codes.values()) {
      if (entry.roomId === roomId && entry.expiresAt > this.now())
        entry.expiresAt = this.now() + this.ttlMs;
    }
  }

  async removeRoom(roomId: string) {
    for (const [code, entry] of this.codes) if (entry.roomId === roomId) this.codes.delete(code);
  }
}
