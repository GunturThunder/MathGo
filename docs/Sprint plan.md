# Sprint plan

Sep 29, 2026 · @guntur

Six 2-week sprints take MathGo from an empty repo to a closed beta by Dec 24, 2026. Sprint 1 starts Monday, Oct 5.

Assumptions: a team of three (one mobile developer, one backend developer, one part-time product/design person). Each developer has about 8 working days per sprint, after meetings and buffer. Estimates are in working days.

## Timeline

&#91;embedded content: sprint roadmap · 6 sprints, 3 gates\]

Each gate is a go/no-go check. If the fun gate fails, rework the battle rules before any server work starts in Sprint 3.

## Sprint 1 · Oct 5–16 · Foundations and game-core

Goal: the monorepo builds in CI, and `game-core` produces valid questions for all 5 arenas. Everything later builds on this package, so its tests are the sprint's main deliverable.

| ID | Task | Owner | Days | Needs | Done when | Status |
| --- | --- | --- | --- | --- | --- | --- |
| S1-01 | Create the monorepo: pnpm workspaces, Turborepo, empty `apps/mobile`, `apps/api`, `apps/game-server`, `packages/game-core`, `protocol`, `db`, `config` | Backend | 1 | – | `pnpm build` passes for every workspace | Done |
| S1-02 | `packages/config`: strict tsconfig, ESLint and Prettier presets used by every workspace | Mobile | 0.5 | S1-01 | `pnpm lint` and `pnpm typecheck` run from the root | Done |
| S1-03 | CI on GitHub Actions: lint, typecheck and test on every PR, with Turborepo cache | Mobile | 1 | S1-02 | A PR shows green checks; a failing test blocks merge | Done |
| S1-04 | Expo app with dev builds and expo-router; Metro set up to resolve monorepo packages | Mobile | 1.5 | S1-01 | Dev build runs on one Android and one iOS device and imports `game-core` | Blocked |
| S1-05 | App shell: Home, Practice, Battle, Settings placeholder screens and navigation | Mobile | 1.5 | S1-04 | Every screen is reachable from Home | Done |
| S1-06 | i18n: Bahasa Indonesia default, English second; all strings in translation files | Mobile | 1 | S1-04 | Switching language in Settings changes every string | Done |
| S1-07 | Theme tokens from the design (colours, type, spacing, radii) | Mobile | 1 | S1-15 | Screens use tokens only, no raw colour values | Done |
| S1-08 | `game-core`: seeded RNG keyed by match seed + question number | Backend | 0.5 | S1-01 | Same seed gives the same sequence in Node and in the app (Hermes) | Done |
| S1-09 | `game-core`: arena table (trophy ranges, terms, operators, number ranges, answer limits) | Backend | 0.5 | S1-01 | Table matches the PRD's "Rules per arena" | Done |
| S1-10 | `game-core`: N\_max difficulty formula; the lower trophy count sets T when arenas differ | Backend | 0.5 | S1-09 | Unit tests at p = 0, 0.5 and 1 for each arena | Done |
| S1-11 | `game-core`: expression evaluator with order of operations, and a display formatter (×, ÷, ², √, brackets) | Backend | 1 | S1-01 | Evaluator agrees with hand-worked examples from the PRD | Done |
| S1-12 | `game-core`: question generator for arenas 1–3, with safety rules and redraw | Backend | 2 | S1-08, S1-10, S1-11 | Generates the PRD examples' shapes for each arena | Done |
| S1-13 | `game-core`: arenas 4–5 (brackets, squares, square roots of perfect squares, negatives) | Backend | 2 | S1-12 | Generates the PRD examples' shapes for arenas 4 and 5 | Done |
| S1-14 | Property tests (fast-check), 10,000 seeds per arena: whole answers, within the limit, no negatives before arena 5, deterministic | Backend | 1 | S1-13 | All properties pass in CI | Done |
| S1-15 | Design: visual language (shapes, colours, hit effects), battle screen and keypad | Product | 5 | – | Mockups approved and handed to Mobile by Oct 12 | Done |
| S1-16 | Trademark search for "MathGo" in PDKI | Product | 0.5 | – | Result recorded in the PRD's open questions | Not started |

Load: Backend 8.5 days, Mobile 6.5 days, Product 5.5 days.

## Sprint 2 · Oct 19–30 · Offline battle vs bot

Goal: a full battle against the bot, playable offline on a phone by Oct 30 (week 4). It ends at the fun gate: the team decides from the playtest whether math fights are fun before any server work starts.

