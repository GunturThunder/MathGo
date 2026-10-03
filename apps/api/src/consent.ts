import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { isAdult } from '@mathgo/auth';
import {
  and,
  consentCodes,
  desc,
  eq,
  gt,
  isNull,
  lt,
  parentalConsents,
  users,
  type Database,
} from '@mathgo/db';
import type { FastifyInstance } from 'fastify';
import { issueSession, type AuthDeps } from './auth.js';
import type { CodeSender } from './code-sender.js';
import { ApiError } from './errors.js';
import { generateNicknames } from './nicknames.js';
import { maskEmail, normalizeEmail } from './email.js';

// Parent consent (S5-05, PRD FR-20, PP Tunas). A child under 18 has no account. A parent enters
// their email address, gets a 6-digit code there, and the correct code creates the child's
// account with online play unlocked.

/** A code works for 5 minutes. */
export const CODE_TTL_MS = 5 * 60 * 1000;
/** "Resend" waits a minute after the last code. */
export const RESEND_AFTER_MS = 60 * 1000;
/** The 6th wrong code blocks that code… */
export const MAX_WRONG_CODES = 6;
/** …and the address gets a new code after 15 minutes (decided Oct 1, 2026). */
export const LOCK_MS = 15 * 60 * 1000;
/** At most 5 codes per address per hour, so nobody can flood a parent's inbox. */
export const MAX_CODES_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;
/** Code rows are kept a day for the limits above, then deleted. */
const KEEP_CODES_MS = 24 * HOUR_MS;

export interface ConsentDeps extends AuthDeps {
  /** Null when consent is switched off (no provider yet): start answers 503. */
  readonly sender: CodeSender | null;
  readonly secret: string;
}

const keyedHash = (secret: string, value: string) =>
  createHmac('sha256', secret).update(value).digest('hex');

/** The code is hashed with its row id, so equal codes never share a hash. */
const codeHash = (secret: string, id: string, code: string) =>
  keyedHash(secret, `code:${id}:${code}`);

const emailHash = (secret: string, email: string) => keyedHash(secret, `email:${email}`);

const sameHash = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

const newCode = () => randomInt(0, 1_000_000).toString().padStart(6, '0');

