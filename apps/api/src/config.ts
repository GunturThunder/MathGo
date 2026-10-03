import { DEV_JWT_SECRET } from '@mathgo/auth';
import { z } from 'zod';

export { DEV_JWT_SECRET };

/** Local defaults, matching docker-compose.yml. Refused in production. */
export const DEV_DATABASE_URL = 'postgres://mathgo:mathgo@localhost:5432/mathgo';

/** Local default for CONSENT_SECRET. Refused in production. */
export const DEV_CONSENT_SECRET = 'dev-only-consent-secret-change-me-0123456';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.url().optional(),
    /** Signs access tokens; game-server verifies them with the same secret (S3-05). */
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
    /** Keys the hashes of parents' phone numbers and consent codes (S5-05). */
    CONSENT_SECRET: z.string().min(32, 'CONSENT_SECRET must be at least 32 characters').optional(),
    /**
     * How parent codes are sent: `log` writes them to the log (development only), `none` turns
     * consent off (503) until the WhatsApp/SMS provider is set up (S5-11).
     */
    CONSENT_SENDER: z.enum(['log', 'none']).optional(),
  })
  .transform((env, ctx) => {
    const production = env.NODE_ENV === 'production';
    if (production && env.DATABASE_URL === undefined) {
      ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'required in production' });
    }
    if (production && (env.JWT_SECRET === undefined || env.JWT_SECRET === DEV_JWT_SECRET)) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'set a real secret in production',
      });
    }
    if (
      production &&
      (env.CONSENT_SECRET === undefined || env.CONSENT_SECRET === DEV_CONSENT_SECRET)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['CONSENT_SECRET'],
        message: 'set a real secret in production',
      });
    }
    if (production && env.CONSENT_SENDER === 'log') {
      ctx.addIssue({
        code: 'custom',
        path: ['CONSENT_SENDER'],
        message: 'the log sender would leak codes; not allowed in production',
      });
    }
    return {
      ...env,
      DATABASE_URL: env.DATABASE_URL ?? DEV_DATABASE_URL,
      JWT_SECRET: env.JWT_SECRET ?? DEV_JWT_SECRET,
      CONSENT_SECRET: env.CONSENT_SECRET ?? DEV_CONSENT_SECRET,
      CONSENT_SENDER: env.CONSENT_SENDER ?? (production ? 'none' : 'log'),
    };
  });

export type Config = z.infer<typeof schema>;

/** Reads and checks the environment once at startup; a bad value stops the service. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
