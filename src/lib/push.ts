/**
 * Push notifications — Expo token lifecycle + Android channels.
 *
 * Ported from nothing on the web (../../aes-frontend polls every 60s via
 * NotificationContext.js) — this is entirely mobile-only, wiring
 * expo-notifications to the backend's device-token endpoints
 * (../../aes-backend-node fix-pack Phase B3).
 *
 * Channel ids here MUST match PushService.ts's comment block byte-for-byte
 * (src/services/PushService.ts in aes-backend-node) or Android silently
 * downgrades the notification into the default channel.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { devices as devicesApi } from './api';
import { getItem, setItem } from './storage';

export const PUSH_PREF_KEY = 'aes_push_enabled';
export const PUSH_DENIED_KEY = 'aes_push_denied';

type ChannelId = 'default' | 'jobs' | 'urgent';

const ANDROID_CHANNELS: {
  id: ChannelId;
  name: string;
  importance: Notifications.AndroidImportance;
  vibrate: boolean;
  sound: boolean;
}[] = [
  { id: 'default', name: 'Updates', importance: Notifications.AndroidImportance.DEFAULT, vibrate: false, sound: false },
  { id: 'jobs', name: 'Job assignments', importance: Notifications.AndroidImportance.HIGH, vibrate: true, sound: false },
  { id: 'urgent', name: 'Urgent & SLA', importance: Notifications.AndroidImportance.MAX, vibrate: true, sound: true },
];

/** Shows the OS alert + plays a sound while the app is foregrounded — Expo
 * suppresses both of those by default, which reads as "push is broken".
 * No-op on web: expo-notifications has no web implementation of this call,
 * and push itself is a mobile-only feature (see this file's header). */
export function configureNotificationHandler(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/** Call once at app start, before any push arrives. No-op on iOS. */
export async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Promise.all(
    ANDROID_CHANNELS.map(({ id, name, importance, vibrate, sound }) =>
      Notifications.setNotificationChannelAsync(id, {
        name,
        importance,
        lightColor: '#0B1A2C',
        vibrationPattern: vibrate ? [0, 250, 250, 250] : undefined,
        sound: sound ? 'default' : undefined,
        enableVibrate: vibrate,
      })),
  );
}

/**
 * Request permission (once — iOS only ever asks once, a second call after a
 * denial silently returns denied forever) and register the resulting Expo
 * push token with the backend. Returns the token, or null if unavailable —
 * a simulator/emulator, a denial, or a network failure are all treated the
 * same way: push is simply off, nothing throws.
 */
export async function registerForPushNotifications(
  appVersion: string,
  deviceName?: string,
): Promise<string | null> {
  if (Platform.OS === 'web') return null; // no push on web, same "silently off" contract
  if (!Device.isDevice) return null; // Expo tokens don't work on a simulator

  let perm = await Notifications.getPermissionsAsync();
  if (perm.status === 'undetermined') {
    perm = await Notifications.requestPermissionsAsync();
  }
  if (perm.status !== 'granted') {
    await setItem(PUSH_DENIED_KEY, '1');
    return null;
  }
  await setItem(PUSH_DENIED_KEY, '0');

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );

  await devicesApi.register(token, Platform.OS === 'ios' ? 'ios' : 'android', deviceName, appVersion);
  await setItem(PUSH_PREF_KEY, '1');
  return token;
}

/** Was permission already denied? Checked before showing our own UI so we
 * never re-nag inside a session — the user has to go to system settings. */
export async function wasPushDenied(): Promise<boolean> {
  return (await getItem(PUSH_DENIED_KEY)) === '1';
}

export async function unregisterPushToken(token: string): Promise<void> {
  try {
    await devicesApi.unregister(token);
  } catch {
    /* device row will also be reaped server-side on next failed send */
  }
  await setItem(PUSH_PREF_KEY, '0');
}

/** Silent re-registration for app boot: only ever called when the user
 * previously opted in AND the OS permission is still granted — never
 * prompts, never nags. Tokens can rotate between installs so we re-fetch
 * rather than trusting a cached value. */
export async function silentlyReregisterIfOptedIn(appVersion: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null;
  const pref = await getItem(PUSH_PREF_KEY);
  if (pref !== '1') return null;
  const perm = await Notifications.getPermissionsAsync();
  if (perm.status !== 'granted') {
    await setItem(PUSH_PREF_KEY, '0');
    return null;
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  await devicesApi.register(token, Platform.OS === 'ios' ? 'ios' : 'android', undefined, appVersion);
  return token;
}

/** Pulls the deep link out of a notification response payload, e.g. the
 * object passed to addNotificationResponseReceivedListener or returned by
 * getLastNotificationResponseAsync(). */
export function deepLinkFromResponse(
  response: Notifications.NotificationResponse | null | undefined,
): string | undefined {
  const data = response?.notification?.request?.content?.data as { deepLink?: unknown } | undefined;
  return typeof data?.deepLink === 'string' ? data.deepLink : undefined;
}
