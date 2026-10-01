// The same bots under the Colyseus loadtest tool's live terminal view (S4-07):
//   node dist/loadtest/colyseus.js --room queue --numClients 400 --delay 10
// Each bot signs up as a guest on the api (API_URL, default http://127.0.0.1:3000) and queues.
import { cli, type Options } from '@colyseus/loadtest';
import { guestToken, LoadStats, runBot } from './bot-client.js';

const stats = new LoadStats();
const api = process.env['API_URL'] ?? 'http://127.0.0.1:3000';

cli(async (options: Options) => {
  await runBot({ endpoint: options.endpoint, token: await guestToken(api), stats });
});
