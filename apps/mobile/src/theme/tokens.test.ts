import { ARENAS } from '@mathgo/game-core';
import { arenaThemes, colors } from './tokens';

/** WCAG contrast ratio between two #RRGGBB colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('theme tokens (S1-07)', () => {
  it.each([
    ['white on blue', colors.white, colors.blue],
    ['white on violet', colors.white, colors.violet],
    ['ink on orange', colors.ink, colors.orange],
    ['ink 2 captions on the ground', colors.ink2, colors.ground],
    ['ink on the ground', colors.ink, colors.ground],
    ['white on night', colors.white, colors.night],
    ['danger on white', colors.danger, colors.white],
    ['success on mint', colors.success, colors.mint],
  ])('%s is readable (4.5:1 or more)', (_, text, background) => {
    expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('white on orange is not: the design uses ink text on orange only', () => {
    expect(contrast(colors.white, colors.orange)).toBeLessThan(4.5);
  });
});

describe('arena themes (S5-10)', () => {
  it('Done when: all 5 arenas have their theme', () => {
    expect(ARENAS.map((a) => a.id).every((id) => id in arenaThemes)).toBe(true);
    // Five different looks: no two arenas share a card or a ground.
    const themes = Object.values(arenaThemes);
    expect(new Set(themes.map((th) => th.card)).size).toBe(5);
    expect(new Set(themes.map((th) => th.ground)).size).toBe(5);
  });

  it.each(ARENAS.map((a) => [a.name, arenaThemes[a.id]] as const))(
    '%s: white on the card, ink on the chip and on the ground are readable',
    (_, theme) => {
      expect(contrast(colors.white, theme.card)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.ink, theme.chip)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.ink, theme.ground)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.ink2, theme.ground)).toBeGreaterThanOrEqual(4.5);
    },
  );
});
