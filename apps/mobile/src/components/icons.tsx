import Svg, { Path } from 'react-native-svg';

// Line icons from the design's Visual language board (24 × 24, round caps).

export function DeleteIcon({ color, size = 26 }: { color: string; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M9 5h10.5A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7z" />
      <Path d="M12.5 9.5l5 5" />
      <Path d="M17.5 9.5l-5 5" />
    </Svg>
  );
}

export function SwordIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
      <Path d="M13 19l6-6" />
      <Path d="M16 16l4 4" />
      <Path d="M19 21l2-2" />
    </Svg>
  );
}
