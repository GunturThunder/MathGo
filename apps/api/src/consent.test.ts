import { consentCodes, eq, parentalConsents, users } from '@mathgo/db';
import { createTestDatabase } from '@mathgo/db/testing';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { CodeNotSentError, type CodeMessage, type CodeSender } from './code-sender.js';
import { loadConfig } from './config.js';
import { CODE_TTL_MS, LOCK_MS, RESEND_AFTER_MS } from './consent.js';
import { maskPhone, normalizeIndonesianMobile } from './phone.js';

/** Records every code instead of sending it; a channel can be made to fail. */
class FakeSender implements CodeSender {
  readonly sent: CodeMessage[] = [];
  failing = new Set<CodeMessage['channel']>();
  send(message: CodeMessage): Promise<void> {
    if (this.failing.has(message.channel))
      return Promise.reject(new CodeNotSentError(message.channel));
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
  sender.failing.clear();
});

const later = (ms: number) => {
  now = new Date(now.getTime() + ms);
};
/** Each test uses its own parent's number, so the per-phone limits don't mix. */
let phoneSeq = 0;
const nextPhone = () => `0812 3456 ${(7000 + ++phoneSeq).toString()}`;

interface ErrorReply {
  error: { code: string; attemptsLeft?: number; retryAt?: string };
}

const start = (phone: string, channel: 'whatsapp' | 'sms' = 'whatsapp', birthYear = 2014) =>
  app.inject({ method: 'POST', url: '/consent/start', payload: { phone, channel, birthYear } });
const verify = (consentId: string, code: string) =>
  app.inject({ method: 'POST', url: '/consent/verify', payload: { consentId, code } });
const startOk = async (phone: string, channel: 'whatsapp' | 'sms' = 'whatsapp') => {
  const res = await start(phone, channel);
  expect(res.statusCode).toBe(201);
  return res.json<{ consentId: string; channel: string; phone: string; expiresAt: string }>();
};
const wrongCodeFor = (code: string) => (code === '000000' ? '111111' : '000000');

describe('parent consent (S5-05)', () => {
  it('Done when: a test parent unlocks a child account', async () => {
    const before = await db.$count(users);
    const started = await startOk('0812-3456-7890');
    expect(started).toMatchObject({ channel: 'whatsapp', phone: '+62 812 •••• 7890' });
    expect(Date.parse(started.expiresAt) - now.getTime()).toBe(CODE_TTL_MS);
    expect(sender.last).toMatchObject({ channel: 'whatsapp', phone: '+6281234567890' });
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
    expect(consent).toMatchObject({ channel: 'whatsapp', revokedAt: null });

    // The code is used up.
    expect((await verify(started.consentId, sender.last.code)).statusCode).toBe(404);
  });

  it('Done when: a 6th wrong code is blocked, and a new code comes after 15 minutes', async () => {
    const phone = nextPhone();
    const started = await startOk(phone);
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
    // …and no new code for this number for 15 minutes.
    later(LOCK_MS - 1_000);
    const tooEarly = await start(phone);
    expect(tooEarly.statusCode).toBe(429);
    expect(tooEarly.json<ErrorReply>().error.code).toBe('code-locked');
    later(1_000);
    const again = await startOk(phone);
    expect((await verify(again.consentId, sender.last.code)).statusCode).toBe(201);
  });

  it('a code works for 5 minutes', async () => {
    const started = await startOk(nextPhone());
    later(CODE_TTL_MS);
    const res = await verify(started.consentId, sender.last.code);
    expect(res.statusCode).toBe(410);
    expect(res.json<ErrorReply>().error.code).toBe('code-expired');
  });

  it('resend: a minute apart, and only the newest code works', async () => {
    const phone = nextPhone();
    const first = await startOk(phone);
    const firstCode = sender.last.code;
    const soon = await start(phone);
    expect(soon.statusCode).toBe(429);
    expect(soon.json<ErrorReply>().error).toMatchObject({
      code: 'resend-too-soon',
      retryAt: new Date(now.getTime() + RESEND_AFTER_MS).toISOString(),
    });
    later(RESEND_AFTER_MS);
    // "Send by SMS" on the code screen.
    const second = await startOk(phone, 'sms');
    expect(second.channel).toBe('sms');
    expect((await verify(first.consentId, firstCode)).statusCode).toBe(404);
    expect((await verify(second.consentId, sender.last.code)).statusCode).toBe(201);
  });

  it('at most 5 codes per number per hour', async () => {
    const phone = nextPhone();
    for (let i = 0; i < 5; i++) {
      await startOk(phone);
      later(RESEND_AFTER_MS);
    }
    const sixth = await start(phone);
    expect(sixth.statusCode).toBe(429);
    expect(sixth.json<ErrorReply>().error.code).toBe('too-many-codes');
    later(60 * 60 * 1000);
    await startOk(phone);
  });

  it('WhatsApp first, SMS fallback', async () => {
    sender.failing.add('whatsapp');
    const started = await startOk(nextPhone());
    expect(started.channel).toBe('sms');
    expect(sender.last.channel).toBe('sms');
    expect((await verify(started.consentId, sender.last.code)).statusCode).toBe(201);
  });

  it('nothing sent, nothing stored: the parent can try again at once', async () => {
    sender.failing.add('whatsapp');
    sender.failing.add('sms');
    const phone = nextPhone();
    const res = await start(phone);
    expect(res.statusCode).toBe(502);
    expect(res.json<ErrorReply>().error.code).toBe('code-not-sent');
    sender.failing.clear();
    await startOk(phone);
  });

  it('the phone number itself is never stored', async () => {
    await startOk('+62 813 9999 1234');
    const rows = JSON.stringify([
      await db.select().from(consentCodes),
      await db.select().from(parentalConsents),
    ]);
    expect(rows).not.toContain('81399991234');
    expect(rows).not.toContain('99991234');
  });

  it.each([
    [{ phone: '0812 3456 7890', channel: 'whatsapp', birthYear: 1990 }, 400, 'consent-not-needed'],
    [{ phone: '021 555 1234', channel: 'whatsapp', birthYear: 2014 }, 400, 'invalid-phone'],
    [{ phone: '+1 415 555 0100', channel: 'sms', birthYear: 2014 }, 400, 'invalid-phone'],
    [{ phone: '0812 3456 7890', channel: 'email', birthYear: 2014 }, 400, 'invalid-request'],
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
      payload: { phone: nextPhone(), channel: 'whatsapp', birthYear: 2014 },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json<ErrorReply>().error.code).toBe('consent-unavailable');
    await off.close();
  });
});

describe('Indonesian mobile numbers', () => {
  it.each([
    ['0812-3456-7890', '+6281234567890'],
    ['812 3456 7890', '+6281234567890'],
    ['+62 812 3456 7890', '+6281234567890'],
    ['6281234567890', '+6281234567890'],
    ['(0857) 1234 567', '+628571234567'],
  ])('%s → %s', (input, e164) => {
    expect(normalizeIndonesianMobile(input)).toBe(e164);
  });

  it.each(['021 555 1234', '0812', '+1 415 555 0100', '08123456789012345', 'abc'])(
    '%s is refused',
    (input) => {
      expect(normalizeIndonesianMobile(input)).toBeNull();
    },
  );

  it('masks all but the start and the last 4 digits', () => {
    expect(maskPhone('+6281234567890')).toBe('+62 812 •••• 7890');
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
