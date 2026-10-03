# MathGo — PRD

Sep 28, 2026 · @guntur

## Overview

MathGo (listed in app stores as MathGo Battle) is a 1v1 mobile fighting game where solving math problems is how you attack. Each correct answer hits the opponent's HP bar; the first player knocked to zero loses.

Players start a battle two ways: a random online opponent, or a friend invited with a room code. Winners earn trophies, which move them up through arenas with harder math.

The vision: make mental-math practice feel like a quick, competitive game, not homework. A battle lasts about 90 seconds, so it fits a school break or a commute.

The art style is abstract: geometric shapes, bold colours and clean hit effects instead of characters. This keeps art cheap to produce and appeals to every age.

## Problem and goals

Math practice apps mostly feel like solo worksheets, so players drop off once the novelty fades. Head-to-head battles give a reason to come back: a rival, a rank, and a quick win.

### Goals for v1

- A real-time 1v1 battle that feels fair on mobile networks
- A random match found in under 15 seconds (median)
- A friend joins an invite room in 3 taps or fewer
- Trophies and arenas that give players a reason to play again tomorrow

### Non-goals for v1

- Free-text chat (a moderation and child-safety risk)
- Team battles (2v2), tournaments and seasons
- Advanced math beyond powers and order of operations
- Real-money rewards of any kind
- AI models inside the game (revisit after launch)

## Target users

The game is for all ages: kids and teens practising for school, and adults who want a quick brain workout. Arena 1 is easy enough for a 6-year-old, and the top arenas challenge adults.

| Persona | Age | Why they play | What they need |
| --- | --- | --- | --- |
| Student competitor | 6–17 | Beat classmates, climb ranks | Math matched to their level, no open chat |
| Casual brain-gamer | 18–35 | Quick mental workout on a commute | Short battles, fast matchmaking |
| Teacher or parent | 25+ | Run friendly matches with kids | Invite codes, safe defaults |

Because many players may be under 18, v1 keeps personal data minimal and has no free-text chat.

## Core gameplay and battle mechanics

Both players race through the same question list, and every correct answer is an attack on the opponent. A battle ends when one player hits 0 HP or the 90-second timer runs out.

&#91;embedded content: battle loop · one question cycle\]

A wrong answer loops back after a short stun; a correct one lands a hit, then the game checks for a knockout.

### Battle rules (starting values, tune in playtests)

| Rule | Starting value |
| --- | --- |
| HP per player | 100 |
| Damage per correct answer | 10 |
| Speed bonus (answer under 3 s) | +5 damage |
| Combo (3 correct in a row) | Next hit deals double damage |
| Wrong answer | 1-second input lock, combo resets |
| Battle length | 90 seconds |
| Timer runs out | Higher HP wins; equal HP is a draw |

### Why race mode

Battles use race mode (decided): each player answers the same seeded questions at their own pace, so network lag never decides who got there first. The alternative is buzzer mode: one shared question, and the first correct answer attacks. Buzzer mode was ruled out because it punishes players on slower connections.

### Answer input

Players type answers on a numeric keypad instead of picking from multiple choice. Typing blocks lucky guesses and rewards real calculation. Multiple choice for very young players can come later.

Question difficulty follows the player's arena (see Question generator), so a new player never meets multiplication in their first match.

## Matchmaking: random and invite code

Players tap one button for a random opponent near their trophy count, or share a 6-character code to fight a specific friend.

| Aspect | Random battle | Invite by code |
| --- | --- | --- |
| How it starts | Tap Battle on Home | Host taps Create room; friend taps Join with code |
| Who you face | An online player within ±100 trophies; the range widens by 50 every 5 s | The friend who enters your code |
| Code or link | None | 6 characters (e.g. K7M2QX) plus a share link |
| Trophies | Yes, win or lose | No, friendly match |
| Rematch | Offered to both; starts if both accept | The same room stays open |
| If nothing happens | After 30 s, offer practice vs a bot (clearly labelled, no trophies) | Room expires after 10 min idle |

