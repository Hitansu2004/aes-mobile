import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { MotiView, AnimatePresence } from 'moti';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import {
  Bell, CheckCheck, AlertTriangle, Wrench, Sparkles, Calendar, ChevronRight, Check,
} from 'lucide-react-native';

import { AppShell } from '@/components/shell/AppShell';
import { Splash } from '@/components/shell/Splash';
import { Text } from '@/components/primitives/Text';
import { Skeleton } from '@/components/primitives/Skeleton';
import { PressableScale } from '@/components/primitives/PressableScale';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useHaptics } from '@/hooks/useHaptics';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import type { Notification, NotificationType } from '@/types/api';

// Ported from ../../aes-frontend/src/app/notifications/page.js +
// notifications.module.css. TYPE_META, formatStamp() and bucketOf() are
// copied verbatim — the bucket names/boundaries and icon/tone pairs are
// subtle enough that paraphrasing them would silently change behaviour.
// MOTION (mobile-only, additive per CLAUDE.md): unread cards carry a soft
// gold left border that fades away the instant they're tapped read, and a
// swipe-left-to-mark-read gesture — a native affordance the web has no
// equivalent for.
type Tone = 'info' | 'success' | 'warning' | 'amc';

const TYPE_META: Partial<Record<NotificationType, { Icon: typeof Bell; tone: Tone }>> = {
  TICKET_RAISED: { Icon: Wrench, tone: 'info' },
  TICKET_ASSIGNED: { Icon: Wrench, tone: 'info' },
  TICKET_ESCALATED: { Icon: AlertTriangle, tone: 'warning' },
  TICKET_RESOLVED: { Icon: CheckCheck, tone: 'success' },
  AMC_REMINDER: { Icon: Calendar, tone: 'amc' },
  INSTALLATION_UPDATE: { Icon: Sparkles, tone: 'info' },
};

