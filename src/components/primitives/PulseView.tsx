import React, { memo, useEffect, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { useReduceMotion } from '@/hooks/useReduceMotion';

export interface PulseViewProps {
  /** Bump this value (e.g. a row's updatedAt or a counter) whenever a
   * WebSocket message mutates this row — the pulse fires on every change. */
  pulseKey: string | number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  radius?: number;
}

// A brief gold glow overlay, 600ms, fired whenever `pulseKey` changes — the
// "silent mutation is disorienting" rule from CLAUDE.md Phase 20 (LIVE DATA).
// Skips the mount fire (a row shouldn't glow just because it first rendered).
function PulseViewImpl({
  pulseKey, style, children, radius = 0,
}: PulseViewProps) {
  const { tokens } = useTheme();
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (reduceMotion) return;
    opacity.value = withSequence(
      withTiming(0.35, { duration: 120 }),
      withTiming(0, { duration: 480 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseKey]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={style}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius, backgroundColor: tokens.colors.secondary,
          },
          glowStyle,
        ]}
      />
    </View>
  );
}

export const PulseView = memo(PulseViewImpl);
