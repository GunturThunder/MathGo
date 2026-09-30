// `pnpm db:migrate` from the repo root: applies migrations to DATABASE_URL (from the environment
// or .env), or to the local docker compose database when it is unset.
import { LOCAL_DATABASE_URL, redact, runMigrations } from './migrate.js';

const url = process.env['DATABASE_URL'] ?? '';
if (url === '' && process.env['NODE_ENV'] === 'production') {
  console.error('DATABASE_URL is required in production.');
  process.exit(1);
}
const target = url === '' ? LOCAL_DATABASE_URL : url;

try {
  console.log(`Migrating ${redact(target)} …`);
  await runMigrations(target);
  console.log('Migrations applied.');
} catch (error) {
  // Drizzle wraps driver errors; the cause says why (e.g. ECONNREFUSED).
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
  const reason =
    cause instanceof Error ? cause.message || (cause as { code?: string }).code : String(cause);
  console.error('Migration failed:', reason);
  console.error('Is the database running? Start it with `docker compose up -d`.');
  process.exit(1);
}
