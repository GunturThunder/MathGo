// `pnpm review:too-fast` from the repo root (S6-04): the weekly anti-cheat list. Reads
// DATABASE_URL (from the environment or .env), or the local docker compose database when unset.
//   pnpm review:too-fast --days 7 --min 10 --min-matches 2 [--csv]
import { parseArgs } from 'node:util';
import { createDatabase } from './database.js';
import { LOCAL_DATABASE_URL, redact } from './migrate.js';
import { TOO_FAST_REVIEW, tooFastAccounts } from './too-fast.js';

const USAGE = 'Usage: pnpm review:too-fast [--days 7] [--min 10] [--min-matches 2] [--csv]';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

let args;
try {
  ({ values: args } = parseArgs({
    // `pnpm review:too-fast -- --days 14` passes the `--` through.
    args: process.argv.slice(2).filter((arg) => arg !== '--'),
    options: {
      days: { type: 'string', default: String(TOO_FAST_REVIEW.days) },
      min: { type: 'string', default: String(TOO_FAST_REVIEW.minTooFast) },
      'min-matches': { type: 'string', default: String(TOO_FAST_REVIEW.minMatches) },
      csv: { type: 'boolean', default: false },
    },
  }));
} catch (error) {
  fail(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
}

const count = (name: string, value: string): number => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1)
    fail(`--${name} must be a whole number of at least 1.\n${USAGE}`);
  return n;
};
const days = count('days', args.days);
const minTooFast = count('min', args.min);
const minMatches = count('min-matches', args['min-matches']);

const url = process.env['DATABASE_URL'] || LOCAL_DATABASE_URL;
const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const { db, close } = createDatabase(url, 1);

try {
  const rows = await tooFastAccounts(db, { since, minTooFast, minMatches });
  if (args.csv) {
    console.log(
      'user_id,nickname,trophies,answers,too_fast,too_fast_share,matches_with_too_fast,fastest_ms,last_match_at',
    );
    for (const r of rows) {
      console.log(
        [
          r.userId,
          r.nickname,
          r.trophies,
          r.answers,
          r.tooFast,
          r.share.toFixed(2),
          r.matchesWithTooFast,
          r.fastestMs,
          r.lastMatchAt.toISOString(),
        ].join(','),
      );
    }
  } else {
    console.log(
      `Accounts with ${minTooFast}+ answers under 300 ms in ${minMatches}+ matches since ${since.toISOString()} (${redact(url)}):`,
    );
    if (rows.length === 0) console.log('None.');
    else {
      console.table(
        rows.map((r) => ({
          user: r.userId,
          nickname: r.nickname,
          trophies: r.trophies,
          answers: r.answers,
          'too fast': r.tooFast,
          share: `${Math.round(r.share * 100)}%`,
          matches: r.matchesWithTooFast,
          'fastest ms': r.fastestMs,
          'last match': r.lastMatchAt.toISOString(),
        })),
      );
    }
  }
} catch (error) {
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
  const reason =
    cause instanceof Error ? cause.message || (cause as { code?: string }).code : String(cause);
  console.error('Review query failed:', reason);
  console.error('Is the database running? Start it with `docker compose up -d`.');
  process.exitCode = 1;
} finally {
  await close();
}
