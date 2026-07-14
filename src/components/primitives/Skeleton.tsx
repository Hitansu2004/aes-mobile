import React, { memo, useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/theme/ThemeProvider';
import { radius as radiusScale } from '@/theme/spacing';

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
}

// Ports .skeleton: a left→right shimmer sweep, infinite, over
// surfaceContainer → surfaceContainerHigh → surfaceContainer.
function SkeletonImpl({ width = '100%', height = 16, radius = radiusScale.sm }: SkeletonProps) {
  const { tokens } = useTheme();
  const translateX = useSharedValue(-1);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.linear }),
      -1,
      false,
    );
  }, [translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${translateX.value * 100}%` }],
  }));

  return (
    <View
      style={{
        width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: tokens.colors.surfaceContainer,
      }}
    >
      <Animated.View style={[{ width: '200%', height: '100%' }, animatedStyle]}>
        <LinearGradient
          colors={[tokens.colors.surfaceContainer, tokens.colors.surfaceContainerHigh, tokens.colors.surfaceContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: '100%', height: '100%' }}
        />
      </Animated.View>
    </View>
  );
}

export const Skeleton = memo(SkeletonImpl);
