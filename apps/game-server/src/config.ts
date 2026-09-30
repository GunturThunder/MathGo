import { DEV_JWT_SECRET } from '@mathgo/auth';
import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(2567),
    /** Must match the api's: game-server checks the tokens the api signs. */
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  })
  .transform((env, ctx) => {
    if (
      env.NODE_ENV === 'production' &&
      (env.JWT_SECRET === undefined || env.JWT_SECRET === DEV_JWT_SECRET)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'set a real secret in production',
      });
    }
    return { ...env, JWT_SECRET: env.JWT_SECRET ?? DEV_JWT_SECRET };
  });

export type Config = z.infer<typeof schema>;

export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
