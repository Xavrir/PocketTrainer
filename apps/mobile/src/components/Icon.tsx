import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import { colors } from '../design/tokens';

export type IconName =
  | 'arrow-right'
  | 'back'
  | 'bell'
  | 'camera'
  | 'chart'
  | 'check'
  | 'chevron'
  | 'clock'
  | 'flame'
  | 'home'
  | 'learn'
  | 'lock'
  | 'pause'
  | 'person'
  | 'play'
  | 'shield'
  | 'spark'
  | 'stop';

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({
  name,
  size = 24,
  color = colors.text,
  strokeWidth = 1.9,
}: IconProps) {
  const shared = {
    fill: 'none',
    stroke: color,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth,
  };
  const glyph = (() => {
    switch (name) {
      case 'home':
        return (
          <>
            <Path {...shared} d="M3.5 10.8 12 3.7l8.5 7.1" />
            <Path {...shared} d="M5.7 9.4v10.1h12.6V9.4M9.3 19.5v-6h5.4v6" />
          </>
        );
      case 'learn':
        return (
          <>
            <Path
              {...shared}
              d="M4 5.5c3.2-.8 5.9-.1 8 2.2v12c-2.1-2.3-4.8-3-8-2.2z"
            />
            <Path
              {...shared}
              d="M20 5.5c-3.2-.8-5.9-.1-8 2.2v12c2.1-2.3 4.8-3 8-2.2z"
            />
          </>
        );
      case 'camera':
        return (
          <>
            <Rect {...shared} x="3" y="6.5" width="18" height="13" rx="3" />
            <Path {...shared} d="m8 6.5 1.4-2h5.2l1.4 2" />
            <Circle {...shared} cx="12" cy="13" r="3.3" />
          </>
        );
      case 'chart':
        return (
          <>
            <Path {...shared} d="M4 19.5V11m5.3 8.5V5m5.4 14.5v-6m5.3 6V8" />
          </>
        );
      case 'person':
        return (
          <>
            <Circle {...shared} cx="12" cy="8" r="3.5" />
            <Path {...shared} d="M5.2 20c.7-4.1 3-6.1 6.8-6.1s6.1 2 6.8 6.1" />
          </>
        );
      case 'bell':
        return (
          <>
            <Path
              {...shared}
              d="M6.5 17.2h11l-1.4-2.1V10a4.1 4.1 0 0 0-8.2 0v5.1z"
            />
            <Path {...shared} d="M10 19.3a2.3 2.3 0 0 0 4 0" />
          </>
        );
      case 'arrow-right':
        return (
          <>
            <Line {...shared} x1="5" y1="12" x2="19" y2="12" />
            <Polyline {...shared} points="14,7 19,12 14,17" />
          </>
        );
      case 'back':
        return (
          <>
            <Line {...shared} x1="19" y1="12" x2="5" y2="12" />
            <Polyline {...shared} points="10,7 5,12 10,17" />
          </>
        );
      case 'chevron':
        return <Polyline {...shared} points="9,5 16,12 9,19" />;
      case 'check':
        return <Polyline {...shared} points="5,12 10,17 19,7" />;
      case 'lock':
        return (
          <>
            <Rect {...shared} x="5" y="10" width="14" height="10" rx="2.5" />
            <Path {...shared} d="M8 10V7.5a4 4 0 0 1 8 0V10" />
          </>
        );
      case 'clock':
        return (
          <>
            <Circle {...shared} cx="12" cy="12" r="8.5" />
            <Path {...shared} d="M12 7v5l3.2 2" />
          </>
        );
      case 'shield':
        return (
          <>
            <Path
              {...shared}
              d="M12 3.3 19 6v5.2c0 4.5-2.8 7.8-7 9.5-4.2-1.7-7-5-7-9.5V6z"
            />
            <Polyline {...shared} points="8.5,12 10.8,14.3 15.7,9.4" />
          </>
        );
      case 'spark':
        return (
          <Path
            {...shared}
            d="m12 2 1.3 5.2L18 9.5l-4.7 2.3L12 17l-1.3-5.2L6 9.5l4.7-2.3z"
          />
        );
      case 'flame':
        return (
          <Path
            {...shared}
            d="M13.8 3.2c.6 3-1.6 4.2-2.5 6.1-1-1.1-1.5-2.2-1.2-3.5-3.3 2.1-5 5-4.2 8.4.8 3.4 3.3 5.6 6.4 5.6 3.4 0 6-2.5 6-6.1 0-3.1-1.6-6.8-4.5-10.5Z"
          />
        );
      case 'pause':
        return (
          <>
            <Rect x="6.5" y="5" width="3.5" height="14" rx="1" fill={color} />
            <Rect x="14" y="5" width="3.5" height="14" rx="1" fill={color} />
          </>
        );
      case 'play':
        return <Path d="M8 5.5 19 12 8 18.5Z" fill={color} />;
      case 'stop':
        return <Rect x="6" y="6" width="12" height="12" rx="2" fill={color} />;
    }
  })();
  return (
    <Svg
      accessibilityElementsHidden
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {glyph}
    </Svg>
  );
}
