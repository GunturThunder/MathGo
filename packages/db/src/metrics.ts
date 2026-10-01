import { sql, type SQL } from 'drizzle-orm';
import type { Database } from './database.js';

// The PRD's success metrics (S6-15), one saved query each. Days are Jakarta calendar days: the
// beta and the soft launch are in Indonesia. Battles come from the server's own match records;
// queue waits, invites and consent steps from the app's analytics events (S6-02).

export const METRICS_TIME_ZONE = 'Asia/Jakarta';

export interface MetricsWindow {
  /** Start of the window (inclusive). */
  readonly from: Date;
  /** End of the window (exclusive). Retention only counts players whose day N ended by then. */
  readonly to: Date;
}

const ts = (date: Date) => sql`${date.toISOString()}::timestamptz`;
const day = (column: SQL) => sql`(${column} at time zone ${METRICS_TIME_ZONE})::date`;
const ratio = (part: number, whole: number) => (whole === 0 ? null : part / whole);

async function one<T>(db: Database, query: SQL): Promise<T> {
  const result = (await db.execute(query)) as unknown as { rows?: T[] } | T[];
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  const [row] = rows;
  if (row === undefined) throw new Error('metrics query returned no row');
  return row;
}

export interface Retention {
  /** Players who signed up in the window and whose day N is over. */
  readonly cohort: number;
  /** Of those, players who played or sent an event on day N. */
  readonly retained: number;
  readonly rate: number | null;
}

/** Day-N retention (PRD: day 1 35%+, day 7 12%+). Sign-up day is day 0. */
export async function retention(db: Database, w: MetricsWindow, n: 1 | 7): Promise<Retention> {
  const row = await one<{ cohort: number; retained: number }>(
    db,
    sql`
    with cohort as (
      select id, ${day(sql`created_at`)} as d0 from users
      where created_at >= ${ts(w.from)} and created_at < ${ts(w.to)}
        and ${day(sql`created_at`)} + ${n}::int < ${day(ts(w.to))}
    ),
    activity as (
      select user_id, ${day(sql`created_at`)} as d from events where user_id is not null
      union
      select seat0_user_id, ${day(sql`started_at`)} from matches where seat0_user_id is not null
      union
      select seat1_user_id, ${day(sql`started_at`)} from matches where seat1_user_id is not null
    )
    select count(*)::int as cohort,
      count(*) filter (where exists (
        select 1 from activity a where a.user_id = c.id and a.d = c.d0 + ${n}::int
      ))::int as retained
    from cohort c`,
  );
  return { ...row, rate: ratio(row.retained, row.cohort) };
}

export interface BattlesPerPlayer {
  /** Battles played, counted once per player in them. */
  readonly battles: number;
  /** (player, day) pairs with at least one battle. */
  readonly playerDays: number;
  readonly perPlayerDay: number | null;
}

/** Battles per daily player (PRD: 5+), from finished matches. */
export async function battlesPerDailyPlayer(
  db: Database,
  w: MetricsWindow,
): Promise<BattlesPerPlayer> {
  const row = await one<{ battles: number; playerDays: number }>(
    db,
    sql`
    with seats as (
      select seat0_user_id as user_id, ${day(sql`started_at`)} as d from matches
      where started_at >= ${ts(w.from)} and started_at < ${ts(w.to)} and seat0_user_id is not null
      union all
      select seat1_user_id, ${day(sql`started_at`)} from matches
      where started_at >= ${ts(w.from)} and started_at < ${ts(w.to)} and seat1_user_id is not null
    ),
    per_day as (select user_id, d, count(*) as n from seats group by user_id, d)
    select coalesce(sum(n), 0)::int as "battles", count(*)::int as "playerDays" from per_day`,
  );
  return { ...row, perPlayerDay: ratio(row.battles, row.playerDays) };
}

export interface QueueWait {
  /** Searches that found an opponent. */
  readonly matched: number;
  readonly medianMs: number | null;
}

/** Median wait for a random match (PRD: under 15 s), from the app's queue_wait events. */
export async function medianQueueWait(db: Database, w: MetricsWindow): Promise<QueueWait> {
  const row = await one<{ matched: number; medianMs: number | null }>(
    db,
    sql`
    select count(*)::int as "matched",
      (percentile_cont(0.5) within group (order by (props->>'waitedMs')::int))::float8 as "medianMs"
    from events
    where name = 'queue_wait' and props->>'outcome' = 'matched'
      and created_at >= ${ts(w.from)} and created_at < ${ts(w.to)}`,
  );
  return row;
}

export interface InviteJoins {
  readonly created: number;
  readonly joined: number;
  readonly rate: number | null;
}

/** Invite rooms where the friend joins (PRD: 60%+), from invite_create and invite_join events. */
export async function inviteJoinRate(db: Database, w: MetricsWindow): Promise<InviteJoins> {
  const row = await one<{ created: number; joined: number }>(
    db,
    sql`
    select count(*) filter (where name = 'invite_create')::int as created,
      count(*) filter (where name = 'invite_join' and props->>'result' = 'joined')::int as joined
    from events
    where name in ('invite_create', 'invite_join')
      and created_at >= ${ts(w.from)} and created_at < ${ts(w.to)}`,
  );
  return { ...row, rate: ratio(row.joined, row.created) };
}