Codes skip look-alike characters (0/O, 1/I/L), so they are easy to read aloud. The share button opens the phone's share sheet, so the code can go to any messaging app. Friendly matches never give trophies, which stops friends from trading wins.

## Trophies and arenas

A win earns +30 trophies and a loss costs −20, adjusted by up to ±10 when the opponent is far above or below you. A draw changes nothing.

| Arena | Trophies | Math unlocked |
| --- | --- | --- |
| 1 · Counting Camp | 0–299 | Addition and subtraction up to 20 |
| 2 · Plus Plains | 300–699 | Addition and subtraction up to 100 |
| 3 · Times Tower | 700–1,199 | Multiplication and division tables up to 12 |
| 4 · Mixed Mountain | 1,200–1,799 | All four operations with brackets |
| 5 · Power Peak | 1,800+ | Powers, square roots, negatives, order of operations |

Players never drop below the start of an arena they have reached, so a bad day can't undo their progress. When two players come from different arenas, questions come from the lower arena. Arena names and ranges are placeholders to tune after beta.

## Question generator

Questions are built on the fly from random numbers, so there is no question database to write or store. The server builds each question from the match seed: both players get the same question, and the server can rebuild it to check answers.

### How one question is built

1. Seed a random-number generator with the match seed plus the question number.
2. Pick how many terms the question has, from the arena's range.
3. Pick each number and operator using the arena's rules (table below).
4. Apply the safety rules: division only when it comes out whole, no negative running totals before Power Peak, answer within the arena's limit.
5. Compute the answer with normal order of operations. If any rule fails, draw again.

Every answer is a whole number, so the keypad needs only digits, plus a minus key in Power Peak.

### Difficulty inside an arena

Numbers grow smoothly as a player climbs through an arena, instead of jumping at each boundary. The largest number allowed is:

```latex
N_{max} = \operatorname{round}\left(N_{low} + p \times (N_{high} - N_{low})\right), \qquad p = \frac{T - T_{start}}{T_{end} - T_{start}}
```

T is the player's trophy count and T\_start to T\_end is the arena's trophy range, so p runs from 0 at the arena's start to 1 at its end. When two players from different arenas meet, the lower trophy count sets T.

### Rules per arena

| Arena | Terms | Operators | Number range (N\_low → N\_high) | Answer limit | Example |
| --- | --- | --- | --- | --- | --- |
| 1 · Counting Camp | 2 | + − | 1–10 → 1–20 | 0 to 40 | 10 + 10 = 20 |
| 2 · Plus Plains | 3–4 | + − | 1–15 → 1–30 | 0 to 100 | 10 + 12 + 2 − 10 = 14 |
| 3 · Times Tower | 2–3 | × ÷ with + − | × ÷: 2–9 → 2–12; + −: up to 50 | 0 to 200 | 7 × 8 − 12 = 44 |
| 4 · Mixed Mountain | 3–4 | + − × ÷ and brackets | × ÷: 2–12 → 2–15; + −: up to 100 | 0 to 999 | (24 + 16) ÷ 8 × 3 = 15 |
| 5 · Power Peak | 3–4 | All, plus squares, square roots, negatives | × ÷: 2–15 → 2–20; + −: −100 to 100 | −999 to 9,999 | 12² − 45 ÷ 5 × 3 = 117 |

Square roots only appear on perfect squares (such as √144), which keeps every answer whole.

## Screens and user flow

A new player is in a random battle within three taps of opening the app: confirm a nickname, tap Battle, wait for a match.

&#91;embedded content: app flow · 9 screens, 2 ways into a battle\]

Both entry paths lead to the same Battle screen; Profile and Settings open from Home and are left out of the picture.

### Young players (under 18)

First launch asks for the player's birth year. Players 18 and over continue as shown above.

