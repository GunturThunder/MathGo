import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

/** Any Drizzle Postgres database with this schema: postgres.js in services, PGlite in tests. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DatabaseConnection {
  readonly db: Database;
  readonly close: () => Promise<void>;
}

/** Opens a connection pool for a service. Call `close()` on shutdown. */
export function createDatabase(databaseUrl: string, maxConnections = 10): DatabaseConnection {
  const client = postgres(databaseUrl, { max: maxConnections, onnotice: () => undefined });
  return { db: drizzle({ client, schema }), close: () => client.end() };
}