export interface Disconnects {
  readonly battles: number;
  /** Battles ended by a forfeit: a dropped player not back within 15 s, or a player who quit. */
  readonly forfeits: number;
  readonly rate: number | null;
}

/**
 * Battles ending in a disconnect (PRD: under 3%), from the server's match records. A forfeit
 * is either a drop not reconnected within 15 s or a quit; the match record does not tell them
 * apart, so this is an upper bound.
 */
export async function disconnectRate(db: Database, w: MetricsWindow): Promise<Disconnects> {
  const row = await one<{ battles: number; forfeits: number }>(
    db,
    sql`
    select count(*)::int as battles,
      count(*) filter (where end_reason = 'forfeit')::int as forfeits
    from matches
    where started_at >= ${ts(w.from)} and started_at < ${ts(w.to)}`,
  );
  return { ...row, rate: ratio(row.forfeits, row.battles) };
}

export interface ParentUnlocks {
  /** Consent flows started (a parent's number entered). */
  readonly started: number;
  readonly verified: number;
  readonly rate: number | null;
}

/**
 * Under-18 players whose parent unlocks online play (PRD: 40%+), from consent_step events:
 * verified / started. Minors have no account before consent, so the parent consent API (S5-05)
 * records these steps itself.
 */
export async function parentUnlockRate(db: Database, w: MetricsWindow): Promise<ParentUnlocks> {
  const row = await one<{ started: number; verified: number }>(
    db,
    sql`
    select count(*) filter (where props->>'step' = 'started')::int as started,
      count(*) filter (where props->>'step' = 'verified')::int as verified
    from events
    where name = 'consent_step' and created_at >= ${ts(w.from)} and created_at < ${ts(w.to)}`,
  );
  return { ...row, rate: ratio(row.verified, row.started) };
}

export interface MetricRow {
  readonly metric: string;
  /** Percent, seconds or a count; null when there is no data yet. */
  readonly value: number | null;
  readonly unit: '%' | 's' | '';
  readonly target: string;
  readonly met: boolean | null;
  /** What the value is based on, e.g. "120 players". */
  readonly basis: string;
}

const pct = (rate: number | null) => (rate === null ? null : Math.round(rate * 1000) / 10);
const atLeast = (value: number | null, target: number) => (value === null ? null : value >= target);
const under = (value: number | null, target: number) => (value === null ? null : value < target);

/** Every PRD success metric for one window, with its target. */
export async function successMetrics(db: Database, w: MetricsWindow): Promise<MetricRow[]> {
  const [d1, d7, battles, wait, invites, drops, consent] = await Promise.all([
    retention(db, w, 1),
    retention(db, w, 7),
    battlesPerDailyPlayer(db, w),
    medianQueueWait(db, w),
    inviteJoinRate(db, w),
    disconnectRate(db, w),
    parentUnlockRate(db, w),
  ]);
  const perDay = battles.perPlayerDay === null ? null : Math.round(battles.perPlayerDay * 10) / 10;
  const waitS = wait.medianMs === null ? null : Math.round(wait.medianMs / 100) / 10;
  return [
    {
      metric: 'Day-1 retention',
      value: pct(d1.rate),
      unit: '%',
      target: '35%+',
      met: atLeast(pct(d1.rate), 35),
      basis: `${d1.retained} of ${d1.cohort} players`,
    },
    {
      metric: 'Day-7 retention',
      value: pct(d7.rate),
      unit: '%',
      target: '12%+',
      met: atLeast(pct(d7.rate), 12),
      basis: `${d7.retained} of ${d7.cohort} players`,
    },
    {
      metric: 'Battles per daily player',
      value: perDay,
      unit: '',
      target: '5+',
      met: atLeast(perDay, 5),
      basis: `${battles.battles} battles over ${battles.playerDays} player-days`,
    },
    {
      metric: 'Median wait for a random match',
      value: waitS,
      unit: 's',
      target: 'under 15 s',
      met: under(waitS, 15),
      basis: `${wait.matched} matched searches`,
    },
    {
      metric: 'Invite rooms where the friend joins',
      value: pct(invites.rate),
      unit: '%',
      target: '60%+',
      met: atLeast(pct(invites.rate), 60),
      basis: `${invites.joined} joins of ${invites.created} invites`,
    },
    {
      metric: 'Battles ending in a disconnect',
      value: pct(drops.rate),
      unit: '%',
      target: 'under 3%',
      met: under(pct(drops.rate), 3),
      basis: `${drops.forfeits} forfeits of ${drops.battles} battles (includes quits)`,
    },
    {
      metric: 'Crash-free sessions',
      value: null,
      unit: '%',
      target: '99.5%+',
      met: null,
      basis: 'in Sentry (S6-03, S6-09), not in Postgres',
    },
    {
      metric: 'Under-18 players whose parent unlocks online play',
      value: pct(consent.rate),
      unit: '%',
      target: '40%+',
      met: atLeast(pct(consent.rate), 40),
      basis: `${consent.verified} unlocks of ${consent.started} started`,
    },
  ];
}