| ID | Task | Owner | Days | Needs | Done when | Status |
| --- | --- | --- | --- | --- | --- | --- |
| S2-01 | `game-core` battle engine as a pure reducer: HP 100, damage 10, +5 speed bonus under 3 s, combo doubles the next hit after 3 correct, 1 s lock and combo reset on a wrong answer, 90 s timer, KO, higher HP wins at time-out, draw on equal HP | Backend | 2 | S1-14 | Unit tests cover every rule in the PRD's battle-rules table | Done |
| S2-02 | `game-core` bot opponent: answer time and error rate per arena, 3 difficulty levels | Backend | 1.5 | S2-01 | Simulated bot battles last 60–90 s at the middle level | Done |
| S2-03 | `game-core` trophy calc: +30 win, −20 loss, up to ±10 by trophy gap, 0 on draw, arena floor | Backend | 1 | S1-09 | Unit tests for each case, including a loss at an arena floor | Done |
| S2-04 | `packages/protocol`: zod schemas for join, question batch, answer, state update, result, error and `protocolVersion` | Backend | 1.5 | S2-01 | Types imported by the app and a server stub without errors | Done |
| S2-05 | `packages/db`: Drizzle schema v1 (users, parental\_consents, matches, match\_answers, trophy\_ledger, events) and first migration | Backend | 2 | S1-01 | Migration runs on an empty database | Done |
| S2-06 | Docker Compose for local Postgres and Redis; `pnpm db:migrate` script | Backend | 0.5 | S2-05 | `docker compose up` + migrate works on a fresh machine | Done |
| S2-07 | Custom numeric keypad: digits, backspace, submit, minus key in arena 5 only, 44 px touch targets, tap haptics | Mobile | 1.5 | S1-15 | Typing 3-digit answers feels instant on a mid-range Android phone | Done |
| S2-08 | Battle screen layout: both HP bars, question, answer field, timer, combo indicator | Mobile | 2 | S1-07 | Matches the approved mockup on small and large phones | Done |
| S2-09 | Skia + Reanimated effects: attack hit, HP drain, combo, KO, wrong-answer shake and lock | Mobile | 2.5 | S2-08 | Effects play on the UI thread without dropped frames | Done |
| S2-10 | Practice vs bot mode: the local `game-core` engine and bot drive the battle screen; clearly labelled, no trophies | Mobile | 1 | S2-01, S2-02, S2-09 | A full 90 s battle plays offline in airplane mode | Done |
| S2-11 | Result screen: win, lose or draw, correct answers, best combo | Mobile | 1 | S2-10 | Shown after every battle, with Play again and Home | Done |
| S2-12 | Performance pass on a mid-range Android phone | Mobile | 0.5 | S2-09 | 60 fps during hits, measured with the performance monitor | Done |
| S2-13 | Design: Home, matchmaking, create and join room, result, birth-year check and parent consent screens | Product | 4 | S1-15 | Mockups approved and handed to Mobile by Oct 30 | Done |
| S2-14 | Playtest with 8–10 people (kids 6–12, teens, adults); record how long battles last and what confused them | Product | 1.5 | S2-11 | Notes shared with the team by Oct 29 | Not started |
| S2-15 | Fun gate (Oct 30): keep or tune HP, damage, timer and arena ranges in `game-core` | Product + Backend | 0.5 | S2-14 | Decision and any new values recorded in the PRD | Not started |

Load: Backend 8.5 days, Mobile 8.5 days, Product 6 days.

## Sprint 3 · Nov 2–13 · Services, guest auth and BattleRoom core

Goal: `api` and `game-server` run in Docker Compose, a guest can sign in, and the app joins a BattleRoom that sends server-generated questions. This sprint sets up the online path so invite battles can land early in Sprint 4.

