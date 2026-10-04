# Game feel

Oct 4, 2026 · @guntur

MathBattle should feel like a fighting game, not a quiz: every right answer is an attack the player sees land. This tab collects the research on game animation, sets MathBattle's motion rules, and plans the animation pass GF-01 to GF-07 (11 Mobile days).

## Research

Games feel alive when every input gets a fast, exaggerated, physical answer. The talks and studios below agree on a small set of techniques, and on using the biggest ones rarely.

| Technique | What it does | Numbers | Source |
| --- | --- | --- | --- |
| Juice | Little details and moments of surprise that answer every action | – | [Juice it or lose it](https://roblog.co.uk/2024/03/juicy-games/) |
| Hit-stop | Both sides freeze for a moment at impact, so the hit has weight | 60–90 ms; longer for bigger hits, with a cap | [Game feel on the web](https://valdemird.com/blog/game-feel-on-the-web/), [Sakurai](https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/) |
| Attacker shake | In Smash the attacker vibrates too, not only the one hit | – | [Sakurai](https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/) |
| Screen shake | A kick of the view, sized to the event | 3 sizes, about 600 ms; “a pixel or two goes a long way” | [Game feel on the web](https://valdemird.com/blog/game-feel-on-the-web/), [Art of Screenshake experiments](https://www.bluetengu.com/2014/12/12/art-of-screenshake-experiments/) |
| Squash and stretch | Shapes deform and keep their volume, so they feel soft and alive | about 420 ms, overshooting curve | [12 principles](https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation), [Game feel on the web](https://valdemird.com/blog/game-feel-on-the-web/) |
| Anticipation, follow-through | A wind-up before an action; parts settle after it stops | – | [12 principles](https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation) |
| Slow in, slow out; arcs | Motion eases in and out and travels on curves | – | [12 principles](https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation) |
| Particles | A burst of debris at impact | 8–40 pieces, 0.55–0.95 s life | [Game feel on the web](https://valdemird.com/blog/game-feel-on-the-web/) |
| Escalation | Streaks raise the size of effects; the strongest stay rare | shake only from tier 3 | [Game feel on the web](https://valdemird.com/blog/game-feel-on-the-web/) |
| Reduced motion | Interaction motion can be turned off; nothing flashes more than 3 times a second | WCAG 2.3.3 (AAA), 2.3.1 (A) | [W3C 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html), [W3C 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html) |
| On React Native | Reanimated follows the phone's Reduce Motion setting and jumps animations to their end | `ReduceMotion.System`, `useReducedMotion` | [Reanimated docs](https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/) |

One rule runs through all of them: “Juice is something you add on top of a thing that already works, never a load-bearing part” ([Game feel on the web](https://valdemird.com/blog/game-feel-on-the-web/)). The battle must stay fully playable with every effect off.

## Where MathBattle stands

The big moments already move: hits, the KO card and the trophy count. The gaps are in between. A right answer shows no attack travelling, damage snaps instead of draining, screens appear without transitions, and nothing follows the phone's Reduce Motion setting.

| Moment | Today | Gap |
| --- | --- | --- |
| Tap a key or button | Button sinks onto its base | No squash or spring back; keys feel flat |
| Right answer | Burst and damage number on the rival, rival card flinches | No attack travels from you to the rival; no hit-stop or shake |
| Wrong answer | Answer field shakes, lock badge pops | Fine; needs a Reduce Motion version |
| HP bar | Width eases to the new value | No “ghost” chunk showing the damage; no low-HP warning |
| New question | Text swaps instantly | No entrance, so questions blur together |
| Last 10 seconds | Timer ring turns orange | No pulse or tension |
| Combo | Flames pop as they light; “2×” badge pops | No payoff when the combo hit lands |
| KO and end | Dim, card pops, shapes rain on a win | No slow-motion KO; a loss has no own motion |
| Result screen | Trophy count-up, arena unlock pop | Tiles and podium appear all at once |
| Matchmaking, versus | Pulsing rings while searching | “Rival found” jumps straight into the 3-2-1; design board 05 Versus is not built |
| Home and screens | Static; default slide between screens | No entrance, no idle life on the arena card |
| Reduce Motion | Not supported | Every effect above needs an off or softer version |

## Motion rules

Every animation takes its numbers from one set of motion tokens in `apps/mobile/src/theme`, next to the colours. Effects grow with the size of the moment, and the strongest stay rare so they keep their meaning.

| Token | Value | Used for |
| --- | --- | --- |
| Tap | 100 ms | Key and button press feedback |
| Small | 200 ms | Badges, chips, a new question |
| Medium | 300 ms | Cards, overlays, screen transitions |
| Pop | 350 ms, overshoot to 112 % | The design's mbPop: hits, combo, countdown |
| Celebration | 900 ms | Count-ups, confetti, the arena unlock |
| Press spring | scale 0.94, spring back with a small overshoot | Every button and key |
| Attack flight | 240 ms on an arc | Your shape travelling to the rival |
| Hit-stop | 70 ms; 110 ms on a fast or combo hit; 300 ms on a KO (cap) | Freeze at impact, both cards |
| Shake | 3 / 6 / 10 pt, settles in 250 ms | Normal hit / combo hit / KO only |
| Damage ghost | holds 250 ms, drains in 400 ms | The HP chunk just lost |
| Easing | out-cubic to enter, in-quad to leave | Everything that is not a spring |

**Limits.**

- Nothing flashes more than 3 times a second (WCAG 2.3.1).
- Big shake only on a combo hit or a KO.
- Everything runs on the UI thread (Reanimated, Skia), and stays at 55 fps or better on the Galaxy A07 during a KO.

**Reduce Motion** (the phone's setting, plus a switch in Settings; WCAG 2.3.3):

- No shake, hit-stop, attack flight, slow motion or idle loops.
- Entrances become fades of 150 ms or less.
- Damage numbers, colours and haptics stay, so nothing a player needs is lost.

## The plan

Seven tasks, 11 Mobile days, tracked in the Sprint plan tab under “Game feel pass”. GF-01 goes first, because every other task builds on its tokens and its Reduce Motion switch.

1. **GF-01 Motion foundation:** the tokens above and Reduce Motion support.
2. **GF-02 Press feel:** every button and key squashes and springs back.
3. **GF-03 Attack and impact:** your answer flies to the rival and lands with hit-stop and shake.
4. **GF-04 HP and tension:** the damage ghost, the low-HP heartbeat, the last-10-seconds pulse, question entrances.
5. **GF-05 KO and results:** a slow-motion KO, motion for a loss, and results that arrive in order.
6. **GF-06 Versus and screens:** the versus intro from design board 05, screen transitions, Home coming alive.
7. **GF-07 Feel pass on phones:** tune with testers, measure frame rate, record the final values here.

Sound effects (FR-16) would multiply all of this, but they stay a P1 item after the MVP.

## Sources

Pages opened on Oct 4, 2026.

- [Juice it or lose it, by Martin Jonasson and Petri Purho](https://roblog.co.uk/2024/03/juicy-games/) (roblog)
- [Game feel on the web: squash, shake, and the art of juice](https://valdemird.com/blog/game-feel-on-the-web/)
- [Thinking About Hitstop, Sakurai's Famitsu column](https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/) (Source Gaming)
- [A few experiments based on Jan Willem Nijman's Art of Screenshake](https://www.bluetengu.com/2014/12/12/art-of-screenshake-experiments/) (Blue Tengu)
- [Twelve basic principles of animation](https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation), from The Illusion of Life by Frank Thomas and Ollie Johnston, 1981 (Wikipedia)
- [Understanding SC 2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) (W3C)
- [Understanding SC 2.3.1 Three Flashes or Below Threshold](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html) (W3C)
- [Reanimated: Accessibility](https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/) (Software Mansion)
