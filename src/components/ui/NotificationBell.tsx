import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import {
  AlertTriangle, Bell, Calendar, CheckCheck, ChevronRight, Sparkles, Wrench,
} from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text, Sheet, SheetRef } from '@/components/primitives';
import { radius, space } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { useNotifications } from '@/context/NotificationContext';
import type { Notification, NotificationType } from '@/types/api';

// Ported from ../../aes-frontend/src/components/ui/NotificationBell.js +
// NotificationBell.module.css. The web opens an inline dropdown; on mobile
// this opens a BOTTOM SHEET (the standard dropdown replacement per
// CLAUDE.md) listing recent notifications, with "Mark all read" and a
// "See all" link to /notifications. MOTION: the bell swings on new unread,
// the badge springs in.
type Tone = 'success' | 'warning' | 'info' | 'amc';

const TYPE_META: Partial<Record<NotificationType, { Icon: typeof Bell; tone: Tone }>> = {
  TICKET_RAISED: { Icon: Wrench, tone: 'info' },
  TICKET_ASSIGNED: { Icon: Wrench, tone: 'info' },
  TICKET_ESCALATED: { Icon: AlertTriangle, tone: 'warning' },
  TICKET_RESOLVED: { Icon: CheckCheck, tone: 'success' },
  AMC_REMINDER: { Icon: Calendar, tone: 'amc' },
  INSTALLATION_UPDATE: { Icon: Sparkles, tone: 'info' },
};

const TONE_COLOR: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: '#DCF3E4', fg: '#1B7A43' },
  warning: { bg: '#FDECC8', fg: '#8A5A00' },
  info: { bg: '#E6EAF0', fg: '#0B1A2C' },
  amc: { bg: '#E6EAF0', fg: '#0B1A2C' },
};

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
  iconSize?: number;
  iconColor?: string;
}

export function NotificationBell({ iconSize = 20, iconColor }: NotificationBellProps) {
  const { tokens } = useTheme();
  const router = useRouter();
  const {
    items, unread, markRead, markAllRead,
  } = useNotifications();
  const sheetRef = useRef<SheetRef>(null);

  const swing = useSharedValue(0);
  const badgeScale = useSharedValue(unread > 0 ? 1 : 0);
  const prevUnread = useRef(unread);

  useEffect(() => {
    if (unread > prevUnread.current) {
      swing.value = withSequence(
        withTiming(-15, { duration: 100 }),
        withTiming(15, { duration: 100 }),
        withTiming(0, { duration: 200 }),
      );
    }
    badgeScale.value = withSpring(unread > 0 ? 1 : 0, { damping: 12, stiffness: 200 });
    prevUnread.current = unread;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread]);

  const bellStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${swing.value}deg` }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  const recent = (items || []).slice(0, 6);

  const openItem = (n: Notification) => {
    if (!n.read) markRead(n.id);
    sheetRef.current?.dismiss();
    router.push((n.link || '/notifications') as Parameters<typeof router.push>[0]);
  };

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        hitSlop={8}
        onPress={() => sheetRef.current?.present()}
        style={{
          width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Animated.View style={bellStyle}>
          <Bell size={iconSize} color={iconColor ?? tokens.colors.onSurfaceVariant} />
        </Animated.View>
        {unread > 0 && (
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 2,
                right: 2,
                minWidth: 16,
                height: 16,
                paddingHorizontal: 4,
                borderRadius: radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: tokens.colors.secondary,
              },
              badgeStyle,
            ]}
          >
            <Text style={{ fontSize: 9, lineHeight: 11, fontFamily: font('body', 700), color: tokens.colors.onSecondary }}>
              {unread > 99 ? '99+' : String(unread)}
            </Text>
          </Animated.View>
        )}
      </Pressable>

      <Sheet ref={sheetRef} snapPoints={['65%']}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[5], paddingBottom: space[3],
        }}
        >
          <Text variant="headlineSm">Notifications</Text>
          {unread > 0 && (
            <Pressable
              onPress={() => markAllRead()}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 6, borderRadius: radius.sm,
              }}
            >
              <CheckCheck size={13} color={tokens.colors.secondaryInk} />
              <Text style={{ fontSize: 12, fontFamily: font('body', 600), color: tokens.colors.secondaryInk }}>
                Mark all read
              </Text>
            </Pressable>
          )}
        </View>

        {recent.length === 0 ? (
          <View style={{
            alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: space[4],
          }}
          >
            <Bell size={22} color={tokens.colors.onSurfaceVariant} />
            <Text variant="bodySm" color="onSurfaceVariant">You&rsquo;re all caught up.</Text>
          </View>
        ) : (
          <BottomSheetFlatList
            data={recent}
            keyExtractor={(n: Notification) => n.id}
            renderItem={({ item }: { item: Notification }) => (
              <NotificationRow notification={item} onPress={() => openItem(item)} />
            )}
          />
        )}

        <Pressable
          onPress={() => { sheetRef.current?.dismiss(); router.push('/notifications'); }}
          style={{
            paddingVertical: space[3],
            alignItems: 'center',
            backgroundColor: tokens.colors.surfaceContainerLow,
            borderTopWidth: 1,
            borderTopColor: tokens.colors.outlineVariant,
          }}
        >
          <Text style={{ fontSize: 13, fontFamily: font('body', 600), color: tokens.colors.onSurfaceStrong }}>
            View all notifications
          </Text>
        </Pressable>
      </Sheet>
    </View>
  );
}

export interface NotificationRowProps {
  notification: Notification;
  onPress: () => void;
}

// Standalone notification row — reused by the /notifications screen (Phase 14).
export function NotificationRow({ notification: n, onPress }: NotificationRowProps) {
  const { tokens } = useTheme();
  const meta = TYPE_META[n.type] || { Icon: Bell, tone: 'info' as Tone };
  const toneColor = TONE_COLOR[meta.tone];

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space[3],
        paddingVertical: space[3],
        paddingHorizontal: space[5],
        backgroundColor: n.read ? 'transparent' : 'rgba(201, 168, 76, 0.07)',
        borderBottomWidth: 1,
        borderBottomColor: tokens.colors.outlineVariant,
      }}
    >
      <View style={{
        width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: toneColor.bg,
      }}
      >
        <meta.Icon size={16} color={toneColor.fg} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13.5, fontFamily: font('body', 600), color: tokens.colors.onSurface, flexShrink: 1 }}>
            {n.title || 'Notification'}
          </Text>
          {!n.read && (
            <View style={{
              width: 7, height: 7, borderRadius: 4, backgroundColor: tokens.colors.secondary,
            }}
            />
          )}
        </View>
        {n.body ? (
          <Text numberOfLines={2} style={{ fontSize: 12.5, lineHeight: 17, color: tokens.colors.onSurfaceVariant }}>
            {n.body}
          </Text>
        ) : null}
        <Text style={{ fontSize: 11, color: tokens.colors.onSurfaceVariant, marginTop: 2 }}>
          {formatStamp(n.createdAt)}
        </Text>
      </View>
      <ChevronRight size={16} color={tokens.colors.outline} style={{ marginTop: 2 }} />
    </Pressable>
  );
}
