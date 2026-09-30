import {
  AuthError,
  isAdult,
  signAccessToken,
  verifyAccessToken,
  type AccessClaims,
  type SigningKey,
} from '@mathgo/auth';
import { and, eq, isNull, parentalConsents, refreshTokens, users, type Database } from '@mathgo/db';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiError } from './errors.js';
import { generateNicknames } from './nicknames.js';
import { hashRefreshToken, newRefreshToken, REFRESH_TOKEN_TTL_MS } from './tokens.js';

export interface AuthDeps {
  readonly db: Database;
  readonly key: SigningKey;
  readonly now: () => Date;
}

export interface Profile {
  id: string;
  nickname: string;
  birthYear: number;
  trophies: number;
}

export const profileOf = ({ id, nickname, birthYear, trophies }: Profile): Profile => ({
  id,
  nickname,
  birthYear,
  trophies,
});

/**
 * May this user play online right now? Adults yes; minors only with active parent consent
 * (FR-20). Checked each time a token is issued, so a revoked consent ends online play by the
 * next refresh.
 */
export async function canPlayOnline(db: Database, user: Profile, now: Date): Promise<boolean> {
  if (isAdult(user.birthYear, now)) return true;
  const [consent] = await db
    .select({ id: parentalConsents.id })
    .from(parentalConsents)
    .where(and(eq(parentalConsents.userId, user.id), isNull(parentalConsents.revokedAt)));
  return consent !== undefined;
}

/** Access token + a fresh refresh token for a user, in the shape the app stores. */
async function issueSession(deps: AuthDeps, db: Database, user: Profile) {
  const now = deps.now();
  const online = await canPlayOnline(db, user, now);
  const access = await signAccessToken({ userId: user.id, online }, deps.key, now);
  const refresh = newRefreshToken();
  const refreshExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: refresh.hash,
    expiresAt: refreshExpiresAt,
  });
  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt.toISOString(),
    refreshToken: refresh.token,
    refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
    user: { ...profileOf(user), online },
  };
}

/** The signed-in user, from `Authorization: Bearer <access token>`. */
export async function authenticate(request: FastifyRequest, deps: AuthDeps): Promise<AccessClaims> {
  const header = request.headers.authorization ?? '';
  const match = /^Bearer (\S+)$/.exec(header);
  if (match?.[1] === undefined) {
    throw new ApiError(401, 'invalid-token', 'Send the access token as a Bearer token.');
  }
  try {
    return await verifyAccessToken(match[1], deps.key, deps.now());
  } catch (error) {
    if (error instanceof AuthError) throw new ApiError(401, error.code, error.message);
    throw error;
  }
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthDeps): void {
  app.post<{ Body: { birthYear: number } }>(
    '/auth/guest',
    {
      schema: {
        body: {
          type: 'object',
          required: ['birthYear'],
          additionalProperties: false,
          properties: { birthYear: { type: 'integer' } },
        },
      },
    },
    async (request, reply) => {
      const { birthYear } = request.body;
      const thisYear = deps.now().getUTCFullYear();
      if (birthYear < thisYear - 120 || birthYear > thisYear) {
        throw new ApiError(
          400,
          'invalid-birth-year',
          `Birth year must be ${thisYear - 120}–${thisYear}.`,
        );
      }
      // Under 18: no account and no data until a parent consents (PRD FR-20, PP Tunas). The
      // app stays offline; the consent flow (S5-05) creates the account.
      if (!isAdult(birthYear, deps.now())) {
        throw new ApiError(403, 'consent-required', 'A parent must approve online play first.');
      }
      const session = await deps.db.transaction(async (tx) => {
        // A random generated name; the player can pick another (PATCH /me/nickname).
        const [nickname = ''] = generateNicknames('id', 1);
        const [user] = await tx.insert(users).values({ nickname, birthYear }).returning();
        if (user === undefined) throw new Error('user insert returned nothing');
        return issueSession(deps, tx, user);
      });
      request.log.info({ userId: session.user.id }, 'guest created');
      return reply.status(201).send(session);
    },
  );

  app.post<{ Body: { refreshToken: string } }>(
    '/auth/refresh',
    {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          additionalProperties: false,
          properties: { refreshToken: { type: 'string', minLength: 1, maxLength: 200 } },
        },
      },
    },
    async (request) => {
      const hash = hashRefreshToken(request.body.refreshToken);
      const now = deps.now();
      const outcome = await deps.db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(refreshTokens)
          .where(eq(refreshTokens.tokenHash, hash))
          .for('update');
        if (row === undefined) return { kind: 'invalid' } as const;
        if (row.usedAt !== null) {
          // A used token came back: it was copied. End every session of this user.
          await tx.delete(refreshTokens).where(eq(refreshTokens.userId, row.userId));
          return { kind: 'reused', userId: row.userId } as const;
        }
        if (row.expiresAt <= now) return { kind: 'invalid' } as const;
        await tx.update(refreshTokens).set({ usedAt: now }).where(eq(refreshTokens.id, row.id));
        const [user] = await tx.select().from(users).where(eq(users.id, row.userId));
        if (user === undefined) return { kind: 'invalid' } as const;
        return { kind: 'ok', session: await issueSession(deps, tx, user) } as const;
      });
      if (outcome.kind === 'reused') {
        request.log.warn({ userId: outcome.userId }, 'refresh token reused; sessions revoked');
      }
      if (outcome.kind !== 'ok') {
        throw new ApiError(401, 'invalid-refresh-token', 'Sign in again.');
      }
      return outcome.session;
    },
  );

  app.get('/me', async (request) => {
    const { userId } = await authenticate(request, deps);
    const [user] = await deps.db.select().from(users).where(eq(users.id, userId));
    if (user === undefined) {
      throw new ApiError(401, 'invalid-token', 'This account no longer exists.');
    }
    // Current, not the token's copy: the app shows under-18 mode from this (S3-09).
    return { ...profileOf(user), online: await canPlayOnline(deps.db, user, deps.now()) };
  });
}
