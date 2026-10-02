import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { shapes, type ShapeName } from '../theme';

// The design's shape fighters: a face, its darker base 5 px below, one highlight stroke.
// Players are shapes, never faces.

export function ShapeFighter({ shape, size }: { shape: ShapeName; size: number }) {
  const c = shapes[shape];
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {shape === 'triangle' ? (
        <>
          <Path
            d="M32 12L55 50H9Z"
            transform="translate(0 5)"
            fill={c.base}
            stroke={c.base}
            strokeWidth={10}
            strokeLinejoin="round"
          />
          <Path
            d="M32 12L55 50H9Z"
            fill={c.face}
            stroke={c.face}
            strokeWidth={10}
            strokeLinejoin="round"
          />
          <Path d="M28 23L18.5 40" stroke={c.highlight} strokeWidth={5} strokeLinecap="round" />
        </>
      ) : shape === 'circle' ? (
        <>
          <Circle cx={32} cy={35} r={25} fill={c.base} />
          <Circle cx={32} cy={30} r={25} fill={c.face} />
          <Path
            d="M17 25A16 16 0 0 1 28 14"
            fill="none"
            stroke={c.highlight}
            strokeWidth={5}
            strokeLinecap="round"
          />
        </>
      ) : shape === 'square' ? (
        <G transform="rotate(-8 32 32)">
          <Rect x={11} y={13} width={42} height={42} rx={12} fill={c.base} />
          <Rect x={11} y={8} width={42} height={42} rx={12} fill={c.face} />
          <Path d="M19 19V33" stroke={c.highlight} strokeWidth={5} strokeLinecap="round" />
        </G>
      ) : shape === 'hexagon' ? (
        <>
          <Path
            d="M32 9L52 20.5V41.5L32 53L12 41.5V20.5Z"
            transform="translate(0 5)"
            fill={c.base}
            stroke={c.base}
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <Path
            d="M32 9L52 20.5V41.5L32 53L12 41.5V20.5Z"
            fill={c.face}
            stroke={c.face}
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <Path d="M19 24V36" stroke={c.highlight} strokeWidth={5} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Path
            d="M32 8L39 23.3L55.8 25.3L43.4 36.7L46.7 53.2L32 45L17.3 53.2L20.6 36.7L8.2 25.3L25 23.3Z"
            transform="translate(0 4)"
            fill={c.base}
            stroke={c.base}
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <Path
            d="M32 8L39 23.3L55.8 25.3L43.4 36.7L46.7 53.2L32 45L17.3 53.2L20.6 36.7L8.2 25.3L25 23.3Z"
            fill={c.face}
            stroke={c.face}
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <Path d="M24.5 30L22.5 40" stroke={c.highlight} strokeWidth={4} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}
