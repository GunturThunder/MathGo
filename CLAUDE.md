# MathGo

A 1v1 mobile math battle game: each correct answer attacks the opponent. TypeScript monorepo with an Expo (React Native) app, a Fastify API and a Colyseus game server.

## Read first

- `docs/MathGo — PRD.md`: what we build and why (rules, arenas, question generator, requirements FR-xx).
- `docs/Technical architecture.md`: stack, service boundaries, battle flow.
- `docs/Sprint plan.md`: tasks by ID (`S1-01` …), with owner, dependencies and a "Done when" check.

The docs are exported from the online "MathGo — PRD" doc (https://claude.ai/artifact/WPu88KL124128V27Tp8eef), which is the source of truth. Don't edit them here, except the Status column of `docs/Sprint plan.md` (see below). If a task conflicts with the docs, stop and ask.

The app's design lives on the online "Math Battle UI" canvas (https://claude.ai/artifact/5NoACzFATY1J1PzAHSacLg): every screen plus the Visual language board (colours, type, components). The game's player-facing name is MathBattle. `docs/Math Battle UI.html` is an export of the approved screens; boards titled "(draft)" are not approved yet. Theme values in `apps/mobile/src/theme` come from the Visual language board; screens use only those tokens.

## Layout

| Path                     | What                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile`            | Expo app (SDK 57, dev builds, expo-router). How to run it on a phone: `apps/mobile/README.md`                                          |
| `apps/api`               | Fastify HTTP API: guest auth, profile, trophies                                                                                        |
| `apps/game-server`       | Colyseus: matchmaking and battle rooms                                                                                                 |
| `packages/game-core`     | Seeded RNG, question generator, battle rules, trophy maths. Pure TS, no dependencies, no I/O. Runs in Node and in the app (Hermes)     |
| `packages/protocol`      | Message types + zod schemas shared by app and game-server                                                                              |
| `packages/auth`          | Access tokens (JWT) and the online-play rule (adults, or minors with parent consent), shared by api and game-server                    |
| `packages/battle-client` | Joins a battle on game-server (typed protocol messages, join errors as codes, reconnect hooks). Used by the app; tested in game-server |
| `packages/db`            | Drizzle schema and migrations                                                                                                          |
| `packages/config`        | Shared tsconfig, ESLint and Prettier presets                                                                                           |

## Commands (run from the repo root)

```sh
pnpm install
pnpm build        # turbo: tsc builds of every workspace
pnpm typecheck
pnpm lint
pnpm test         # vitest
pnpm format       # prettier --write
pnpm format:check

docker compose up -d --wait   # Postgres, Redis, api and game-server (defaults in .env.example)
pnpm db:migrate               # apply migrations to DATABASE_URL (compose already runs them)
```

For one workspace: `pnpm --filter @mathgo/game-core test`.

## Conventions

- pnpm only. Node version in `.nvmrc`. Pin exact dependency versions.
- ESM everywhere (`"type": "module"`); relative imports end in `.js`, except in `apps/mobile`, which Metro bundles.
- TypeScript stays on 6.0.x: typescript-eslint doesn't support 7 yet.
- Strict TS with `noUncheckedIndexedAccess`; no `any`; use `import type` for types.
- Libraries build to `dist/` with `tsc -p tsconfig.build.json`; tests (`*.test.ts`) sit next to the code and are excluded from the build.
- `game-core` must stay deterministic and platform-free: no `Math.random`, `Date`, `console` or Node APIs. Randomness comes only from the seeded RNG.
- Every `game-core` change comes with tests. Rules from the PRD (arena ranges, damage, trophies) are covered by unit tests; generator safety rules by fast-check property tests.
- The server is authoritative: the app never decides answers, damage or trophies.
- User-facing strings go through i18n (Bahasa Indonesia default, English second).

## Working on a task

1. Take one sprint task (or a short chain) by ID from `docs/Sprint plan.md`. Check that its "Needs" are done.
2. Work on a branch named `s1-08-seeded-rng` (task ID + short name).
3. Before finishing, run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`. All must pass.
4. Commit messages start with the task ID: `S1-08: add seeded RNG`.
5. Report against the task's "Done when" column. Say plainly what isn't met.
6. Update the task's status in both places: the Status dropdown in the online doc's "Sprint plan" tab and the Status column of `docs/Sprint plan.md`. Use Not started, In progress, Blocked (waiting on something outside the task) or Done (every "Done when" check met).
