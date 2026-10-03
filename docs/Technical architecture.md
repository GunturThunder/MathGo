# Technical architecture

Sep 29, 2026 · @guntur

MathGo runs as one TypeScript monorepo: an Expo React Native app, a Fastify API service and a separate Node.js + Colyseus game server over WebSockets, with Postgres and Redis in Docker.

## Tech stack

The backend is Node.js in TypeScript, using Colyseus for real-time rooms. The main reason: the question generator, damage rules and trophy maths live in one shared package that the app and the server both import.

| Layer | Choice | Why |
| --- | --- | --- |
| Mobile | React Native with Expo (dev builds) | One codebase for Android and iOS; EAS Build handles store builds |
| Game server | Node.js + Colyseus (TypeScript) | Rooms, seat reservation and reconnection are built in |
| Real-time transport | WebSockets (Colyseus) | Sends only state changes; the JS client works in React Native |
| HTTP API | Fastify, as its own api service | Auth, profile and trophies over REST |
| Durable data | Postgres + Drizzle ORM | Users, matches, trophy ledger |
| Short-lived data | Redis | Matchmaking queue, invite codes with a TTL, rate limits, Colyseus presence |
| Containers | Docker, multi-stage images, Docker Compose for local development | Backend only; the mobile app builds on EAS |
| Repo | pnpm workspaces + Turborepo | One repo, cached builds, shared packages |

Colyseus maps directly onto PRD requirements. FR-07 (reconnect within 15 s) is `allowReconnection(client, 15)`, and FR-03/04 (private rooms) are its basic room model.

Alternatives considered:

- **Nakama:** a Go server, so no shared TypeScript code.
- **Plain Socket.IO:** about 2 weeks of work rebuilding rooms and reconnection.
- **Elixir/Phoenix:** a second language for a 2–3 person team.

## Architecture

&#91;embedded content: system architecture · app, server, data stores\]

The app talks REST for accounts and WebSocket for battles. At match end, Colyseus rooms write results to Postgres. Docker Compose runs the api, the game server, Postgres and Redis together on one host.

## Monorepo layout

The repo has three apps and four shared packages. `game-core` is the most important package: it's pure TypeScript with no dependencies, and the app and the server both import it.

```
mathgo/
├── apps/
│   ├── mobile/            # Expo (React Native) app
│   ├── api/               # Fastify HTTP API: guest auth, profile, trophies
│   └── game-server/       # Colyseus: matchmaking and battle rooms
├── packages/
│   ├── game-core/         # seeded RNG, question generator, damage/combo, trophy calc, arena table
│   ├── protocol/          # message types + zod schemas shared by client and server
│   ├── db/                # Drizzle schema + migrations
│   └── config/            # tsconfig, eslint, prettier presets
├── docker/
│   ├── api.Dockerfile          # multi-stage, built from `turbo prune api --docker`
│   ├── game-server.Dockerfile  # multi-stage, built from `turbo prune game-server --docker`
│   └── docker-compose.yml      # postgres, redis, api, game-server
├── docs/
└── .github/workflows/     # lint, typecheck, test, build images; EAS for mobile
```

- **Two server apps from day one (decided).** `api` (Fastify: guest auth, profile, trophies) and `game-server` (Colyseus: matchmaking and battle rooms) build and deploy separately, sharing `game-core`, `protocol` and `db`. The game server checks the login token issued by the API with a shared key, and both use the same Postgres.
- **Docker is for the backend only.** `docker compose up` starts Postgres, Redis, `api` and `game-server` on one host. The mobile app is built by EAS Build.

## Mobile stack

The app uses Expo with dev builds (not Expo Go). The battle screen is drawn with Reanimated and Skia to hit 60 fps on mid-range Android phones.

| Concern | Choice |
| --- | --- |
| Navigation | expo-router |
| Battle visuals | React Native Reanimated + Skia: geometric shapes and hit effects |
| Answer input | A custom on-screen keypad, not the system keyboard: faster, no keyboard animation, and full control of the minus key |
| State | Zustand for battle and session state; TanStack Query for REST |
| Storage | react-native-mmkv for the guest token and settings |
| Sign-in | expo-apple-authentication + Google sign-in (Apple sign-in is required on iOS if Google is offered) |
| Invite links (FR-11) | Expo Linking + universal and app links |
| Sound and feel (FR-16) | expo-haptics, expo-audio, the native share sheet |

The practice bot (FR-13) runs fully offline in the app, reusing `game-core`. It needs no server, so waiting in the queue costs nothing.

## Battle flow

Battles use race mode and the server decides every result. The phone only sends typed answers; the seed never leaves the server.

