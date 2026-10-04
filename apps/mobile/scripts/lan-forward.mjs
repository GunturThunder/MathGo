// Dev only: lets an iPhone on the same Wi-Fi reach the local api and game-server, which Docker
// binds to 127.0.0.1 (Android uses `adb reverse` instead). Listens on the Mac's LAN IP and pipes
// each connection through. Usage: node scripts/lan-forward.mjs "$(ipconfig getifaddr en0)"
import net from 'node:net';
const host = process.argv[2];
for (const port of [3000, 2567]) {
  net
    .createServer((client) => {
      const upstream = net.connect(port, '127.0.0.1');
      client.pipe(upstream).pipe(client);
      const close = () => {
        client.destroy();
        upstream.destroy();
      };
      client.on('error', close);
      upstream.on('error', close);
    })
    .listen(port, host, () => console.log(`forwarding ${host}:${port} -> 127.0.0.1:${port}`));
}
