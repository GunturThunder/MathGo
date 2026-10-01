# @mathgo/game-server

Colyseus server for battles: join checks (S3-05), the battle room (S3-06), invites (S4-02),
reconnects (S4-04), match records (S4-03), anti-cheat flags (S4-06) and rematches (S4-05).

## Load test (S4-07)

Bots play like people: each reads its question text, works out the answer with game-core's
parser, and answers after 2–6 s (about 1 in 10 wrong). Every answer's round trip (sent → hit or
miss received) is measured. Start the stack with game-server limited like a small VPS (2 vCPU,
4 GB), then run 200 battles (400 clients):

```sh
docker compose -f docker-compose.yml -f docker-compose.loadtest.yml up -d --wait --build
pnpm build
pnpm --filter @mathgo/game-server loadtest -- --battles 200 --container mathgo-game-server-1 --out report.json
```

The runner samples the container's CPU and memory with `docker stats` and exits non-zero if any
room did not finish for both players. To watch the same bots in the Colyseus loadtest tool's live
view: `pnpm --filter @mathgo/game-server loadtest:ui -- --numClients 400 --delay 10`.

### Results

`loadtest-results/2026-10-01-200-battles-2cpu-4gb.json`, on a MacBook (Apple Silicon) with
game-server in Docker limited to 2 vCPU and 4 GB, bots on the same machine:

| Measure                                         | Result                                            |
| ----------------------------------------------- | ------------------------------------------------- |
| Battles finished for both players               | 200 of 200 (all by KO, in about 55 s)             |
| Joins failed / rooms dropped / clients dropped  | 0 / 0 / 0                                         |
| Answer round trip (3 076 answers)               | p50 5.1 ms, p95 14.9 ms, p99 21.2 ms, max 37.6 ms |
| game-server CPU (100 % = one core, limit 200 %) | average 11 %, peak 38 %                           |
| game-server memory (limit 4 GB)                 | peak 77 MiB                                       |

The round trips are over loopback, so they show the server's own processing time, not the
network: on a phone in Jakarta add the network round trip (target under 150 ms, S6-05). Repeat the
test on the production VPS once it exists.
