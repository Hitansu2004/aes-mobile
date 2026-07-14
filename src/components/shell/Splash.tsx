import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Snowflake } from 'lucide-react-native';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Text } from '@/components/primitives/Text';

// Ported from ../../aes-frontend/src/components/rose/RoseSplash.js + the
// `.aes-splash*` block in ../../aes-frontend/src/app/globals.css.
export interface SplashProps {
  message?: string;
}

export function Splash({ message = 'Loading your workspace…' }: SplashProps) {
  const { tokens } = useTheme();
  const { isLarge } = useBreakpoint();
  const chipSize = isLarge ? 56 : 88;
  const iconSize = isLarge ? 24 : 36;

  const spin = useSharedValue(0);
  const pulse = useSharedValue(0.6);
  const sweep = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true);
    if (!isLarge) {
      sweep.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, false);
    }
  }, [spin, pulse, sweep, isLarge]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (sweep.value * 2 - 1) * 60 }],
  }));

  return (
    <View style={[styles.root, { backgroundColor: tokens.colors.surface }]} accessibilityRole="progressbar" accessibilityLabel={message}>
      <LinearGradient
        colors={[tokens.gradients.splash[0], tokens.gradients.splash[1]]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[styles.glow, { backgroundColor: tokens.colors.secondary }]} />

      <View style={styles.inner}>
        <View
          style={[
            styles.chip,
            {
              width: chipSize,
              height: chipSize,
              borderRadius: 24,
              backgroundColor: tokens.colors.primary,
              borderColor: tokens.colors.secondary,
            },
          ]}
        >
          <Animated.View style={spinStyle}>
            <Snowflake size={iconSize} strokeWidth={2.4} color={tokens.colors.secondary} />
          </Animated.View>
        </View>

        <View style={styles.cluster}>
          <Text
            style={{
              fontFamily: font('display', 600),
              fontSize: isLarge ? 20 : 28,
              letterSpacing: 0.08 * (isLarge ? 20 : 28),
              textTransform: 'uppercase',
              color: tokens.colors.secondaryInk,
            }}
          >
            {isLarge ? 'ARIAL ENGINEERING' : 'Arial Engineering'}
          </Text>

          <Animated.Text
            style={[
              pulseStyle,
              {
                fontFamily: font('mono', 500),
                fontSize: 11,
                letterSpacing: 0.1 * 11,
                textTransform: 'uppercase',
                color: tokens.colors.onSurfaceVariant,
              },
            ]}
          >
            {message}
          </Animated.Text>

          {!isLarge && (
            <View style={[styles.barTrack, { backgroundColor: tokens.colors.outlineVariant }]}>
              <Animated.View style={[styles.barTrack, styles.barFill, sweepStyle]}>
                <LinearGradient
                  colors={['transparent', tokens.colors.secondary, 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 420,
    height: 420,
    borderRadius: 9999,
    opacity: 0.14,
  },
  inner: {
    alignItems: 'center',
    gap: 20,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cluster: {
    alignItems: 'center',
    gap: 12,
  },
  barTrack: {
    width: 120,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
  },
});
