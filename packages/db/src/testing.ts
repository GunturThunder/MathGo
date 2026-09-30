import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { DatabaseConnection } from './database.js';
import { MIGRATIONS_FOLDER } from './index.js';
import * as schema from './schema.js';

/** For tests only: an empty in-memory Postgres (PGlite) with every migration applied. */
export async function createTestDatabase(): Promise<DatabaseConnection> {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, close: () => client.close() };
}
