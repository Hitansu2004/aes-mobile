import React, { Fragment, memo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { Text } from '@/components/primitives/Text';
import { NotificationBell } from './NotificationBell';
import type { Crumb } from './nav';

// Ported from ../../aes-frontend/src/components/rose/RoseShell.js —
// `.topBar` (tablet 769–1023px persistent sidebar + this bar, and
// large ≥1024px desktop bar). Left = back button + breadcrumb trail,
// right = search, bell, avatar.
export interface TopBarProps {
  isSubPage: boolean;
  breadcrumbs: Crumb[];
  initials: string;
  showSearch: boolean;
  paddingHorizontal: number;
  height: number;
  onGoBack: () => void;
  onCrumbPress: (href: string) => void;
  onAvatarPress: () => void;
}

function TopBarImpl({
  isSubPage, breadcrumbs, initials, showSearch, paddingHorizontal, height, onGoBack, onCrumbPress, onAvatarPress,
}: TopBarProps) {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          height,
          paddingHorizontal,
          backgroundColor: tokens.glass.header,
          borderBottomColor: tokens.colors.borderLight,
        },
      ]}
    >
      <View style={styles.left}>
        {isSubPage && (
          <>
            <Pressable
              onPress={onGoBack}
              accessibilityLabel="Go back"
              style={[styles.backBtn, { borderColor: tokens.colors.outlineVariant }]}
            >
              <ArrowLeft size={15} strokeWidth={2.2} color={tokens.colors.onSurfaceStrong} />
              <Text style={{ fontFamily: font('body', 600), fontSize: 13, color: tokens.colors.onSurfaceStrong }}>
                Back
              </Text>
            </Pressable>
            <View style={[styles.divider, { backgroundColor: tokens.colors.outlineVariant }]} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.crumbs}>
              {breadcrumbs.map((crumb, i) => {
                const isLast = i === breadcrumbs.length - 1;
                return (
                  <Fragment key={crumb.href}>
                    {i > 0 && <ChevronRight size={12} color={tokens.colors.outline} style={styles.crumbSep} />}
                    {isLast ? (
                      <Text
                        numberOfLines={1}
                        style={{ fontFamily: font('body', 600), fontSize: 13, color: tokens.colors.onSurfaceStrong }}
                      >
                        {crumb.label}
                      </Text>
                    ) : (
                      <Pressable onPress={() => onCrumbPress(crumb.href)} hitSlop={4}>
                        <Text
                          numberOfLines={1}
                          style={{ fontFamily: font('body', 500), fontSize: 13, color: tokens.colors.onSurfaceVariant }}
                        >
                          {crumb.label}
                        </Text>
                      </Pressable>
                    )}
                  </Fragment>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>

      <View style={styles.right}>
        {showSearch && (
          <Pressable accessibilityLabel="Search" style={[styles.iconBtn, { width: 40, height: 40 }]}>
            <Search size={20} color={tokens.colors.onSurfaceVariant} />
          </Pressable>
        )}
        <NotificationBell size={40} />
        <Pressable
          accessibilityLabel="Account"
          onPress={onAvatarPress}
          style={[styles.avatar, { borderColor: tokens.colors.outlineVariant, backgroundColor: tokens.colors.secondarySoft }]}
        >
          <Text style={{ fontFamily: font('body', 600), fontSize: 14, letterSpacing: 0.04 * 14, color: tokens.colors.secondaryInk }}>
            {initials}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flex: 1,
    minWidth: 0,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: space[3],
    borderRadius: radius.sm,
    borderWidth: 1.5,
  },
  divider: {
    width: 1,
    height: 20,
    marginHorizontal: space[1],
  },
  crumbs: {
    flexDirection: 'row',
  },
  crumbSep: {
    marginHorizontal: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    flexShrink: 0,
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});

export const TopBar = memo(TopBarImpl);