Players under 18 get offline practice against the bot straight away, with no account and no data collected. Online battles and trophies unlock once a parent enters their email address and confirms a 6-digit code sent to it. Email is free to send and needs no sender registration; WhatsApp or SMS codes can be added later if too few parents finish by email. This follows PP Tunas (see Technical requirements).

## Functional requirements

Ten P0 requirements define the MVP; P1 ships before soft launch and P2 after it.

| ID | Area | Requirement | Priority |
| --- | --- | --- | --- |
| FR-01 | Account | Guest play with an auto-generated nickname; optional Google or Apple sign-in to save progress | P0 · MVP |
| FR-02 | Matchmaking | Random 1v1 matchmaking by trophy range, widening over time | P0 · MVP |
| FR-03 | Matchmaking | Create a private room with a 6-character code and a share button | P0 · MVP |
| FR-04 | Matchmaking | Join a room by typing its code | P0 · MVP |
| FR-05 | Battle | Real-time battle screen: both HP bars, question, numeric keypad, hit animations | P0 · MVP |
| FR-06 | Battle | Same seeded question list for both players, generated and checked on the server | P0 · MVP |
| FR-07 | Battle | Reconnect within 15 s after a drop; otherwise the match counts as a loss | P0 · MVP |
| FR-08 | Progression | Trophy gain and loss, arena unlocks and arena floors | P0 · MVP |
| FR-09 | Platform | Analytics events for battles, matchmaking and invites, stored in our own Postgres; crash reports via Sentry with personal data removed | P0 · MVP |
| FR-20 | Account | Birth-year check at first launch; under-18 players get offline practice only until a parent approves online play with a code sent to their email | P0 · MVP |
| FR-10 | Account | Pick grade or skill level at first launch to set starting difficulty | P1 · Before launch |
| FR-11 | Matchmaking | Join a room by tapping an invite link | P1 · Before launch |
| FR-12 | Matchmaking | Rematch with the same opponent | P1 · Before launch |
| FR-13 | Matchmaking | Practice vs a labelled bot while waiting, no trophies | P1 · Before launch |
| FR-14 | Battle | Speed bonus and combo attacks | P1 · Before launch |
| FR-15 | Progression | Player profile: trophies, win rate, best streak | P1 · Before launch |
| FR-16 | Platform | Sound, haptics and settings | P1 · Before launch |
| FR-17 | Battle | Preset emotes during battle (no free chat) | P2 · Later |
| FR-18 | Progression | Global and friends leaderboards | P2 · Later |
| FR-19 | Progression | Cosmetic colour themes and shape skins | P2 · Later |

## Technical and non-functional requirements

The server, not the phone, decides every question, answer and hit, so a modified app cannot fake a win.

- **Server-authoritative battles.** The server generates the seeded question list, checks each answer and applies damage. The phone only sends typed answers.
- **Real-time connection.** Two backend services from day one: an API for accounts, profiles and trophies, and a game server for matchmaking and battles over WebSockets (Colyseus proposed). Both run on one rented server (VPS) with Docker Compose at launch and share Postgres and Redis.
- **Latency.** Host the VPS in Jakarta or Singapore, close to Indonesian players, targeting under 150 ms round trip. Race mode keeps lag from deciding hits.
- **Disconnects.** A dropped player has 15 seconds to reconnect and resume. The battle does not freeze: the opponent keeps answering and hitting in the meantime. After that, or on quitting, the match counts as a loss.
- **Anti-cheat.** Flag accounts that answer at inhuman speed again and again (for example, under 300 ms) for review. Rate-limit answers per second.
- **App.** One React Native codebase built with Expo (dev builds, EAS Build for store builds), launching on Android and iOS together. Battle animations with Reanimated and Skia. The server turns away outdated app versions with an update prompt.
- **Privacy and safety.** Players pick from generated nicknames (no typing), no free-text chat, minimal personal data. Follow app-store family policies and Indonesian law: the Personal Data Protection Law (UU PDP) and PP 17/2025 (PP Tunas). PP Tunas covers online games, requires age checks and parental consent for children's accounts, and bans profiling children for commercial purposes. Games published in Indonesia also need an Indonesia Game Rating System (IGRS) age label.
- **Performance.** Smooth 60 fps battles on mid-range Android phones.

