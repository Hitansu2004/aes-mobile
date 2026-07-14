import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { usePathname } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { notifications as notifApi } from '@/lib/api';
import { subscribeTopic } from '@/lib/stomp';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { Notification, NotificationType } from '@/types/api';

/**
 * Live notifications store — feeds the global bell + the dedicated
 * /notifications screen from a single source of truth.
 *
 * Ported from ../../aes-frontend/src/context/NotificationContext.js. The
 * web's separate NotificationToastBridge (a DOM CustomEvent listener) has no
 * RN equivalent — there's no `window` to dispatch through — so the toast is
 * fired directly from the WS handler below, gated on the current route.
 */
const POLL_INTERVAL_MS = 60_000;

const TYPE_TONE: Partial<Record<NotificationType, 'success' | 'error' | 'info' | 'warning'>> = {
  TICKET_ESCALATED: 'info',
  TICKET_RESOLVED: 'success',
  TICKET_ASSIGNED: 'success',
  TICKET_RAISED: 'info',
  AMC_REMINDER: 'info',
  INSTALLATION_UPDATE: 'success',
};

interface NotificationContextValue {
  items: Notification[];
  unread: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const lastFetchedAt = useRef(0);
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  const refresh = useCallback(async (): Promise<void> => {
    if (!user) return;
    if (loadingRef.current) return;
    if (Date.now() - lastFetchedAt.current < 300) return;
    lastFetchedAt.current = Date.now();
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        notifApi.list(50),
        notifApi.unreadCount(),
      ]);
      setItems(Array.isArray(list) ? list : []);
      setUnread(count?.count ?? 0);
    } catch {
      /* network errors are non-fatal here */
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch + polling fallback — kept even with push notifications
  // wired up (Phase 19), because push can be denied by the user.
  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnread(0);
      return undefined;
    }
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Live socket
  useEffect(() => {
    if (!user?.id) return undefined;
    const dest = `/topic/users/${user.id}/notifications`;
    const unsubscribe = subscribeTopic(dest, (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const n = payload as Notification;
      setItems((prev) => {
        // de-dup by id
        if (prev.some((x) => x.id === n.id)) return prev;
        return [n, ...prev].slice(0, 80);
      });
      if (!n.read) setUnread((u) => u + 1);

      if (n.read || pathnameRef.current?.startsWith('/notifications')) return;
      const tone = TYPE_TONE[n.type] || 'info';
      toast[tone](n.title);
    });
    return unsubscribe;
  }, [user?.id, toast]);

  // App-icon badge mirrors the bell count (Phase 19) — cleared separately
  // when /notifications is opened (see that screen's mount effect).
  useEffect(() => {
    Notifications.setBadgeCountAsync(unread).catch(() => {});
  }, [unread]);

  const markRead = useCallback(async (id: string): Promise<void> => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await notifApi.markRead(id);
    } catch {
      /* leave optimistic state — refresh later */
    }
  }, []);

  const markAllRead = useCallback(async (): Promise<void> => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await notifApi.markAllRead();
    } catch {
      /* ignore */
    }
  }, []);

  const value: NotificationContextValue = {
    items, unread, loading, refresh, markRead, markAllRead,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    // Safe fallback — components can still render without a provider in tests.
    return {
      items: [],
      unread: 0,
      loading: false,
      refresh: async () => {},
      markRead: async () => {},
      markAllRead: async () => {},
    };
  }
  return ctx;
}
