import React, { useEffect } from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { Moon, Sun } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives';
import { font } from '@/theme/typography';

// Ported from ../../aes-frontend/src/components/ui/ThemeToggle.js. MOTION:
// the icon rotates 180° and cross-fades on toggle (web just swaps the icon).
export type ThemeToggleVariant = 'round' | 'onNavy' | 'default';

export interface ThemeToggleProps {
  variant?: ThemeToggleVariant;
  style?: StyleProp<ViewStyle>;
}

export function ThemeToggle({ variant = 'onNavy', style }: ThemeToggleProps) {
  const { tokens, resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    rotation.value = withTiming(rotation.value + 180, { duration: 260 });
    opacity.value = withTiming(0, { duration: 100 }, () => {
      opacity.value = withTiming(1, { duration: 160 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    opacity: opacity.value,
  }));

  let variantStyle: ViewStyle;
  if (variant === 'round') {
    variantStyle = {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: tokens.colors.borderLight,
      backgroundColor: tokens.colors.surfaceContainerLow,
    };
  } else if (variant === 'onNavy') {
    variantStyle = {
      width: 38,
      height: 38,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.08)',
    };
  } else {
    variantStyle = {
      height: 36,
      paddingHorizontal: 12,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 6,
      borderWidth: 1,
      borderColor: tokens.colors.borderLight,
      backgroundColor: tokens.colors.surfaceContainerLow,
    };
  }

  const iconColor = variant === 'onNavy' ? '#ffffff' : tokens.colors.onSurface;

  return (
    <Pressable
      onPress={toggleTheme}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={variant === 'default' ? 4 : 6}
      style={[
        { alignItems: 'center', justifyContent: 'center' },
        variantStyle,
        style,
      ]}
    >
      <Animated.View style={iconStyle}>
        {isDark ? <Sun size={16} color={iconColor} /> : <Moon size={16} color={iconColor} />}
      </Animated.View>
      {variant === 'default' && (
        <Text style={{
          fontFamily: font('body', 700), fontSize: 12, letterSpacing: 0.48, color: tokens.colors.onSurface,
        }}
        >
          {isDark ? 'Light' : 'Dark'}
        </Text>
      )}
    </Pressable>
  );
}
