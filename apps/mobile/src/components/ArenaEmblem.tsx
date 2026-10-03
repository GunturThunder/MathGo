import type { ArenaId } from '@mathgo/game-core';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { arenaThemes } from '../theme';

// The arena emblems from the Trophy Road board (S5-10): a camp, hills, stacked blocks, a
// mountain and a peak. Drawn on a 72 × 72 grid.

export function ArenaEmblem({ arena, size }: { arena: ArenaId; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Emblem arena={arena} />
    </Svg>
  );
}

function Emblem({ arena }: { arena: ArenaId }) {
  switch (arena) {
    case 1: {
      const c = arenaThemes[1].emblem;
      return (
        <>
          <Circle cx={56} cy={16} r={7} fill={c.sun} />
          <Path
            d="M34 18L58 58H10Z"
            transform="translate(0 4)"
            fill={c.base}
            stroke={c.base}
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <Path
            d="M34 18L58 58H10Z"
            fill={c.face}
            stroke={c.face}
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <Path
            d="M34 36L42 58H26Z"
            fill={c.base}
            stroke={c.base}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path d="M29 27L21 41" stroke={c.highlight} strokeWidth={4} strokeLinecap="round" />
        </>
      );
    }
    case 2: {
      const c = arenaThemes[2].emblem;
      return (
        <>
          <Path d="M2 60Q22 30 42 60Z" fill={c.far} />
          <Path d="M24 62Q47 28 72 62Z" fill={c.near} />
          <Rect x={2} y={58} width={68} height={8} rx={4} fill={c.base} />
          <Path d="M16 12v12M10 18h12" stroke={c.plus} strokeWidth={4.5} strokeLinecap="round" />
          <Path d="M44 8v9M39.5 12.5h9" stroke={c.plus} strokeWidth={4} strokeLinecap="round" />
        </>
      );
    }
    case 3: {
      const c = arenaThemes[3].emblem;
      return (
        <>
          <Rect x={10} y={48} width={52} height={20} rx={6} fill={c.bottomBase} />
          <Rect x={10} y={44} width={52} height={20} rx={6} fill={c.bottom} />
          <Path
            d="M31.5 49.5l9 9M40.5 49.5l-9 9"
            stroke={c.bottomMark}
            strokeWidth={3.2}
            strokeLinecap="round"
          />
          <Rect x={16} y={29} width={40} height={17} rx={6} fill={c.middleBase} />
          <Rect x={16} y={25} width={40} height={17} rx={6} fill={c.middle} />
          <Path d="M30 33.5h12" stroke={c.middleMark} strokeWidth={3} strokeLinecap="round" />
          <Circle cx={36} cy={29.3} r={1.8} fill={c.middleMark} />
          <Circle cx={36} cy={37.7} r={1.8} fill={c.middleMark} />
          <Rect x={22} y={11} width={28} height={15} rx={5} fill={c.topBase} />
          <Rect x={22} y={7} width={28} height={15} rx={5} fill={c.top} />
          <Path
            d="M32.5 11l7 7M39.5 11l-7 7"
            stroke={c.topMark}
            strokeWidth={2.8}
            strokeLinecap="round"
          />
        </>
      );
    }
    case 4: {
      const c = arenaThemes[4].emblem;
      const mountain = 'M8 58L30 22L40 36L48 26L66 58Z';
      return (
        <>
          <Path
            d={mountain}
            transform="translate(0 4)"
            fill={c.base}
            stroke={c.base}
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <Path d={mountain} fill={c.face} stroke={c.face} strokeWidth={5} strokeLinejoin="round" />
          <Path
            d="M30 22L36.5 32.5L30 30L23.5 32.5Z"
            fill={c.snow}
            stroke={c.snow}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path
            d="M53 8Q47 15 53 22"
            fill="none"
            stroke={c.brackets}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <Path
            d="M61 8Q67 15 61 22"
            fill="none"
            stroke={c.brackets}
            strokeWidth={4}
            strokeLinecap="round"
          />
        </>
      );
    }
    case 5: {
      const c = arenaThemes[5].emblem;
      return (
        <>
          <Path
            d="M10 60L36 16L62 60Z"
            transform="translate(0 4)"
            fill={c.base}
            stroke={c.base}
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <Path
            d="M10 60L36 16L62 60Z"
            fill={c.face}
            stroke={c.face}
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <Path
            d="M26 44l4 6 7-17h11"
            fill="none"
            stroke={c.root}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M57 7l1.8 3.8 4.1.6-3 2.9.7 4.1-3.6-1.9-3.7 1.9.7-4.1-3-2.9 4.2-.6z"
            fill={c.star}
          />
        </>
      );
    }
  }
}