function formatStamp(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = (() => {
    const y = new Date();
    y.setDate(today.getDate() - 1);
    return y.toDateString() === date.toDateString();
  })();
  const time = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, ${time}`;
}

type Bucket = 'Today' | 'Yesterday' | 'This week' | 'Earlier';

function bucketOf(iso?: string): Bucket {
  if (!iso) return 'Earlier';
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const aWeekAgo = new Date();
  aWeekAgo.setDate(today.getDate() - 7);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if (date >= aWeekAgo) return 'This week';
  return 'Earlier';
}

const BUCKET_ORDER: Bucket[] = ['Today', 'Yesterday', 'This week', 'Earlier'];

export default function NotificationsScreen() {
  const { user, loading: authLoading } = useAuth();
  const {
    items, unread, loading, refresh, markRead, markAllRead,
  } = useNotifications();
  const router = useRouter();
  const { tokens } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const haptics = useHaptics();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Clear the app-icon badge the moment the user actually looks at their
  // notifications — the bell-count badge itself is kept in sync elsewhere
  // (NotificationContext, on every `unread` change).
  useEffect(() => {
    Notifications.setBadgeCountAsync(0).catch(() => {});
  }, []);

  const grouped = useMemo(() => {
    const buckets: Record<Bucket, Notification[]> = {
      Today: [], Yesterday: [], 'This week': [], Earlier: [],
    };
    (items || []).forEach((n) => {
      buckets[bucketOf(n.createdAt)].push(n);
    });
    return buckets;
  }, [items]);

  if (authLoading || !user) return <Splash message="Loading notifications…" />;

  const hero = (
    <View style={styles.heroRow}>
      <View style={{ gap: space[2], flex: 1 }}>
        <Text variant="headlineXl" color="onSurfaceStrong">Notifications</Text>
        <Text variant="bodyLg" color="onSurfaceVariant">
          {unread > 0
            ? `${unread} unread · ${items.length} total`
            : items.length > 0
              ? `You're all caught up · ${items.length} total`
              : "No notifications yet — we'll let you know when something happens."}
        </Text>
      </View>
      {unread > 0 ? (
        <PressableScale
          style={[styles.markAllBtn, { backgroundColor: tokens.colors.secondary }, shadow('cta')]}
          onPress={() => { haptics.tapLight(); markAllRead(); }}
        >
          <CheckCheck size={14} color={tokens.colors.onSecondary} />
          <Text style={{ fontFamily: font('body', 600), fontSize: 13 }} color="onSecondary">Mark all read</Text>
        </PressableScale>
      ) : null}
    </View>
  );

  return (
    <AppShell
      hero={hero}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.secondary} />}
    >
      {loading && items.length === 0 ? (
        <View style={{ gap: space[3] }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={88} radius={radius.lg} />)}
        </View>
      ) : items.length === 0 ? (
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300 }}
          style={[styles.empty, { borderColor: tokens.colors.outlineVariant }]}
        >
          <View style={[styles.emptyIcon, { backgroundColor: tokens.colors.secondarySoft }]}>
            <Bell size={28} color={tokens.colors.secondaryInk} />
          </View>
          <Text variant="headlineSm" align="center">No notifications yet</Text>
          <Text variant="bodyMd" color="onSurfaceVariant" align="center" style={{ maxWidth: 420 }}>
            Ticket updates, escalations, and reminders will show up here.
          </Text>
          <View style={{ marginTop: space[4] }}>
            <PressableScale
              style={[styles.emptyCta, { backgroundColor: tokens.colors.secondary }, shadow('cta')]}
              onPress={() => router.push(defaultRouteForRole(user.role))}
            >
              <Text style={{ fontFamily: font('body', 600), fontSize: 14 }} color="onSecondary">Back to dashboard</Text>
            </PressableScale>
          </View>
        </MotiView>
      ) : (
        BUCKET_ORDER.map((bucket) => {
          const list = grouped[bucket];
          if (list.length === 0) return null;
          return (
            <View key={bucket} style={styles.section}>
              <Text style={styles.sectionTitle} color="onSurfaceVariant">{bucket}</Text>
              <View style={styles.list}>
                <AnimatePresence>
                  {list.map((n) => (
                    <MotiView
                      key={n.id}
                      from={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ type: 'timing', duration: 180 }}
                    >
                      <NotificationRow
                        notification={n}
                        tokens={tokens}
                        onPress={() => {
                          if (!n.read) markRead(n.id);
                          if (n.link) router.push(n.link);
                        }}
                        onSwipeRead={() => markRead(n.id)}
                      />
                    </MotiView>
                  ))}
                </AnimatePresence>
              </View>
            </View>
          );
        })
      )}
    </AppShell>
  );
}

type Tokens = ReturnType<typeof useTheme>['tokens'];

const SWIPE_THRESHOLD = -72;
const SWIPE_MAX = -96;

