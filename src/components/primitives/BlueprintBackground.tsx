import { StyleSheet } from 'react-native';
import Svg, {
  Defs, Line, Pattern, Rect, RadialGradient, Stop,
} from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

// Ports `.bg-blueprint` from globals.css: a fixed, non-interactive 32x32px
// grid of 1px gold lines plus a radial glow at the top-right. Pure texture —
// it should be barely visible sitting behind content, never a focal point.
export function BlueprintBackground() {
  const { tokens } = useTheme();

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      width="100%"
      height="100%"
    >
      <Defs>
        <Pattern id="blueprintGrid" width={32} height={32} patternUnits="userSpaceOnUse">
          <Line x1={0} y1={0} x2={32} y2={0} stroke={tokens.blueprint.line} strokeWidth={1} />
          <Line x1={0} y1={0} x2={0} y2={32} stroke={tokens.blueprint.line} strokeWidth={1} />
        </Pattern>
        <RadialGradient id="blueprintGlow" cx="100%" cy="0%" r="60%">
          <Stop offset="0%" stopColor={tokens.blueprint.lineStrong} stopOpacity={1} />
          <Stop offset="100%" stopColor={tokens.blueprint.lineStrong} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#blueprintGrid)" />
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#blueprintGlow)" />
    </Svg>
  );
}
