// Motion tokens (GF-01; docs: "Game feel" tab, Motion rules). Every animation takes its numbers
// from here. Effects grow with the size of the moment; the strongest stay rare.

export const motion = {
  /** Durations in ms. */
  duration: {
    /** Key and button press feedback. */
    tap: 100,
    /** Badges, chips, a new question. */
    small: 200,
    /** Cards, overlays, screen transitions. */
    medium: 300,
    /** The design's mbPop: hits, combo, countdown. */
    pop: 350,
    /** Count-ups, confetti, the arena unlock. */
    celebration: 900,
    /** Under Reduce Motion: entrances become fades this long or shorter. */
    reducedFade: 150,
  },
  /** Every button and key: sink to this scale, spring back with a small overshoot (GF-02). */
  press: { scale: 0.94, spring: { damping: 14, stiffness: 420, mass: 0.6 } },
  /** Your shape travelling to the rival, on an arc (GF-03). */
  attackFlightMs: 240,
  /** Freeze at impact (GF-03). The KO value is the cap. */
  hitStopMs: { normal: 70, big: 110, ko: 300 },
  /** Shake in points, settling in `settleMs` (GF-03). Big shake only on a combo hit or a KO. */
  shake: { normal: 3, big: 6, ko: 10, settleMs: 250 },
  /** The HP chunk just lost: holds, then drains (GF-04). */
  damageGhost: { holdMs: 250, drainMs: 400 },
  /** WCAG 2.3.1: nothing flashes more often than this. */
  maxFlashesPerSecond: 3,
} as const;