const NotificationRow = React.memo(function NotificationRow({
  notification, tokens, onPress, onSwipeRead,
}: {
  notification: Notification; tokens: Tokens; onPress: () => void; onSwipeRead: () => void;
}) {
  const haptics = useHaptics();
  const meta = TYPE_META[notification.type] || { Icon: Bell, tone: 'info' as Tone };
  const { Icon, tone } = meta;

  // notifications.module.css's .icon_info and .icon_amc both read
  // `var(--aes-primary-fixed)` / `var(--aes-primary-ink)` — the same
  // pre-Rose-redesign gold alias documented in account.tsx/services/index.tsx
  // — not tokens.colors.primaryContainer (navy family). Both tones render
  // identically gold on the web; only success/warning actually differ.
  const toneColors: Record<Tone, { bg: string; fg: string }> = {
    info: { bg: tokens.colors.secondarySoft, fg: tokens.colors.secondaryInk },
    success: { bg: tokens.colors.successLight, fg: tokens.colors.success },
    warning: { bg: tokens.colors.warningLight, fg: tokens.colors.warning },
    amc: { bg: tokens.colors.secondarySoft, fg: tokens.colors.secondaryInk },
  };
  const toneColor = toneColors[tone];

  const translateX = useSharedValue(0);
  const dotOpacity = useSharedValue(notification.read ? 0 : 1);
  const borderOpacity = useSharedValue(notification.read ? 0 : 1);

  const markReadAnimated = () => {
    dotOpacity.value = withTiming(0, { duration: 220 });
    borderOpacity.value = withTiming(0, { duration: 260 });
  };

  // Covers "Mark all read", which flips `read` on every row at once without
  // going through handlePress/handleSwipeComplete below — sync the fade here
  // too, or those rows would keep their gold border until individually tapped.
  useEffect(() => {
    if (notification.read) markReadAnimated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification.read]);

  const handlePress = () => {
    if (!notification.read) markReadAnimated();
    onPress();
  };

  const handleSwipeComplete = () => {
    if (!notification.read) {
      markReadAnimated();
      onSwipeRead();
    }
  };

  const pan = Gesture.Pan()
    .enabled(!notification.read)
    .activeOffsetX([-10, 10])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      translateX.value = Math.min(0, Math.max(SWIPE_MAX, e.translationX));
    })
    .onEnd(() => {
      if (translateX.value < SWIPE_THRESHOLD) {
        translateX.value = withTiming(SWIPE_MAX, { duration: 120 });
        runOnJS(haptics.success)();
        runOnJS(handleSwipeComplete)();
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 260 });
      }
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const revealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [SWIPE_MAX, 0], [1, 0], Extrapolation.CLAMP),
  }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value, transform: [{ scale: dotOpacity.value }] }));
  const borderStyle = useAnimatedStyle(() => ({ opacity: borderOpacity.value }));

  return (
    <View style={{ position: 'relative' }}>
      <Animated.View style={[rowStyles.swipeReveal, { backgroundColor: tokens.colors.success }, revealStyle]}>
        <Check size={18} color="#ffffff" />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>
          <PressableScale scaleTo={0.99} onPress={handlePress} style={[rowStyles.card, { backgroundColor: tokens.colors.surfaceContainerLowest }, shadow('card')]}>
            <Animated.View style={[rowStyles.unreadBorder, { backgroundColor: tokens.colors.secondary }, borderStyle]} />
            <View style={[rowStyles.cardIcon, { backgroundColor: toneColor.bg }]}>
              <Icon size={18} color={toneColor.fg} />
            </View>
            <View style={rowStyles.cardBody}>
              <View style={rowStyles.cardTitleRow}>
                <Text style={rowStyles.cardTitle} numberOfLines={1}>{notification.title}</Text>
                <Animated.View style={[rowStyles.dot, { backgroundColor: tokens.colors.secondary }, dotStyle]} />
              </View>
              {notification.body ? (
                <Text variant="bodySm" color="onSurfaceVariant" numberOfLines={2}>{notification.body}</Text>
              ) : null}
              <Text style={rowStyles.cardStamp} color="onSurfaceVariant">{formatStamp(notification.createdAt)}</Text>
            </View>
            <ChevronRight size={18} color={tokens.colors.onSurfaceVariant} />
          </PressableScale>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const rowStyles = {
  swipeReveal: {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    right: 0,
    width: 96,
    borderRadius: radius.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  card: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
    overflow: 'hidden' as const,
  },
  unreadBorder: {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  cardTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  cardTitle: {
    fontFamily: font('display', 600),
    fontSize: 14.5,
    flexShrink: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardStamp: {
    fontFamily: font('mono', 500),
    fontSize: 11,
    marginTop: 2,
  },
};

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  heroRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'space-between' as const,
    gap: space[5],
    flexWrap: 'wrap' as const,
  },
  markAllBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.full,
  },
  section: {
    gap: space[3],
    marginBottom: space[6],
  },
  sectionTitle: {
    fontFamily: font('mono', 600),
    fontSize: 11,
    letterSpacing: 0.12 * 11,
    textTransform: 'uppercase' as const,
  },
  list: {
    gap: 10,
  },
  empty: {
    alignItems: 'center' as const,
    gap: space[3],
    paddingVertical: space[12],
    paddingHorizontal: space[6],
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderRadius: radius.xl,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emptyCta: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.full,
  },
});
