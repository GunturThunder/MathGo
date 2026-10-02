// A test opponent for checking online battles with one phone (S3-12):
//   pnpm opponent                       one battle
//   pnpm opponent -- --games 3          three in a row
//   pnpm opponent -- --accuracy 0.6 --think 4000-8000
// It signs up as a new guest on the api, waits in the random queue, and plays like a person:
// reads each question, works out the answer, answers after a pause (sometimes wrongly).
import { parseArgs } from 'node:util';
import { guestToken, LoadStats, runBot } from './bot-client.js';

const { values } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== '--'),
  options: {
    games: { type: 'string', default: '1' },
    accuracy: { type: 'string', default: '0.8' },
    think: { type: 'string', default: '3000-6000' },
  },
});
const games = Number(values.games);
const accuracy = Number(values.accuracy);
const [min, max] = values.think.split('-').map(Number);
if (!(games >= 1) || !(accuracy >= 0 && accuracy <= 1) || !(min! >= 0 && max! >= min!)) {
  console.error('Usage: pnpm opponent -- [--games 1] [--accuracy 0.8] [--think 3000-6000]');
  process.exit(1);
}

const api = process.env['API_URL'] ?? 'http://127.0.0.1:3000';
const endpoint = process.env['GAME_SERVER_URL'] ?? 'ws://127.0.0.1:2567';

for (let game = 1; game <= games; game++) {
  const stats = new LoadStats();
  console.log(`Battle ${game}/${games}: waiting in the queue. Tap Bertarung on the phone…`);
  await runBot({
    endpoint,
    token: await guestToken(api),
    stats,
    accuracy,
    thinkMs: [min!, max!],
    timeoutMs: 10 * 60_000,
  });
  const [room] = [...stats.rooms.values()];
  if (stats.joinFailed > 0) console.log('  No match within 10 minutes (or the server refused).');
  else if (room?.reason) console.log(`  Ended: ${room.reason}.`);
  else console.log('  Left before the end.');
}