| ID | Task | Owner | Days | Needs | Done when | Status |
| --- | --- | --- | --- | --- | --- | --- |
| S3-01 | `apps/api` on Fastify: env config, health check, structured logging (pino), one error format | Backend | 1 | S2-06 | `GET /health` returns 200 in Docker | Done |
| S3-02 | Guest auth: `POST /auth/guest` issues a JWT access token and refresh token, signed with a key shared with `game-server` | Backend | 1.5 | S3-01, S2-05 | A new install gets a token; refresh works after expiry | Done |
| S3-03 | Nickname generator (adjective + animal, Bahasa Indonesia and English): `GET /nicknames` gives choices, `PATCH /me/nickname` saves one | Backend | 0.5 | S3-02 | Only generated names are accepted | Done |
| S3-04 | Birth-year check: store the birth year only; under-18 players get no online account until a parent consents | Backend | 0.5 | S3-02 | An under-18 token cannot join matchmaking or rooms | Done |
| S3-05 | `apps/game-server` on Colyseus: checks the JWT on join; refuses an old `protocolVersion` with "please update" | Backend | 1 | S2-04, S3-02 | A bad token or old version is refused with a clear error code | Done |
| S3-06 | BattleRoom core: 2 seats, secret seed, 3 questions queued per player, answers checked with `game-core`, per-player rate limit | Backend | 2.5 | S3-05, S2-01 | Two test clients get the same questions; a wrong answer is rejected | Done |
| S3-07 | Multi-stage Dockerfiles for `api` and `game-server` (`turbo prune`); Compose runs all 4 services | Backend | 1 | S3-01, S3-05 | `docker compose up` starts everything on a clean machine | Done |
| S3-08 | First-launch flow: language, birth-year picker, nickname choice | Mobile | 2 | S2-13, S3-03 | A new player reaches Home in 3 taps after the birth year | Done |
| S3-09 | Under-18 mode: practice vs bot only; online buttons open "Ask a parent" | Mobile | 1 | S3-08 | No network call to battle services is made for under-18 players | Done |
| S3-10 | API client: TanStack Query, token in MMKV, automatic refresh on 401 | Mobile | 1.5 | S3-02 | Token survives app restart; refresh is invisible to the player | Done |
| S3-11 | Colyseus client wrapper: connect with JWT, join by room id, typed messages from `protocol`, reconnect hooks | Mobile | 2 | S3-05 | App joins a test BattleRoom and receives questions | Done |
| S3-12 | Battle screen reads from either the local engine (practice) or server state (online), same UI | Mobile | 2 | S3-11, S2-10 | One online battle plays end to end between two dev phones | Done |
| S3-13 | Choose a WhatsApp/SMS OTP provider for parent codes; start sender registration | Product | 1 | – | Provider account and test sender ready for Sprint 5 | Not started |
| S3-14 | Draft privacy policy and terms (Bahasa Indonesia and English) covering UU PDP and PP Tunas | Product | 2 | – | Drafts sent to the local lawyer | Not started |
| S3-15 | Brief the local lawyer on PP Tunas, UU PDP and IGRS; agree a review date | Product | 0.5 | S3-14 | Review booked before Dec 11 | Not started |

Load: Backend 8 days, Mobile 8.5 days, Product 3.5 days.

## Sprint 4 · Nov 16–27 · Invite-code battles and reconnect

Goal: two friends battle online with a 6-character code by Nov 20 (week 7), and a dropped player can rejoin within 15 s. S4-01, S4-02, S4-08 and S4-09 go first, because they unlock the week-7 online gate.

| ID | Task | Owner | Days | Needs | Done when | Status |
| --- | --- | --- | --- | --- | --- | --- |
| S4-01 | Battle rules on the server with the `game-core` engine: damage, speed bonus from the server clock, combo, wrong-answer lock, 90 s timer, KO and draw | Backend | 1.5 | S3-06 | Server state matches the engine's unit tests for a scripted battle | Done |
| S4-02 | Invite rooms: create a 6-character code (no 0, O, 1, I, L), Redis `code → roomId` with a 10-minute idle TTL, join by code, no trophies | Backend | 1.5 | S3-06 | A friend joins by code; an expired code gives a clear error | Done |
| S4-03 | Match end: write `matches` and `match_answers` (with per-answer latency) to Postgres | Backend | 1 | S4-01 | Every finished battle has one match row and one row per answer | Done |
| S4-04 | Reconnect (FR-07): `allowReconnection` for 15 s, battle keeps running, forfeit after 15 s or on quit | Backend | 1.5 | S4-01 | Airplane mode for 10 s resumes; 20 s ends as a loss | Done |
| S4-05 | Rematch in an invite room: the same room stays open; starts when both accept | Backend | 0.5 | S4-02 | Two rematches in a row work without a new code | Done |
| S4-06 | Anti-cheat basics: answers-per-second limit; flag answers under 300 ms in the match record | Backend | 1 | S4-03 | Scripted fast answers are rate-limited and flagged | Done |
| S4-07 | Load test with the Colyseus loadtest tool: 200 concurrent bot battles on a VPS-sized machine | Backend | 1 | S4-04 | CPU, memory and round-trip times recorded; no dropped rooms | Done |
| S4-08 | Create room screen: show the code, share sheet, waiting for friend | Mobile | 1.5 | S4-02 | Code shared through WhatsApp from the share sheet | Done |
| S4-09 | Join with code screen: 6-character input, uppercase, look-alike characters mapped, errors for expired or full rooms | Mobile | 1.5 | S4-02 | Friend joins in 3 taps or fewer from Home | Done |
| S4-10 | Online battle states: waiting, 3-2-1 countdown, "opponent reconnecting" banner, "you are reconnecting" overlay | Mobile | 2 | S4-04 | Each state shows in a two-phone test | Done |
| S4-11 | App background and network loss: reconnect automatically within 15 s | Mobile | 1.5 | S4-04 | Switching apps for 5 s mid-battle resumes the battle | Done |
| S4-12 | "Update required" screen when the server refuses the app version | Mobile | 0.5 | S3-05 | Old build shows the screen with a store link | Done |
| S4-13 | Rematch UI in invite rooms | Mobile | 1 | S4-05 | Both players see the offer and the other's answer | Done |
| S4-14 | Online playtest on 4G with two phones in different places; note lag or unfairness | Product | 1 | S4-10 | Notes shared by Nov 27 | Not started |
| S4-15 | Prepare the IGRS age-rating application | Product | 1 | – | Application ready to submit in Sprint 6 | Not started |

