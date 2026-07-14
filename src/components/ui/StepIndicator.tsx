import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives';
import { radius, space } from '@/theme/spacing';
import { font } from '@/theme/typography';

// Ported from ../../aes-frontend/src/components/ui/StepIndicator.js. Web
// snaps the fill width via a CSS transition; mobile glides it with
// Reanimated withSpring on every step change — a deliberate motion upgrade.
export interface StepIndicatorProps {
  current: number;
  total: number;
}

export function StepIndicator({ current, total }: StepIndicatorProps) {
  const { tokens } = useTheme();
  const pct = Math.min(100, Math.max(0, (current / total) * 100));
  const width = useSharedValue(pct);

  useEffect(() => {
    width.value = withSpring(pct, { damping: 18, stiffness: 180 });
  }, [pct, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View
      accessibilityLabel={`Step ${current} of ${total}`}
      style={{ alignItems: 'flex-end', gap: 6 }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 4,
          paddingVertical: 6,
          paddingHorizontal: 12,
          backgroundColor: tokens.colors.surfaceContainer,
          borderRadius: radius.full,
        }}
      >
        <Text style={{ fontFamily: font('body', 700), fontSize: 12, color: tokens.colors.primaryDark }}>
          {current}
        </Text>
        <Text style={{ fontFamily: font('body', 500), fontSize: 12, color: tokens.colors.onSurfaceVariant }}>
          {`of ${total}`}
        </Text>
      </View>

      <View
        style={{
          width: 80,
          height: 3,
          backgroundColor: tokens.colors.surfaceContainer,
          borderRadius: radius.full,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[{ height: '100%', backgroundColor: tokens.colors.secondary }, fillStyle]}
        />
      </View>
    </View>
  );
}
