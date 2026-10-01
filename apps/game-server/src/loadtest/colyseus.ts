// The same bots under the Colyseus loadtest tool's live terminal view (S4-07):
//   node dist/loadtest/colyseus.js --room battle --numClients 400 --delay 10
import { cli, type Options } from '@colyseus/loadtest';
import { LoadStats, runBot } from './bot-client.js';

const stats = new LoadStats();
const secret = process.env['JWT_SECRET'] ?? 'local-compose-jwt-secret-not-for-production';

cli(async (options: Options) => {
  await runBot({
    endpoint: options.endpoint,
    userId: `loadtest-${options.clientId}`,
    secret,
    stats,
  });
});
