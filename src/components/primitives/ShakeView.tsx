import React, { memo, useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useHaptics } from '@/hooks/useHaptics';

export interface ShakeViewProps {
  /** Bump this value every time a new error should trigger the shake. */
  shakeKey: string | number | null | undefined;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  haptic?: boolean;
}

// Error feedback: a horizontal shake + Haptics.Error, per CLAUDE.md Phase 20
// (FEEDBACK). Reduce-motion collapses the shake to nothing — the haptic
// still fires since that's tactile, not visual, motion.
function ShakeViewImpl({
  shakeKey, style, children, haptic = true,
}: ShakeViewProps) {
  const reduceMotion = useReduceMotion();
  const haptics = useHaptics();
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (shakeKey == null) return;
    if (haptic) haptics.error();
    if (reduceMotion) return;
    translateX.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shakeKey]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[style, shakeStyle]}>
      {children}
    </Animated.View>
  );
}

export const ShakeView = memo(ShakeViewImpl);
