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

export function TrophyIcon({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6.5 3.5h11V9a5.5 5.5 0 0 1-11 0V3.5z" fill={color} />
      <Path
        d="M17.5 5.5h2a1.5 1.5 0 0 1 1.5 1.5c0 2.6-1.8 4.6-4.2 5M6.5 5.5h-2A1.5 1.5 0 0 0 3 7c0 2.6 1.8 4.6 4.2 5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path d="M12 14.5v4" stroke={color} strokeWidth={2.2} />
      <Path d="M8 21h8" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export function FlameIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 22c4.2 0 7-2.8 7-6.9 0-3.2-2-5.4-3.4-7-.3 1.7-1.2 2.9-2.3 3.3.3-3-.9-6.4-3.6-8.4 0 3-1.6 4.9-3.1 6.6C5.2 11.3 5 13 5 15.1 5 19.2 7.8 22 12 22z"
        fill={color}
      />
    </Svg>
  );
}

export function FlagIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M5 21V4" />
      <Path d="M5 4.5h11.5l-2.5 4 2.5 4H5" />
    </Svg>
  );
}

export function LockIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <Path d="M8 10.5h8a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-4.5a3 3 0 0 1 3-3z" />
    </Svg>
  );
}

export function CrownIcon({
  fill,
  stroke,
  size = 40,
}: {
  fill: string;
  stroke: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3.5 8l4.5 4 4-6.5 4 6.5 4.5-4-1.8 10.5H5.3z"
        fill={fill}
        stroke={stroke}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function StarIcon({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"
        fill={color}
      />
    </Svg>
  );
}

export function CloseIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.6}
      strokeLinecap="round"
    >
      <Path d="M6 6l12 12" />
      <Path d="M18 6L6 18" />
    </Svg>
  );
}

export function AgainIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <Path d="M20 4v5h-5" />
    </Svg>
  );
}

export function HomeIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15V15H9v5.5H5.5A1.5 1.5 0 0 1 4 19z" />
    </Svg>
  );
}