* **Language.** Bahasa Indonesia at launch, with English as the second language.

Sources for the Indonesian rules: [PP Tunas summary (Kemendikdasmen)](https://pkplk.kemendikdasmen.go.id/menjaga-ruang-aman-digital-anak-apa-itu-pp-tunas/) · [PP Tunas and IGRS (ANTARA)](https://www.antaranews.com/berita/5318503/menciptakan-ruang-digital-yang-ramah-untuk-anak-melalui-pp-tunas?page=all). Confirm the details with a local lawyer before launch.

## Monetization

Ads are the likely revenue model, shown only outside battles so they never interrupt a fight.

- **Rewarded ads (opt-in).** Watch an ad to unlock a colour theme or shape skin early.
- **Interstitial ads.** At most one after every 3 battles, never between a battle and its rematch.
- **Remove-ads purchase.** A one-time purchase, added later if players ask for it.
- **Kids and ads.** Because children play, use a family-certified ad network and no personalised ads for anyone under 18 (PP Tunas bans profiling children for commercial purposes), following Google Play and App Store rules for kids' apps.

## Success metrics

Launch succeeds if players come back the next day and matches start fast. The targets below are proposals for the soft launch.

| Metric | Target | Why it matters |
| --- | --- | --- |
| Day-1 retention | 35%+ | Players enjoyed the first session |
| Day-7 retention | 12%+ | The trophy loop holds interest |
| Battles per daily player | 5+ | Battles are fun enough to repeat |
| Median wait for a random match | Under 15 s | Waiting kills a quick-play game |
| Invite rooms where the friend joins | 60%+ | The code flow is easy |
| Battles ending in a disconnect | Under 3% | The network layer is stable |
| Crash-free sessions | 99.5%+ | Basic quality bar |
| Under-18 players whose parent unlocks online play | 40%+ | The consent step isn't losing young players |

## MVP scope and roadmap

The MVP is 1v1 random and invite-code battles with trophies and three arenas, targeted for week 12. The timeline assumes a team of 2–3 people; adjust once the team is set.

&#91;embedded content: roadmap · 4 phases, 3 gates\]

The prototype tests whether math fights are fun before any server work; its question generator and offline bot carry straight into the MVP. Every P0 requirement is in the MVP; P1 lands before soft launch and P2 during Growth.

## Risks and open questions

The biggest launch risk is an empty queue: with few players online, random matches take too long and players leave.

| Risk | Mitigation |
| --- | --- |
| Too few players online at launch | Soft launch in one region; push invite codes; labelled bot practice while waiting |
| Lag makes fights feel unfair | Race mode, regional servers, server-side timing |
| Cheating with calculators or scripts | Time pressure, server checks, speed-anomaly flags |
| Mismatched ages or skill | Trophy-based arenas; level chosen at first launch |
| Child safety and privacy | No free chat, generated nicknames only, minimal data; age check and parental consent (PP Tunas); IGRS age label |

### Open questions

- [x] Battle mode: race mode
- [x] Question source: generated from random numbers per arena, no database
- [x] Friendly (code) matches award trophies? No
- [x] Main age group: all ages
- [x] Monetization: ads (see Monetization)
- [x] App framework: React Native with Expo (dev builds)
- [x] Backend: separate API and game server from day one
- [x] Launch platforms: Android and iOS together
- [x] Launch country: Indonesia, on one rented VPS in Jakarta or Singapore
- [x] Art style: abstract
- [x] Young players (PP Tunas): offline practice first; a parent unlocks online play
- [x] AI: no AI model in the MVP; revisit after launch
- [x] Game name: MathGo; app store name: MathGo Battle
- [ ] Trademark search for "MathGo" in Indonesia's PDKI database before investing in branding
- [ ] Local lawyer confirms the PP Tunas and IGRS requirements before launch
