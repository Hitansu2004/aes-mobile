import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

import {
  configureNotificationHandler,
  deepLinkFromResponse,
  ensureAndroidChannels,
  silentlyReregisterIfOptedIn,
} from '@/lib/push';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';

/**
 * Live registration + notification-tap wiring for Phase 19. AuthContext's
 * logout() reads getRegisteredDeviceToken() so the backend's
 * unregister-on-logout call (POST /auth/logout { deviceToken }) knows which
 * row to delete — kept as a plain module var (not context state) because it
 * has to be readable synchronously from inside logout() with no re-render.
 */
let registeredDeviceToken: string | null = null;

export function getRegisteredDeviceToken(): string | null {
  return registeredDeviceToken;
}

export function setRegisteredDeviceToken(token: string | null): void {
  registeredDeviceToken = token;
}

const APP_VERSION = Application.nativeApplicationVersion || '0.0.0';

/** A tap that arrives before the user is authenticated (cold start straight
 * into the login screen) can't be routed yet — stash it and replay once
 * AuthContext resolves a user. */
let pendingDeepLink: string | null = null;

/**
 * Mount once, near the app root, inside every provider it depends on
 * (AuthProvider for the current user/router redirect, NotificationProvider
 * for the bell-badge refresh). Sets up Android channels + the foreground
 * handler exactly once, listens for taps for the app's lifetime, and
 * replays a cold-start tap (getLastNotificationResponseAsync) — the single
 * most-missed bug in RN push: when the app was launched BY the tap, the
 * live listener below never fires for that first notification.
 */
// expo-notifications has no web implementation for most of this API
// (setNotificationHandler, getLastNotificationResponseAsync, the tap
// listeners) — they throw "not available on web" at call time, not build
// time. Push is a mobile-only feature to begin with (the web app has no
// push at all, it polls every 60s — see push.ts's header), so every effect
// below just no-ops on web rather than guard each expo-notifications call
// individually.
const IS_WEB = Platform.OS === 'web';

export function usePushRegistration(): void {
  const { user } = useAuth();
  const { refresh } = useNotifications();
  const router = useRouter();
  const setupDone = useRef(false);
  const coldStartChecked = useRef(false);

  useEffect(() => {
    if (IS_WEB || setupDone.current) return;
    setupDone.current = true;
    configureNotificationHandler();
    ensureAndroidChannels();
  }, []);

  // Silent re-registration for a returning, previously-opted-in user —
  // never prompts. Runs once the user is known.
  useEffect(() => {
    if (IS_WEB || !user) return;
    (async () => {
      const token = await silentlyReregisterIfOptedIn(APP_VERSION);
      if (token) setRegisteredDeviceToken(token);
    })();
  }, [user]);

  const routeToDeepLink = (deepLink: string | undefined) => {
    if (!deepLink) return;
    if (!user) {
      pendingDeepLink = deepLink;
      return;
    }
    router.push(deepLink as never);
  };

  // Replay a stashed deep link (arrived pre-auth) the moment login resolves.
  useEffect(() => {
    if (!user || !pendingDeepLink) return;
    const deepLink = pendingDeepLink;
    pendingDeepLink = null;
    router.push(deepLink as never);
  }, [user, router]);

  // Cold start: the app was launched BY tapping a notification.
  useEffect(() => {
    if (IS_WEB || coldStartChecked.current) return;
    coldStartChecked.current = true;
    Notifications.getLastNotificationResponseAsync().then((response) => {
      routeToDeepLink(deepLinkFromResponse(response));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Foreground/background delivery — refresh the bell badge immediately
  // instead of waiting on the 60s poll.
  useEffect(() => {
    if (IS_WEB) return undefined;
    const sub = Notifications.addNotificationReceivedListener(() => {
      refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // The user tapped a notification while the app was running (foreground or
  // backgrounded, not killed — the killed case is the cold-start effect above).
  useEffect(() => {
    if (IS_WEB) return undefined;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      routeToDeepLink(deepLinkFromResponse(response));
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);
}