1. Both players join the BattleRoom using their reserved seats. The server draws a secret random seed.
2. The server generates questions with `game-core(seed, i)` and sends the text of the next 3 to each player (never the answers).
3. The player sends `{qIndex, value}`. The server rebuilds the answer, compares it, and applies rate limits.
4. The server applies damage, the speed bonus and the combo, then sends a state update (HP, combo, hit) to both players.
5. The server sends the next question, so each player always has 3 queued.
6. The battle ends at 0 HP or at 90 s. The server writes the result and trophy changes.

Design points:

- **Queued questions** make the next question show instantly. The answer check takes one round trip, about 100–150 ms, which is fine in race mode.
- **No answer hashes on the client.** Answers are small whole numbers, so a hash can be brute-forced instantly.
- **Server clock.** The speed bonus and anti-cheat timing run from when the question was sent to when the answer arrived. Per-answer latency is stored so accounts that keep answering in under 300 ms can be reviewed.
- **Disconnects (FR-07).** Decided: no freeze. The battle keeps running while the player has up to 15 s to reconnect; after that the match is a forfeit.

## Matchmaking, invites and trophies

Matchmaking and invite codes live in Redis; trophies live in Postgres.

| Feature | How it works |
| --- | --- |
| Random queue (FR-02) | A Redis sorted set scored by trophies. A 1 s tick pairs players within ±100, widening by 50 every 5 s, then calls `matchMaker.createRoom` and reserves a seat for each player. At 30 s the app offers the offline bot. |
| Invite codes (FR-03/04) | 6 characters from an alphabet without 0, O, 1, I or L. Redis maps `code → roomId` with a 10-minute idle TTL. The room stays open for rematches. |
| Trophies (FR-08) | At match end, one Postgres transaction writes a `trophy_ledger` row and updates `users.trophies`. The arena floor is enforced in `game-core`. |

The ledger makes every trophy change auditable, and changes can be reversed for accounts flagged as cheaters.

## Gaps the PRD implies

These weren't in the first PRD draft; all are now approved and the MVP needs them.

| Area | Proposal |
| --- | --- |
| Guest accounts (FR-01) | On first launch the app calls `POST /auth/guest` and gets a JWT. A later Google or Apple sign-in links to that account, so progress is kept. Players under 18 get no account until a parent approves with a code sent to their email (PRD FR-20); until then the app runs offline only. |
| Kids' compliance | Families policy and COPPA limit which analytics and ad SDKs you can use, so pick them early. In Indonesia, PP Tunas also applies: age checks, parental consent for children's accounts, and no commercial profiling of children (see the PRD's sources). Decided: log game events to our own Postgres for the MVP, plus Sentry for crashes with personal data removed. No third-party analytics SDK. |
| Nickname filter | Decided: players pick from generated names (adjective + animal) in Bahasa Indonesia and English. No typed nicknames, so no filter is needed. |
| Testing | Property-based tests (fast-check) prove `game-core` follows the safety rules: whole-number answers, within the arena's limit, no early negatives. The Colyseus loadtest tool runs headless bot clients. |
| Hosting | Decided: one rented VPS in Jakarta or Singapore (launch country: Indonesia), running Docker Compose. Must-haves: daily Postgres backups stored off the server, a reverse proxy with automatic HTTPS (such as Caddy), uptime alerts and automatic security updates. WebSockets need a host that keeps connections open, which rules out serverless. When you run several instances, add the Colyseus Redis driver and give each instance its own public address. |
| Protocol versioning | The app sends `protocolVersion` on join; the server refuses outdated clients with a "please update" message. Store builds lag behind server deploys, so this is needed. |

## Build order

Decided: a blended plan. An offline battle against the bot is playable by week 4, so fun is tested before any server work; invite-code battles follow by week 7.

1. **Weeks 1–4:** monorepo scaffold, `game-core` with tests, battle screen (keypad, HP bars, Skia hits), offline practice bot, playtest.
2. **Weeks 5–7:** api and game-server services, BattleRoom, guest auth, Docker Compose, invite-code battles.
3. **Weeks 8–10:** random matchmaking, trophies and arenas, reconnect handling.
4. **Weeks 11–12:** analytics, anti-cheat flags, polish, closed beta.

## Open decisions

- [ ] Expo or bare React Native? Decided: Expo with dev builds
- [ ] One `server` app to start, or separate `api` and `game-server` from day one? Decided: separate from day one
- [ ] Freeze the battle clock during a disconnect? Decided: no freeze
- [ ] Race mode or buzzer mode? Decided: race mode
- [ ] Launch region and hosting provider? Hosting decided: one VPS; launch country: Indonesia
- [ ] AI: does the product use AI? Decided: no AI model in the MVP; revisit after launch
  - Use cases to weigh: adaptive difficulty, a smarter practice bot, a short explanation after a wrong answer, nickname moderation
  - Where it runs: server-side only (no AI SDK in the app, keeping kids' data off third parties) or on-device
  - Which model and provider, and the cost per battle it adds
  - Kids' privacy: which data a model may see, under Families policy and COPPA
