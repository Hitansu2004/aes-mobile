import React, { memo, useEffect, useRef, useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import {
  Bell, CheckCheck, AlertTriangle, Wrench, Sparkles, Calendar, ChevronRight,
} from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { Text } from '@/components/primitives/Text';
import { PressableScale } from '@/components/primitives/PressableScale';
import { useHaptics } from '@/hooks/useHaptics';
import { useNotifications } from '@/context/NotificationContext';
import type { Notification, NotificationType } from '@/types/api';

// Ported from ../../aes-frontend/src/components/ui/NotificationBell.js — the
// web version toggles a `position: absolute` dropdown anchored right under
// the bell (tap opens, tap again/outside/Escape closes). Reproduced here as
// a transparent Modal (so it always paints above the ScrollView content and
// glass top bar — RN has no z-index across separate parents the way CSS
// does) whose panel slides down from just under the measured bell position.
// Same easeOutQuint timing as Drawer.tsx — no spring, no overshoot, so the
// arrival reads as a plain smooth slide, not a bounce/jump.
type Tone = 'info' | 'success' | 'warning' | 'amc';

const TYPE_META: Partial<Record<NotificationType, { Icon: typeof Bell; tone: Tone }>> = {
  TICKET_RAISED: { Icon: Wrench, tone: 'info' },
  TICKET_ASSIGNED: { Icon: Wrench, tone: 'info' },
  TICKET_ESCALATED: { Icon: AlertTriangle, tone: 'warning' },
  TICKET_RESOLVED: { Icon: CheckCheck, tone: 'success' },
  AMC_REMINDER: { Icon: Calendar, tone: 'amc' },
  INSTALLATION_UPDATE: { Icon: Sparkles, tone: 'info' },
};

const PANEL_TIMING = { duration: 220, easing: Easing.bezier(0.22, 1, 0.36, 1) } as const;

function formatStamp(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const mins = Math.round((now.getTime() - date.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (date.toDateString() === now.toDateString()) return `${Math.round(mins / 60)}h ago`;
  const y = new Date();
  y.setDate(now.getDate() - 1);
  if (date.toDateString() === y.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export interface NotificationBellProps {
  size?: number;
  iconColor?: string;
}

function NotificationBellImpl({ size = 36, iconColor }: NotificationBellProps) {
  const { tokens } = useTheme();
  const router = useRouter();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const {
    items, unread, markRead, markAllRead,
  } = useNotifications();

  const buttonRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number }>({ top: insets.top + 60, right: space[4] });
  const progress = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setVisible(true);
      progress.value = withTiming(1, PANEL_TIMING);
    } else if (visible) {
      progress.value = withTiming(0, PANEL_TIMING, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = () => {
    haptics.tapLight();
    if (open) {
      setOpen(false);
      return;
    }
    buttonRef.current?.measureInWindow((x, y, w, h) => {
      setAnchor({ top: y + h + 8, right: Math.max(space[4], screenWidth - (x + w)) });
      setOpen(true);
    });
  };

  const close = () => setOpen(false);

  const openItem = (n: Notification) => {
    if (!n.read) markRead(n.id);
    setOpen(false);
    router.push(n.link || '/notifications');
  };

  const recent = (items || []).slice(0, 6);
  const panelWidth = Math.min(340, screenWidth - 28);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.35 }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -12 }, { scale: 0.98 + progress.value * 0.02 }],
  }));

  return (
    <>
      <Pressable
        ref={buttonRef}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        onPress={toggle}
        style={[styles.button, { width: size, height: size }]}
      >
        <Bell size={20} color={iconColor ?? tokens.colors.onSurfaceVariant} />
        {unread > 0 && (
          <View style={[styles.badge, { backgroundColor: tokens.colors.error }]}>
            <Text
              variant="labelMd"
              style={{ color: tokens.colors.onError, fontSize: 9, lineHeight: 11 }}
              numberOfLines={1}
            >
              {unread > 99 ? '99+' : String(unread)}
            </Text>
          </View>
        )}
      </Pressable>

      <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close notifications" onPress={close} />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            {
              top: anchor.top,
              right: anchor.right,
              width: panelWidth,
              backgroundColor: tokens.colors.surfaceContainerLowest,
              borderColor: tokens.colors.outlineVariant,
            },
            panelStyle,
          ]}
        >
          <View style={[styles.head, { borderBottomColor: tokens.colors.outlineVariant }]}>
            <Text variant="headlineSm">Notifications</Text>
            {unread > 0 && (
              <PressableScale
                onPress={() => { haptics.tapLight(); markAllRead(); }}
                style={styles.markAll}
              >
                <CheckCheck size={13} color={tokens.colors.secondaryInk} />
                <Text style={{ fontFamily: font('body', 600), fontSize: 12, color: tokens.colors.secondaryInk }}>
                  Mark all read
                </Text>
              </PressableScale>
            )}
          </View>

          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {recent.length === 0 ? (
              <View style={styles.empty}>
                <Bell size={22} color={tokens.colors.onSurfaceVariant} />
                <Text color="onSurfaceVariant">You&rsquo;re all caught up.</Text>
              </View>
            ) : (
              recent.map((n) => {
                const meta = TYPE_META[n.type] || { Icon: Bell, tone: 'info' as Tone };
                const { Icon, tone } = meta;
                const toneColors: Record<Tone, { bg: string; fg: string }> = {
                  info: { bg: tokens.colors.secondarySoft, fg: tokens.colors.secondaryInk },
                  success: { bg: tokens.colors.successLight, fg: tokens.colors.success },
                  warning: { bg: tokens.colors.warningLight, fg: tokens.colors.warning },
                  amc: { bg: tokens.colors.secondarySoft, fg: tokens.colors.secondaryInk },
                };
                const toneColor = toneColors[tone];
                return (
                  <PressableScale
                    key={n.id}
                    onPress={() => openItem(n)}
                    style={[
                      styles.item,
                      { borderBottomColor: tokens.colors.outlineVariant },
                      !n.read && { backgroundColor: tokens.colors.secondarySoft },
                    ]}
                  >
                    {!n.read && <View style={[styles.unreadBorder, { backgroundColor: tokens.colors.secondary }]} />}
                    <View style={[styles.itemIcon, { backgroundColor: toneColor.bg }]}>
                      <Icon size={16} color={toneColor.fg} />
                    </View>
                    <View style={styles.itemBody}>
                      <View style={styles.itemTitleRow}>
                        <Text
                          style={{ fontFamily: font('body', n.read ? 500 : 700), fontSize: 13.5, flexShrink: 1 }}
                          color={n.read ? 'onSurfaceVariant' : 'onSurfaceStrong'}
                          numberOfLines={1}
                        >
                          {n.title || 'Notification'}
                        </Text>
                        {!n.read && <View style={[styles.dot, { backgroundColor: tokens.colors.secondary }]} />}
                      </View>
                      {n.body ? (
                        <Text variant="bodySm" color="onSurfaceVariant" numberOfLines={2}>{n.body}</Text>
                      ) : null}
                      <Text style={{ fontFamily: font('mono', 500), fontSize: 11, marginTop: 2 }} color="onSurfaceVariant">
                        {formatStamp(n.createdAt)}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={tokens.colors.outline} />
                  </PressableScale>
                );
              })
            )}

            <PressableScale
              onPress={() => { setOpen(false); router.push('/notifications'); }}
              style={[styles.footer, { backgroundColor: tokens.colors.surfaceContainerLow }]}
            >
              <Text style={{ fontFamily: font('body', 600), fontSize: 13 }} color="onSurfaceStrong">
                View all notifications
              </Text>
            </PressableScale>
          </ScrollView>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    backgroundColor: '#0B1A2C',
  },
  panel: {
    position: 'absolute',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: 'rgba(15, 28, 44, 1)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 16,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: 1,
  },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
  },
  item: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: space[4],
    paddingVertical: 12,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  unreadBorder: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
  },
  itemIcon: {
    flexShrink: 0,
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  empty: {
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[10],
    paddingHorizontal: space[5],
  },
  footer: {
    marginTop: space[2],
    marginBottom: space[4],
    marginHorizontal: space[4],
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: radius.md,
  },
});

export const NotificationBell = memo(NotificationBellImpl);
