import React, { memo, useEffect } from 'react';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

export interface SpinnerProps {
  size?: 'sm' | 'md';
}

// Ports .spinner / .spinner-sm: a 3px (2px sm) ring, track surfaceContainerHigh,
// head secondary, rotating 360deg/0.8s linear, infinite.
function SpinnerImpl({ size = 'md' }: SpinnerProps) {
  const { tokens } = useTheme();
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 800, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const dimension = size === 'sm' ? 18 : 32;
  const borderWidth = size === 'sm' ? 2 : 3;

  return (
    <Animated.View
      style={[
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          borderWidth,
          borderColor: tokens.colors.surfaceContainerHigh,
          borderTopColor: tokens.colors.secondary,
        },
        animatedStyle,
      ]}
    />
  );
}

export const Spinner = memo(SpinnerImpl);
