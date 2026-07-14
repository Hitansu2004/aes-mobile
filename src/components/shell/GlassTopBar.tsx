import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, X } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { Text } from '@/components/primitives/Text';
import { NotificationBell } from './NotificationBell';
import type { Crumb } from './nav';

// Ported from ../../aes-frontend/src/components/rose/RoseShell.js —
// `.mobileNav`, ≤768/1023px sticky glass top app bar.
export interface GlassTopBarProps {
  isSubPage: boolean;
  parentLabel?: string;
  currentLabel: string;
  initials: string;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  onGoBack: () => void;
  onBrandPress: () => void;
}

function GlassTopBarImpl({
  isSubPage, parentLabel, currentLabel, initials, drawerOpen, onToggleDrawer, onGoBack, onBrandPress,
}: GlassTopBarProps) {
  const { tokens, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={40}
      tint={isDark ? 'dark' : 'light'}
      experimentalBlurMethod="dimezisBlurView"
      style={[
        styles.wrap,
        {
          height: 60 + insets.top,
          paddingTop: insets.top,
          backgroundColor: tokens.glass.header,
          borderBottomColor: tokens.colors.borderLight,
        },
      ]}
    >
      {isSubPage ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onGoBack}
          hitSlop={6}
          style={[styles.circleBtn, { backgroundColor: tokens.colors.secondarySoft }]}
        >
          <ArrowLeft size={20} color={tokens.colors.secondaryInk} />
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={drawerOpen ? 'Close menu' : 'Open menu'}
          onPress={onToggleDrawer}
          hitSlop={6}
          style={[styles.circleBtn, { backgroundColor: tokens.colors.secondary }]}
        >
          {drawerOpen ? (
            <X size={18} color={tokens.colors.onSecondary} />
          ) : (
            <Text style={{ fontFamily: font('body', 600), fontSize: 12, letterSpacing: 0.04 * 12, color: tokens.colors.onSecondary }}>
              {initials}
            </Text>
          )}
        </Pressable>
      )}

      {isSubPage ? (
        <Pressable style={styles.crumbCentre} onPress={onGoBack} accessibilityLabel={`Back to ${parentLabel ?? ''}`}>
          <Text
            numberOfLines={1}
            style={{ fontFamily: font('mono', 500), fontSize: 10, letterSpacing: 0.08 * 10, textTransform: 'uppercase', color: tokens.colors.onSurfaceVariant }}
          >
            {parentLabel}
          </Text>
          <ChevronRight size={11} color={tokens.colors.outline} />
          <Text
            numberOfLines={1}
            style={{ fontFamily: font('mono', 700), fontSize: 11, letterSpacing: 0.1 * 11, textTransform: 'uppercase', color: tokens.colors.onSurfaceStrong }}
          >
            {currentLabel}
          </Text>
        </Pressable>
      ) : (
        <Pressable style={styles.brand} onPress={onBrandPress}>
          <Text
            numberOfLines={1}
            style={{ fontFamily: font('mono', 600), fontSize: 13, letterSpacing: 0.18 * 13, textTransform: 'uppercase', color: tokens.colors.onSurfaceStrong, textAlign: 'center' }}
          >
            ARIAL ENGINEERING
          </Text>
        </Pressable>
      )}

      <NotificationBell size={36} />
    </BlurView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: space[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brand: {
    flex: 1,
  },
  crumbCentre: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
});

export const GlassTopBar = memo(GlassTopBarImpl);
export type { Crumb };
