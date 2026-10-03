import type { ArenaId } from '@mathgo/game-core';
import type { TextStyle, ViewStyle } from 'react-native';

// Design tokens from the final design (docs/Math Battle UI.html, "Visual language" board, S1-07).
// Screens use these only: ESLint refuses colour values anywhere else in src/.

export const colors = {
  /** You, primary actions. White text on it: 4.6:1. */
  blue: '#1D6CF5',
  blueBase: '#1450C8',
  bluePressed: '#1558D6',
  blueTrack: '#E3EAFB',
  /** The rival, the Battle button. Ink text on it only. */
  orange: '#FFAA2C',
  orangeBase: '#E08A00',
  orangeTrack: '#F4EADB',
  /** Friends and rooms. White text on it: 5:1. */
  violet: '#5F5AEE',
  violetBase: '#3F39C9',
  /** Question and result panels. */
  night: '#16151F',
  nightRaised: '#2D2C45',
  nightMuted: '#B8BAD6',
  /** Soft white circles on the coloured Home cards. */
  glow: 'rgba(255, 255, 255, 0.10)',
  glowStrong: 'rgba(255, 255, 255, 0.22)',
  /** The arena card's progress track. */
  trackOnBlue: 'rgba(255, 255, 255, 0.28)',
  /** Pills and dashed lines on the night panel. */
  nightPill: '#2A2940',
  /** Text on orange tiles that isn't the main number. */
  orangeDeep: '#5A3300',
  crownBase: '#D98300',
  /** Headings and body text. */
  ink: '#1B1A33',
  /** Captions: 5.4:1 on the ground. */
  ink2: '#5E6078',
  inkFaint: '#8C8FB0',
  /** The "?" in an empty answer field. */
  placeholder: '#C3C7DF',
  /** Screen background. */
  ground: '#EEF0FA',
  /** Cards, keys, buttons. */
  white: '#FFFFFF',
  surfaceSoft: '#F4F5FC',
  line: '#E1E5F7',
  /** The 3D base under white keys and buttons. */
  keyBase: '#D3D8F0',
  keyDeleteBase: '#C5CCEA',
  /** Stat tiles. */
  mint: '#DDF2DA',
  peach: '#FFE4CC',
  sky: '#DCE8FE',
  lilac: '#E4E3FF',
  /** Battle timer ring: track, and the last 10 seconds. */
  timerTrack: '#DCE0F5',
  timerWarning: '#FF8A00',
  /** An unlit combo flame on the night panel. */
  comboOff: '#3A3953',
  /** The damage burst: yellow when you hit, pink when you're hit. */
  hit: '#FFD23F',
  hitTaken: '#FF8FB5',
  /** Text on light orange tiles; the "Knocked Out" title. */
  orangeInk: '#A85200',
  /** Behind the end-of-battle card. */
  nightScrim: 'rgba(22, 21, 31, 0.74)',
  /** "Oops! Locked for 1 second". */
  danger: '#D2336C',
  /** "Room found". */
  success: '#1F6E33',
  scrim: 'rgba(238, 240, 250, 0.88)',
  shadow: 'rgba(40, 44, 110, 0.07)',
} as const;

/** Shape fighters: a face colour, a darker base 5 px below it, one light highlight stroke. */
export const shapes = {
  triangle: { face: '#2F7BFF', base: '#1449B8', highlight: '#A9CCFF', tile: colors.sky },
  circle: { face: '#FFAA2C', base: '#D97800', highlight: '#FFE2B0', tile: '#FFE6C7' },
  square: { face: '#6C66F5', base: '#3F39C9', highlight: '#CBC8FF', tile: colors.lilac },
  hexagon: { face: '#2CC07E', base: '#15935A', highlight: '#B4F0D2', tile: colors.mint },
  star: { face: '#FF5C93', base: '#D2336C', highlight: '#FFC2D6', tile: '#FFE0EB' },
} as const;

