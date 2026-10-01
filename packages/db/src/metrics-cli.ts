// `pnpm metrics` from the repo root (S6-15): the PRD's success metrics against their targets.
// Reads DATABASE_URL (from the environment or .env), or the local docker compose database.
//   pnpm metrics [--days 28] [--csv]
import { parseArgs } from 'node:util';
import { createDatabase } from './database.js';
import { METRICS_TIME_ZONE, successMetrics } from './metrics.js';
import { LOCAL_DATABASE_URL, redact } from './migrate.js';

const USAGE = 'Usage: pnpm metrics [--days 28] [--csv]';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

let args;
try {
  ({ values: args } = parseArgs({
    // `pnpm metrics -- --days 14` passes the `--` through.
    args: process.argv.slice(2).filter((arg) => arg !== '--'),
    options: {
      days: { type: 'string', default: '28' },
      csv: { type: 'boolean', default: false },
    },
  }));
} catch (error) {
  fail(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
}

const days = Number(args.days);
if (!Number.isInteger(days) || days < 1) {
  fail(`--days must be a whole number of at least 1.\n${USAGE}`);
}

const url = process.env['DATABASE_URL'] || LOCAL_DATABASE_URL;
const to = new Date();
const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
const { db, close } = createDatabase(url, 1);

const status = (met: boolean | null) => (met === null ? 'no data' : met ? 'met' : 'NOT met');

try {
  const rows = await successMetrics(db, { from, to });
  if (args.csv) {
    console.log('metric,value,unit,target,status,basis');
    for (const r of rows) {
      console.log(
        [r.metric, r.value ?? '', r.unit, r.target, status(r.met), r.basis]
          .map((cell) =>
            /[",]/.test(String(cell)) ? `"${String(cell).replace(/"/g, '""')}"` : cell,
          )
          .join(','),
      );
    }
  } else {
    console.log(
      `Success metrics, last ${days} days (${METRICS_TIME_ZONE} days) on ${redact(url)}:`,
    );
    console.table(
      rows.map((r) => ({
        metric: r.metric,
        value: r.value === null ? '–' : `${r.value}${r.unit === 's' ? ' s' : r.unit}`,
        target: r.target,
        status: status(r.met),
        basis: r.basis,
      })),
    );
  }
} catch (error) {
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
  const reason =
    cause instanceof Error ? cause.message || (cause as { code?: string }).code : String(cause);
  console.error('Metrics query failed:', reason);
  console.error('Is the database running? Start it with `docker compose up -d`.');
  process.exitCode = 1;
} finally {
  await close();
}
