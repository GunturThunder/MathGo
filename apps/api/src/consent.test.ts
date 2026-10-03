import { consentCodes, eq, parentalConsents, users } from '@mathgo/db';
import { createTestDatabase } from '@mathgo/db/testing';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { CodeMessage, CodeSender } from './code-sender.js';
import { loadConfig } from './config.js';
import { CODE_TTL_MS, LOCK_MS, RESEND_AFTER_MS } from './consent.js';
import { maskEmail, normalizeEmail } from './email.js';

/** Records every code instead of sending it; can be made to fail. */
class FakeSender implements CodeSender {
  readonly sent: CodeMessage[] = [];
  failing = false;
  send(message: CodeMessage): Promise<void> {
    if (this.failing) return Promise.reject(new Error('provider down'));
    this.sent.push(message);
    return Promise.resolve();
  }
  get last(): CodeMessage {
    const m = this.sent.at(-1);
    if (m === undefined) throw new Error('nothing sent');
    return m;
  }
}

const config = loadConfig({ LOG_LEVEL: 'silent' });
const database = await createTestDatabase();
const { db } = database;
let now = new Date('2026-11-02T08:00:00Z');
const sender = new FakeSender();
const app = buildApp(config, { db, now: () => now, codeSender: sender });

afterAll(async () => {
  await app.close();
  await database.close();
});
beforeEach(() => {
  sender.failing = false;
});

const later = (ms: number) => {
  now = new Date(now.getTime() + ms);
};
/** Each test uses its own parent's address, so the per-address limits don't mix. */
let emailSeq = 0;
const nextEmail = () => `parent${(++emailSeq).toString()}@example.com`;

interface ErrorReply {
  error: { code: string; attemptsLeft?: number; retryAt?: string };
}

const start = (email: string, birthYear = 2014) =>
  app.inject({ method: 'POST', url: '/consent/start', payload: { email, birthYear } });
const verify = (consentId: string, code: string) =>
  app.inject({ method: 'POST', url: '/consent/verify', payload: { consentId, code } });
const startOk = async (email: string) => {
  const res = await start(email);
  expect(res.statusCode).toBe(201);
  return res.json<{ consentId: string; email: string; expiresAt: string; resendAt: string }>();
};
const wrongCodeFor = (code: string) => (code === '000000' ? '111111' : '000000');

