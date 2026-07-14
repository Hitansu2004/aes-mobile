import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle, useSharedValue, withSequence, withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { Text } from '@/components/primitives/Text';
import { isActive, type NavItem } from './nav';

// Ported from ../../aes-frontend/src/components/rose/RoseShell.js —
// `.bottomNav`/`.bottomNavItem` glass bottom nav, ≤768px only. Renders the
// first 4 items of the role's nav; the tab label is the first word only
// (`label.split(' ')[0]`), matching the web's truncation for narrow phones.
export interface BottomNavProps {
  items: NavItem[];
  pathname: string;
  onNavigate: (href: string) => void;
}

function Tab({ item, active, onPress }: { item: NavItem; active: boolean; onPress: () => void }) {
  const { tokens } = useTheme();
  const scale = useSharedValue(1);
  const Icon = item.icon;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      style={styles.item}
      onPress={() => {
        // A withSpring(...) completion callback that itself calls
        // withSpring(...) works fine on native, but react-native-web's
        // reanimated shim re-invokes that callback on every frame instead
        // of once at completion — each invocation schedules another
        // withSpring, whose own callback schedules another, unbounded,
        // until the call stack overflows. withSequence expresses the same
        // "bounce up, then settle back" as one worklet with no JS callback,
        // so it can't recurse on either platform.
        scale.value = withSequence(
          withSpring(1.15, { damping: 10, stiffness: 300 }),
          withSpring(1, { damping: 12, stiffness: 300 }),
        );
        Haptics.selectionAsync();
        onPress();
      }}
    >
      <Animated.View
        style={[
          styles.itemInner,
          animatedStyle,
          active && { backgroundColor: tokens.colors.secondarySoft },
        ]}
      >
        <Icon
          size={20}
          strokeWidth={active ? 2.2 : 1.7}
          color={active ? tokens.colors.secondaryInk : tokens.colors.onSurfaceVariant}
        />
        <Text
          numberOfLines={1}
          style={{
            fontFamily: font('mono', 500),
            fontSize: 10,
            letterSpacing: 0.04 * 10,
            color: active ? tokens.colors.secondaryInk : tokens.colors.onSurfaceVariant,
          }}
        >
          {item.label.split(' ')[0]}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function BottomNavImpl({ items, pathname, onNavigate }: BottomNavProps) {
  const { tokens, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const tabs = items.slice(0, 4);

  return (
    <BlurView
      intensity={40}
      tint={isDark ? 'dark' : 'light'}
      experimentalBlurMethod="dimezisBlurView"
      style={[
        styles.wrap,
        {
          paddingBottom: 6 + insets.bottom,
          backgroundColor: tokens.glass.bottomNav,
          borderTopColor: tokens.colors.outlineVariant,
        },
      ]}
    >
      {tabs.map((item) => (
        <Tab
          key={item.href}
          item={item}
          active={isActive(pathname, item.href)}
          onPress={() => onNavigate(item.href)}
        />
      ))}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: space[2],
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInner: {
    width: '100%',
    maxWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
  },
});

export const BottomNav = memo(BottomNavImpl);
