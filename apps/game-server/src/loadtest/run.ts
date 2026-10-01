// Headless load test (S4-07): N battles of two bots each against a running game-server, with
// the game-server container's CPU and memory sampled from `docker stats`. Prints a report and
// writes it as JSON. Usage (after `pnpm build`):
//   node dist/loadtest/run.js --battles 200 --container mathgo-game-server-1 --out report.json
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { parseArgs, promisify } from 'node:util';
import { LoadStats, runBot } from './bot-client.js';

const run = promisify(execFile);

const { values: args } = parseArgs({
  options: {
    battles: { type: 'string', default: '200' },
    endpoint: { type: 'string', default: 'ws://127.0.0.1:2567' },
    secret: {
      type: 'string',
      default: process.env['JWT_SECRET'] ?? 'local-compose-jwt-secret-not-for-production',
    },
    container: { type: 'string' },
    /** Spread the joins out: one new client every this many ms. */
    stagger: { type: 'string', default: '10' },
    out: { type: 'string' },
  },
});

const battles = Number(args.battles);
const stats = new LoadStats();

/** CPU % (100 = one core) and memory MiB of the container, every 2 s while the test runs. */
const samples: { cpu: number; memMiB: number }[] = [];
const toMiB = (text: string) => {
  const match = /([\d.]+)\s*([KMG]i?B)/.exec(text);
  if (match === null) return 0;
  const n = Number(match[1]);
  const unit = match[2] ?? 'MiB';
  return unit.startsWith('G') ? n * 1024 : unit.startsWith('K') ? n / 1024 : n;
};
let sampling = args.container !== undefined;
const sampler = (async () => {
  while (sampling && args.container !== undefined) {
    try {
      const { stdout } = await run('docker', [
        'stats',
        '--no-stream',
        '--format',
        '{{.CPUPerc}};{{.MemUsage}}',
        args.container,
      ]);
      const [cpu = '0', mem = '0'] = stdout.trim().split(';');
      samples.push({ cpu: Number.parseFloat(cpu), memMiB: toMiB(mem.split('/')[0] ?? '') });
    } catch {
      // A missed sample is fine; the next one comes in 2 s.
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
})();

const percentile = (sorted: number[], p: number) =>
  sorted.length === 0
    ? 0
    : (sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0);

const started = Date.now();
const bots: Promise<void>[] = [];
for (let i = 0; i < battles * 2; i++) {
  bots.push(
    runBot({ endpoint: args.endpoint, userId: `loadtest-${i}`, secret: args.secret, stats }),
  );
  await new Promise((r) => setTimeout(r, Number(args.stagger)));
}
await Promise.all(bots);
sampling = false;
await sampler;

const rooms = [...stats.rooms.values()];
const full = rooms.filter((r) => r.ended === 2);
const reasons: Record<string, number> = {};
for (const r of full) reasons[r.reason ?? '?'] = (reasons[r.reason ?? '?'] ?? 0) + 1;
const rtts = [...stats.rttsMs].sort((a, b) => a - b);
const cpu = samples.map((s) => s.cpu);
const mem = samples.map((s) => s.memMiB);
const round = (n: number) => Math.round(n * 10) / 10;

const report = {
  battlesRequested: battles,
  clients: battles * 2,
  durationS: round((Date.now() - started) / 1000),
  joined: stats.joined,
  joinFailed: stats.joinFailed,
  rooms: rooms.length,
  roomsFinishedForBoth: full.length,
  /** Rooms that did not reach a normal end for both players. */
  droppedRooms: rooms.length - full.length,
  droppedClients: stats.dropped,
  invalidMessages: stats.invalidMessages,
  endReasons: reasons,
  answers: rtts.length,
  rttMs: {
    p50: round(percentile(rtts, 50)),
    p95: round(percentile(rtts, 95)),
    p99: round(percentile(rtts, 99)),
    max: round(rtts.at(-1) ?? 0),
  },
  container:
    samples.length === 0
      ? null
      : {
          samples: samples.length,
          cpuPercentAvg: round(cpu.reduce((a, b) => a + b, 0) / cpu.length),
          cpuPercentPeak: round(Math.max(...cpu)),
          memMiBPeak: round(Math.max(...mem)),
        },
};

console.log(JSON.stringify(report, null, 2));
if (args.out !== undefined) await writeFile(args.out, `${JSON.stringify(report, null, 2)}\n`);
process.exit(report.droppedRooms === 0 && report.joinFailed === 0 ? 0 : 1);
