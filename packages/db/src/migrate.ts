import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { MIGRATIONS_FOLDER } from './index.js';

/** Local default, matching docker-compose.yml. */
export const LOCAL_DATABASE_URL = 'postgres://mathgo:mathgo@localhost:5432/mathgo';

/** Applies every migration not yet recorded in the database. Safe to run again. */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const client = postgres(databaseUrl, { max: 1, onnotice: () => undefined });
  try {
    await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await client.end();
  }
}

/** The URL with its password hidden, for logs. */
export function redact(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  if (url.password !== '') url.password = '***';
  return url.toString();
}