describe('parent consent by email (S5-05)', () => {
  it('Done when: a test parent unlocks a child account', async () => {
    const before = await db.$count(users);
    const started = await startOk(' Ayah.Budi@Gmail.com ');
    expect(started.email).toBe('ay•••••••@gmail.com');
    expect(Date.parse(started.expiresAt) - now.getTime()).toBe(CODE_TTL_MS);
    expect(Date.parse(started.resendAt) - now.getTime()).toBe(RESEND_AFTER_MS);
    expect(sender.last.email).toBe('ayah.budi@gmail.com');
    expect(sender.last.code).toMatch(/^\d{6}$/);
    // No account yet: only the code is pending.
    expect(await db.$count(users)).toBe(before);

    const res = await verify(started.consentId, sender.last.code);
    expect(res.statusCode).toBe(201);
    const session = res.json<{
      accessToken: string;
      user: { id: string; birthYear: number; online: boolean };
    }>();
    expect(session.user).toMatchObject({ birthYear: 2014, online: true });

    // The child can play online now, and the consent is on record.
    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(me.json()).toMatchObject({ id: session.user.id, online: true });
    const [consent] = await db
      .select()
      .from(parentalConsents)
      .where(eq(parentalConsents.userId, session.user.id));
    expect(consent).toMatchObject({ channel: 'email', revokedAt: null });

    // The code is used up.
    expect((await verify(started.consentId, sender.last.code)).statusCode).toBe(404);
  });

  it('Done when: a 6th wrong code is blocked, and a new code comes after 15 minutes', async () => {
    const email = nextEmail();
    const started = await startOk(email);
    const code = sender.last.code;
    const wrong = wrongCodeFor(code);
    for (const left of [5, 4, 3, 2, 1]) {
      const res = await verify(started.consentId, wrong);
      expect(res.statusCode).toBe(400);
      expect(res.json<ErrorReply>().error).toMatchObject({
        code: 'wrong-code',
        attemptsLeft: left,
      });
    }
    const sixth = await verify(started.consentId, wrong);
    expect(sixth.statusCode).toBe(429);
    const blocked = sixth.json<ErrorReply>().error;
    expect(blocked.code).toBe('code-locked');
    expect(Date.parse(blocked.retryAt ?? '')).toBe(now.getTime() + LOCK_MS);

    // Blocked means blocked: even the right code no longer works…
    const right = await verify(started.consentId, code);
    expect(right.statusCode).toBe(429);
    expect(right.json<ErrorReply>().error.code).toBe('code-locked');
    // …and no new code for this address for 15 minutes.
    later(LOCK_MS - 1_000);
    const tooEarly = await start(email);
    expect(tooEarly.statusCode).toBe(429);
    expect(tooEarly.json<ErrorReply>().error.code).toBe('code-locked');
    later(1_000);
    const again = await startOk(email);
    expect((await verify(again.consentId, sender.last.code)).statusCode).toBe(201);
  });

  it('a code works for 5 minutes', async () => {
    const started = await startOk(nextEmail());
    later(CODE_TTL_MS);
    const res = await verify(started.consentId, sender.last.code);
    expect(res.statusCode).toBe(410);
    expect(res.json<ErrorReply>().error.code).toBe('code-expired');
  });

  it('resend: a minute apart, and only the newest code works', async () => {
    const email = nextEmail();
    const first = await startOk(email);
    const firstCode = sender.last.code;
    const soon = await start(email);
    expect(soon.statusCode).toBe(429);
    expect(soon.json<ErrorReply>().error).toMatchObject({
      code: 'resend-too-soon',
      retryAt: new Date(now.getTime() + RESEND_AFTER_MS).toISOString(),
    });
    later(RESEND_AFTER_MS);
    const second = await startOk(email);
    expect((await verify(first.consentId, firstCode)).statusCode).toBe(404);
    expect((await verify(second.consentId, sender.last.code)).statusCode).toBe(201);
  });

  it('the same address in other letter case counts as the same parent', async () => {
    const email = nextEmail();
    await startOk(email);
    const res = await start(email.toUpperCase());
    expect(res.json<ErrorReply>().error.code).toBe('resend-too-soon');
  });

  it('at most 5 codes per address per hour', async () => {
    const email = nextEmail();
    for (let i = 0; i < 5; i++) {
      await startOk(email);
      later(RESEND_AFTER_MS);
    }
    const sixth = await start(email);
    expect(sixth.statusCode).toBe(429);
    expect(sixth.json<ErrorReply>().error.code).toBe('too-many-codes');
    later(60 * 60 * 1000);
    await startOk(email);
  });

  it('nothing sent, nothing stored: the parent can try again at once', async () => {
    sender.failing = true;
    const email = nextEmail();
    const res = await start(email);
    expect(res.statusCode).toBe(502);
    expect(res.json<ErrorReply>().error.code).toBe('code-not-sent');
    sender.failing = false;
    await startOk(email);
  });

  it('the email address itself is never stored', async () => {
    await startOk('ibu.sari.rahasia@example.co.id');
    const rows = JSON.stringify([
      await db.select().from(consentCodes),
      await db.select().from(parentalConsents),
    ]);
    expect(rows).not.toContain('sari.rahasia');
    expect(rows).not.toContain('example.co.id');
  });

  it.each([
    [{ email: 'ayah@gmail.com', birthYear: 1990 }, 400, 'consent-not-needed'],
    [{ email: 'not-an-email', birthYear: 2014 }, 400, 'invalid-email'],
    [{ email: 'ayah@gmail', birthYear: 2014 }, 400, 'invalid-email'],
    [{ email: 'ayah@gmail.com', birthYear: 2014, phone: '0812' }, 400, 'invalid-request'],
  ])('refuses %o', async (payload, status, code) => {
    const res = await app.inject({ method: 'POST', url: '/consent/start', payload });
    expect(res.statusCode).toBe(status);
    expect(res.json<ErrorReply>().error.code).toBe(code);
  });

  it.each([
    [{ consentId: 'nope', code: '123456' }, 400, 'invalid-request'],
    [{ consentId: '00000000-0000-4000-8000-000000000000', code: '12345' }, 400, 'invalid-request'],
    [
      { consentId: '00000000-0000-4000-8000-000000000000', code: '123456' },
      404,
      'consent-not-found',
    ],
  ])('verify refuses %o', async (payload, status, code) => {
    const res = await app.inject({ method: 'POST', url: '/consent/verify', payload });
    expect(res.statusCode).toBe(status);
    expect(res.json<ErrorReply>().error.code).toBe(code);
  });

  it('without a sender (no provider yet) consent is unavailable, not broken', async () => {
    const off = buildApp(config, { db, now: () => now, codeSender: null });
    const res = await off.inject({
      method: 'POST',
      url: '/consent/start',
      payload: { email: nextEmail(), birthYear: 2014 },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json<ErrorReply>().error.code).toBe('consent-unavailable');
    await off.close();
  });
});

describe('email addresses', () => {
  it.each([
    [' Ayah.Budi@Gmail.com ', 'ayah.budi@gmail.com'],
    ['ibu+mathbattle@yahoo.co.id', 'ibu+mathbattle@yahoo.co.id'],
  ])('%s → %s', (input, normalized) => {
    expect(normalizeEmail(input)).toBe(normalized);
  });

  it.each(['', 'ayah', 'ayah@', '@gmail.com', 'ayah@gmail', 'a b@gmail.com', 'a@b@gmail.com'])(
    '%o is refused',
    (input) => {
      expect(normalizeEmail(input)).toBeNull();
    },
  );

  it('an address longer than email allows is refused', () => {
    expect(normalizeEmail(`${'a'.repeat(250)}@gmail.com`)).toBeNull();
  });

  it.each([
    ['ayah.budi@gmail.com', 'ay•••••••@gmail.com'],
    ['ab@gmail.com', 'a•@gmail.com'],
    ['a@gmail.com', 'a•@gmail.com'],
  ])('masks %s as %s', (email, masked) => {
    expect(maskEmail(email)).toBe(masked);
  });
});

describe('consent config', () => {
  it('production refuses the log sender and the dev secret; consent is off by default there', () => {
    const prod = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://u:p@db:5432/x',
      JWT_SECRET: 'x'.repeat(40),
    };
    expect(() => loadConfig(prod)).toThrow(/CONSENT_SECRET/);
    expect(() =>
      loadConfig({ ...prod, CONSENT_SECRET: 'y'.repeat(40), CONSENT_SENDER: 'log' }),
    ).toThrow(/CONSENT_SENDER/);
    expect(loadConfig({ ...prod, CONSENT_SECRET: 'y'.repeat(40) }).CONSENT_SENDER).toBe('none');
    expect(loadConfig({}).CONSENT_SENDER).toBe('log');
  });
});