export function registerConsentRoutes(app: FastifyInstance, deps: ConsentDeps): void {
  app.post<{ Body: { email: string; birthYear: number } }>(
    '/consent/start',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'birthYear'],
          additionalProperties: false,
          properties: {
            email: { type: 'string', minLength: 1, maxLength: 320 },
            birthYear: { type: 'integer' },
          },
        },
      },
    },
    async (request, reply) => {
      const { birthYear } = request.body;
      const now = deps.now();
      const thisYear = now.getUTCFullYear();
      if (birthYear < thisYear - 120 || birthYear > thisYear) {
        throw new ApiError(
          400,
          'invalid-birth-year',
          `Birth year must be ${thisYear - 120}–${thisYear}.`,
        );
      }
      if (isAdult(birthYear, now)) {
        throw new ApiError(400, 'consent-not-needed', 'Adults sign up with POST /auth/guest.');
      }
      const email = normalizeEmail(request.body.email);
      if (email === null) {
        throw new ApiError(400, 'invalid-email', 'Send a valid email address.');
      }
      if (deps.sender === null) {
        throw new ApiError(503, 'consent-unavailable', 'Parent codes cannot be sent yet.');
      }
      const hash = emailHash(deps.secret, email);
      await deps.db
        .delete(consentCodes)
        .where(lt(consentCodes.createdAt, new Date(now.getTime() - KEEP_CODES_MS)));
      refuseTooMany(await recentCodes(deps.db, hash, now), now);

      const id = randomUUID();
      const code = newCode();
      try {
        await deps.sender.send({ email, code });
      } catch (error) {
        request.log.error({ err: error }, 'consent code not sent');
        throw new ApiError(502, 'code-not-sent', 'The code could not be sent. Try again.');
      }
      const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
      await deps.db.transaction(async (tx) => {
        // A new code replaces the last one: only the newest code works.
        await tx
          .update(consentCodes)
          .set({ usedAt: now })
          .where(and(eq(consentCodes.emailHash, hash), isNull(consentCodes.usedAt)));
        await tx.insert(consentCodes).values({
          id,
          emailHash: hash,
          birthYear,
          codeHash: codeHash(deps.secret, id, code),
          expiresAt,
          createdAt: now,
        });
      });
      request.log.info({ consentId: id }, 'consent code sent');
      return reply.status(201).send({
        consentId: id,
        email: maskEmail(email),
        expiresAt: expiresAt.toISOString(),
        resendAt: new Date(now.getTime() + RESEND_AFTER_MS).toISOString(),
      });
    },
  );

  app.post<{ Body: { consentId: string; code: string } }>(
    '/consent/verify',
    {
      schema: {
        body: {
          type: 'object',
          required: ['consentId', 'code'],
          additionalProperties: false,
          properties: {
            consentId: { type: 'string', format: 'uuid' },
            code: { type: 'string', pattern: '^[0-9]{6}$' },
          },
        },
      },
    },
    async (request, reply) => {
      const { consentId, code } = request.body;
      const now = deps.now();
      // Wrong attempts must be saved even though the request fails, so the transaction returns
      // what happened and the error is thrown after it commits.
      const outcome = await deps.db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(consentCodes)
          .where(eq(consentCodes.id, consentId))
          .for('update');
        if (row === undefined || row.usedAt !== null) return { kind: 'not-found' } as const;
        if (row.lockedAt !== null) {
          return { kind: 'locked', retryAt: new Date(row.lockedAt.getTime() + LOCK_MS) } as const;
        }
        if (row.expiresAt <= now) return { kind: 'expired' } as const;
        if (!sameHash(row.codeHash, codeHash(deps.secret, row.id, code))) {
          const wrong = row.wrongAttempts + 1;
          const locked = wrong >= MAX_WRONG_CODES;
          await tx
            .update(consentCodes)
            .set({ wrongAttempts: wrong, lockedAt: locked ? now : null })
            .where(eq(consentCodes.id, row.id));
          return locked
            ? ({ kind: 'locked', retryAt: new Date(now.getTime() + LOCK_MS) } as const)
            : ({ kind: 'wrong', attemptsLeft: MAX_WRONG_CODES - wrong } as const);
        }
        await tx.update(consentCodes).set({ usedAt: now }).where(eq(consentCodes.id, row.id));
        // The child's account, with consent: online play is unlocked. They pick a battle name
        // next (PATCH /me/nickname); this one is a placeholder.
        const [nickname = ''] = generateNicknames('id', 1);
        const [user] = await tx
          .insert(users)
          .values({ nickname, birthYear: row.birthYear })
          .returning();
        if (user === undefined) throw new Error('user insert returned nothing');
        await tx.insert(parentalConsents).values({
          userId: user.id,
          contactHash: row.emailHash,
          channel: 'email',
          consentedAt: now,
        });
        return { kind: 'ok', session: await issueSession(deps, tx, user) } as const;
      });

      switch (outcome.kind) {
        case 'ok':
          request.log.info({ userId: outcome.session.user.id }, 'parent consent given');
          return reply.status(201).send(outcome.session);
        case 'not-found':
          throw new ApiError(404, 'consent-not-found', 'Ask for a new code.');
        case 'expired':
          throw new ApiError(410, 'code-expired', 'The code has expired. Ask for a new one.');
        case 'wrong':
          throw new ApiError(400, 'wrong-code', 'That code does not match.', {
            attemptsLeft: outcome.attemptsLeft,
          });
        case 'locked':
          request.log.warn({ consentId }, 'consent code locked after wrong codes');
          throw new ApiError(429, 'code-locked', 'Too many wrong codes. Ask for a new one later.', {
            retryAt: outcome.retryAt.toISOString(),
          });
      }
    },
  );
}

/** This address's codes from the last hour, newest first. */
function recentCodes(db: Database, hash: string, now: Date) {
  return db
    .select({ createdAt: consentCodes.createdAt, lockedAt: consentCodes.lockedAt })
    .from(consentCodes)
    .where(
      and(
        eq(consentCodes.emailHash, hash),
        gt(consentCodes.createdAt, new Date(now.getTime() - HOUR_MS)),
      ),
    )
    .orderBy(desc(consentCodes.createdAt));
}

/** Locked out, too soon after the last code, or too many codes this hour: 429 with `retryAt`. */
function refuseTooMany(
  recent: readonly { createdAt: Date; lockedAt: Date | null }[],
  now: Date,
): void {
  const refuse = (code: string, message: string, retryAt: number) => {
    throw new ApiError(429, code, message, { retryAt: new Date(retryAt).toISOString() });
  };
  const lockEnds = Math.max(
    0,
    ...recent.map((r) => (r.lockedAt === null ? 0 : r.lockedAt.getTime() + LOCK_MS)),
  );
  if (lockEnds > now.getTime()) {
    refuse('code-locked', 'Too many wrong codes. Ask for a new one later.', lockEnds);
  }
  const latest = recent[0];
  if (latest !== undefined && latest.createdAt.getTime() + RESEND_AFTER_MS > now.getTime()) {
    refuse(
      'resend-too-soon',
      'Wait a moment before asking for another code.',
      latest.createdAt.getTime() + RESEND_AFTER_MS,
    );
  }
  const oldest = recent[MAX_CODES_PER_HOUR - 1];
  if (oldest !== undefined) {
    refuse(
      'too-many-codes',
      'Too many codes for this number. Try again later.',
      oldest.createdAt.getTime() + HOUR_MS,
    );
  }
}