Load: Backend 8 days, Mobile 8 days, Product 2 days.

## Sprint 5 · Nov 30–Dec 11 · Random matchmaking, trophies and parent consent

Goal: tapping Battle finds a random opponent near your trophy count, wins and losses move trophies and arenas, and a parent can unlock online play with a WhatsApp or SMS code (FR-20).

| ID | Task | Owner | Days | Needs | Done when | Status |
| --- | --- | --- | --- | --- | --- | --- |
| S5-01 | Matchmaking queue (FR-02): Redis sorted set by trophies, 1 s tick, ±100 widening by 50 every 5 s, seats reserved for both players | Backend | 2.5 | S4-01 | 50 simulated players are all paired within the widening rules | Done |
| S5-02 | Queue edge cases: cancel, joining twice, already in a match, stale entries after a crash | Backend | 1 | S5-01 | Each case has a test; no player is paired twice | Done |
| S5-03 | Trophy settlement (FR-08): one Postgres transaction writes `trophy_ledger` and updates `users.trophies`; ranked battles only | Backend | 1.5 | S4-03, S2-03 | Ledger sum equals each user's trophies; invite battles change nothing | Done |
| S5-04 | Arena per match: questions from the lower arena, lower trophy count sets N\_max | Backend | 0.5 | S5-01 | A 250 vs 800 trophy match gets arena 1 questions | Done |
| S5-05 | Parent consent API: `POST /consent/start` (phone number) and `/consent/verify`; WhatsApp first, SMS fallback; 6-digit code, 5-minute expiry, attempt limits; consent record stored | Backend | 2.5 | S3-04, S3-13 | A test parent unlocks a child account; a 6th wrong code is blocked | Not started |
| S5-06 | Home: Battle button, trophy count, arena badge | Mobile | 1.5 | S5-03 | Trophies and arena update after each ranked battle | Done |
| S5-07 | Matchmaking screen: searching animation, time waited, cancel; at 30 s offer practice vs bot | Mobile | 1.5 | S5-01 | Cancel returns to Home; bot offer appears at 30 s | Done |
| S5-08 | Result screen: trophy change animation, arena unlock moment | Mobile | 1.5 | S5-03 | Crossing 300 trophies shows the Plus Plains unlock | Done |
| S5-09 | Parent consent screens: phone input, code entry, resend timer, success unlocks online play | Mobile | 2 | S5-05 | Under-18 player goes from "Ask a parent" to a random battle | Not started |
| S5-10 | Arena look: colour theme per arena on Home and Battle | Mobile | 1 | S5-06 | All 5 arenas have their theme | Done |
| S5-11 | OTP provider live: sender approved for WhatsApp and SMS in Indonesia | Product | 1 | S3-13 | Codes arrive on Telkomsel, Indosat and XL numbers | Not started |
| S5-12 | Lawyer review of the age check, consent flow, privacy policy and terms | Product | 1 | S3-15 | Written sign-off or change list by Dec 11 | Not started |
| S5-13 | Recruit about 50 closed-beta testers in Indonesia, including parents with kids | Product | 1.5 | – | Tester list with emails for TestFlight and Play internal testing | Not started |

Load: Backend 8 days, Mobile 7.5 days, Product 3.5 days.

## Sprint 6 · Dec 14–24 · Sign-in, analytics, production and closed beta

Goal: every P0 requirement is live on the production VPS, and closed-beta testers are playing by Dec 24. This sprint has only 9 working days, and Backend is at full load. If something slips, S6-04 moves first.

