import React, { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HelpCircle, LogOut } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { Text } from '@/components/primitives/Text';
import { PressableScale } from '@/components/primitives/PressableScale';
import { isActive, type RoleNav } from './nav';

// Ported from ../../aes-frontend/src/components/rose/RoseShell.js — the
// sidebar (`<aside className={styles.sidebar}>`) markup. Rendered inside a
// persistent column on tablet/large and inside the off-canvas Drawer on
// phone; the content is identical across all three breakpoints.
export interface SidebarProps {
  nav: RoleNav;
  pathname: string;
  onNavigate: (href: string) => void;
  onLogout: () => void;
  compact?: boolean;
  topInset?: boolean;
}

function SidebarImpl({ nav, pathname, onNavigate, onLogout, compact = false, topInset = false }: SidebarProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [ctaHover, setCtaHover] = useState(false);
  const [ctaPress, setCtaPress] = useState(false);
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  // RoseShell.module.css's .navLink:hover / .primaryCta:hover only exist on
  // the web (a mouse-only affordance) — onHoverIn/onHoverOut are RNW-only
  // extensions to Pressable that silently no-op on iOS/Android, so this is
  // free on native, not a web-only branch.

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: (topInset ? insets.top : 0) + (compact ? space[7] : space[10]) },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.top}>
        <Pressable onPress={() => onNavigate('/dashboard')} hitSlop={4}>
          <Text
            style={{
              fontFamily: font('mono', 600),
              fontSize: compact ? 11 : 12,
              letterSpacing: 0.18 * 12,
              textTransform: 'uppercase',
              color: tokens.colors.onSurfaceStrong,
            }}
          >
            ARIAL ENGINEERING
          </Text>
        </Pressable>

        <PressableScale
          haptic
          onPress={() => onNavigate(nav.primary.href)}
          onHoverIn={() => setCtaHover(true)}
          onHoverOut={() => setCtaHover(false)}
          onPressIn={() => setCtaPress(true)}
          onPressOut={() => setCtaPress(false)}
          style={[
            styles.primaryCta,
            {
              backgroundColor: ctaPress
                ? tokens.colors.secondaryPress
                : ctaHover ? tokens.colors.secondaryStrong : tokens.colors.secondary,
              height: compact ? 38 : 42,
            },
          ]}
        >
          <nav.primary.icon size={16} strokeWidth={2.4} color={tokens.colors.onSecondary} />
          <Text
            style={{
              fontFamily: font('body', 500),
              fontSize: compact ? 13 : 14,
              color: tokens.colors.onSecondary,
            }}
            numberOfLines={1}
          >
            {nav.primary.label}
          </Text>
        </PressableScale>
      </View>

      <View style={styles.navList}>
        {nav.items.map((item) => {
          const active = isActive(pathname, item.href);
          const hovered = hoveredHref === item.href;
          const Icon = item.icon;
          return (
            <Pressable
              key={item.href}
              onPress={() => onNavigate(item.href)}
              onHoverIn={() => setHoveredHref(item.href)}
              onHoverOut={() => setHoveredHref((h) => (h === item.href ? null : h))}
              style={[
                styles.navLink,
                { paddingVertical: compact ? 9 : 10 },
                (active || hovered) && { backgroundColor: tokens.colors.secondarySoft },
              ]}
            >
              <View
                style={[
                  styles.navAccent,
                  { backgroundColor: tokens.colors.secondary, opacity: active ? 1 : 0 },
                ]}
              />
              <Icon
                size={18}
                strokeWidth={active ? 2.2 : 1.8}
                color={active || hovered ? tokens.colors.onSurfaceStrong : tokens.colors.onSurfaceVariant}
              />
              <Text
                style={{
                  fontFamily: font('body', 500),
                  fontSize: compact ? 13.5 : 14,
                  color: active || hovered ? tokens.colors.onSurfaceStrong : tokens.colors.onSurfaceVariant,
                }}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.foot, { borderTopColor: tokens.colors.outlineVariant }]}>
        <Pressable onPress={() => onNavigate('/notifications')} style={styles.navLink}>
          <View style={styles.navAccent} />
          <HelpCircle size={18} strokeWidth={1.8} color={tokens.colors.onSurfaceVariant} />
          <Text style={{ fontFamily: font('body', 500), fontSize: 14, color: tokens.colors.onSurfaceVariant }}>
            Support
          </Text>
        </Pressable>
        <Pressable onPress={onLogout} style={styles.navLink}>
          <View style={styles.navAccent} />
          <LogOut size={18} strokeWidth={1.8} color={tokens.colors.onSurfaceVariant} />
          <Text style={{ fontFamily: font('body', 500), fontSize: 14, color: tokens.colors.onSurfaceVariant }}>
            Log Out
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space[4],
    paddingBottom: space[6],
    flexGrow: 1,
  },
  top: {
    gap: space[6],
    paddingBottom: space[6],
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    borderRadius: radius.sm,
  },
  navList: {
    flex: 1,
    gap: 2,
    paddingVertical: space[1],
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: space[4],
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  navAccent: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -11,
    width: 3,
    height: 22,
    borderRadius: 3,
  },
  foot: {
    gap: 2,
    paddingTop: space[4],
    marginTop: space[4],
    borderTopWidth: 1,
  },
});

export const Sidebar = memo(SidebarImpl);