export type ShapeName = keyof typeof shapes;

/**
 * Arena themes (S5-10, design: 22 Arena themes). Each arena keeps its Trophy Road emblem's
 * colour family: Home's arena card (white text on `card`), the battle screen's `ground`, and the
 * arena chip on the question panel (ink text on `chip`). You stay blue and the rival orange.
 */
export const arenaThemes = {
  1: {
    card: '#11804D',
    sparkle: '#9BE3BE',
    ground: '#E8F5EC',
    chip: colors.mint,
    emblem: { sun: '#FFAA2C', face: '#2CC07E', base: '#15935A', highlight: '#B4F0D2' },
  },
  2: {
    card: '#B35C00',
    sparkle: '#FFD39E',
    ground: '#FBEFE3',
    chip: colors.peach,
    emblem: { far: '#FFC27F', near: '#FFAA2C', base: '#E08A00', plus: colors.white },
  },
  3: {
    card: colors.blue,
    sparkle: '#9CC4FF',
    ground: colors.ground,
    chip: colors.sky,
    emblem: {
      bottom: '#FFAA2C',
      bottomBase: '#D98300',
      middle: '#6C66F5',
      middleBase: '#3F39C9',
      top: colors.white,
      topBase: '#0F3E9E',
      topMark: colors.blue,
      middleMark: colors.white,
      bottomMark: colors.ink,
    },
  },
  4: {
    card: '#3F39C9',
    sparkle: '#B7B4FF',
    ground: '#ECEBFD',
    chip: colors.lilac,
    emblem: { face: '#8D88FF', base: '#1F1A8C', snow: colors.white, brackets: '#FFAA2C' },
  },
  5: {
    card: colors.night,
    sparkle: '#FFD23F',
    ground: '#E7E7F0',
    chip: '#FFD23F',
    emblem: { face: '#FFAA2C', base: '#B86400', root: colors.night, star: '#FFD23F' },
  },
} as const satisfies Record<
  ArenaId,
  { card: string; sparkle: string; ground: string; chip: string; emblem: Record<string, string> }
>;

/** Font families as loaded by useAppFonts(). Each weight is its own family on Android. */
export const fonts = {
  display: 'Baloo2_800ExtraBold',
  displayBold: 'Baloo2_700Bold',
  body: 'Nunito_700Bold',
  bodySemibold: 'Nunito_600SemiBold',
  bodyHeavy: 'Nunito_800ExtraBold',
  label: 'Nunito_900Black',
} as const;

/** Type scale: size / line height from the design. Body text is never lighter than 600. */
export const typography = {
  wordmark: { fontFamily: fonts.display, fontSize: 64, lineHeight: 64, letterSpacing: -1 },
  headline: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.5 },
  cardTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  button: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24 },
  /** Questions and big stats: 34–52 by length, with tight line height. */
  question: { fontFamily: fonts.display, fontSize: 44, lineHeight: 48, letterSpacing: -0.5 },
  stat: { fontFamily: fonts.display, fontSize: 31, lineHeight: 34 },
  bodyLarge: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  /** Small caps labels: YOU, RIVAL, COMBO, ARENA 3. */
  label: {
    fontFamily: fonts.label,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
} as const satisfies Record<string, TextStyle>;

/** Spacing on the design's 2 px grid. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  /** Keypad keys. */
  key: 18,
  card: 30,
  pill: 999,
} as const;

/** Touch targets: at least 44 pt (S2-07), buttons 56. */
export const sizes = {
  touch: 44,
  button: 56,
  /** Keypad keys and the answer field's sign button. */
  key: 56,
  answerField: 72,
} as const;

/** Raised look: a solid base under the face, and a soft drop for cards. */
export const shadows = {
  card: { boxShadow: `0 14px 30px ${colors.shadow}` },
  raised: (base: string, depth = 6): ViewStyle => ({ boxShadow: `0 ${depth}px 0 ${base}` }),
} as const;