| ID | Task | Owner | Days | Needs | Done when | Status |
| --- | --- | --- | --- | --- | --- | --- |
| S6-01 | Google and Apple sign-in (FR-01): verify ID tokens, link to the guest account, keep trophies | Backend | 2 | S3-02 | Sign-in on a second phone restores the same trophies | Not started |
| S6-02 | Analytics (FR-09): `POST /events` batch endpoint into the Postgres `events` table (battle start/end, queue wait, invite create/join, consent steps); no personal data | Backend | 1.5 | S2-05 | Each event type appears after a test session | Done |
| S6-03 | Sentry on `api` and `game-server` with personal data removed | Backend | 0.5 | S3-07 | A test error shows in Sentry without IP, phone or nickname | Not started |
| S6-04 | Anti-cheat review query: accounts with repeated answers under 300 ms | Backend | 0.5 | S4-06 | Weekly list of flagged accounts runs from one command | Done |
| S6-05 | Production VPS in Jakarta or Singapore: Docker Compose, Caddy with automatic HTTPS, firewall, automatic security updates | Backend | 1.5 | S3-07 | App connects over `wss://` with a round trip under 150 ms from Jakarta | Not started |
| S6-06 | Daily Postgres backups stored off the server, a tested restore, uptime alerts | Backend | 1 | S6-05 | A restore to a fresh database succeeds; an alert fires when `api` is stopped | Not started |
| S6-07 | Deploy pipeline: CI builds and pushes images, runs migrations, restarts services | Backend | 1 | S6-05 | A merge to main deploys without manual steps | Not started |
| S6-08 | Sign-in buttons (Apple, Google) in Settings, with a "progress saved" state | Mobile | 1.5 | S6-01 | Both buttons work on real devices | Not started |
| S6-09 | Client analytics (batched) and Sentry for React Native with personal data removed | Mobile | 1 | S6-02, S6-03 | Events and a test crash arrive from a release build | Not started |
| S6-10 | EAS release builds: icon, splash, bundle IDs, Play internal testing and TestFlight | Mobile | 1.5 | S6-05 | Testers install from both stores' test tracks | Not started |
| S6-11 | Bug bash and performance pass on a low-end Android phone | Mobile | 2 | S6-10 | No open crash or P0 bug; 60 fps battles on the test phone | Not started |
| S6-12 | Store listing in Bahasa Indonesia and English: screenshots, description, "MathGo Battle" name | Product | 1 | S6-10 | Listings saved as drafts in both consoles | Not started |
| S6-13 | Store compliance: Play Data safety and Families forms, App Store privacy labels, privacy policy published | Product | 1 | S5-12 | Both consoles accept the forms | Not started |
| S6-14 | Submit the IGRS age-rating application | Product | 0.5 | S4-15 | Submission reference recorded in the PRD | Not started |
| S6-15 | Success-metric queries on the `events` table: D1/D7 retention, queue wait, invite join rate, disconnects, parent unlock rate | Product + Backend | 1 | S6-02 | Each PRD metric has a saved query | Done |
| S6-16 | Closed-beta kickoff: invite testers, feedback form, daily triage | Product | 1 | S6-10, S5-13 | At least 30 testers have played a battle by Dec 24 | Not started |

Load: Backend 8 days, Mobile 6 days, Product 4.5 days.

## After the MVP

Some P1 items are already partly done inside the sprints above; the rest form Sprint 7 onward, before soft launch.

| Item | Priority | Where it stands after Sprint 6 | Remaining work |
| --- | --- | --- | --- |
| FR-14 Speed bonus and combo | P1 | Done: built into the engine (S2-01, S4-01) | Tune values from beta data |
| FR-13 Practice vs bot while waiting | P1 | Done: offered at 30 s (S5-07) | – |
| FR-12 Rematch | P1 | Invite rooms done (S4-05) | Rematch offer after random battles |
| FR-16 Sound, haptics and settings | P1 | Keypad haptics and basic settings done | Sound effects, music, volume and vibration settings |
| FR-11 Join by invite link | P1 | Not started | Universal links and app links, a web fallback page |
| FR-15 Player profile | P1 | Not started | Trophies, win rate, best streak screen and API |
| FR-10 Grade or skill pick at first launch | P1 | Not started | Sets the starting trophy count within Counting Camp or Plus Plains |
| Ads (Monetization) | Soft launch | Not started | Family-certified ad network, rewarded ads, one interstitial per 3 battles, no personalised ads under 18 |
| FR-17 Preset emotes | P2 | Not started | Emote set and a rate limit |
| FR-18 Leaderboards | P2 | Not started | Global and friends boards from `users.trophies` |
| FR-19 Colour themes and shape skins | P2 | Not started | Unlocks tied to rewarded ads |
| AI features | Revisit after launch | Out of scope (PRD non-goal) | Decide use cases and privacy rules first |
