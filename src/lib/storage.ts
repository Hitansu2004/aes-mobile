/**
 * Storage — token/session data goes through expo-secure-store (encrypted
 * Keychain on iOS, EncryptedSharedPreferences on Android); everything else
 * (theme, wizard drafts) goes through AsyncStorage.
 *
 * SecureStore is async, but api.ts needs to read the access token
 * synchronously inside every request. We keep an in-memory cache that is
 * hydrated once at app boot (see hydrateTokenCache) and written through to
 * SecureStore on every change.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// expo-secure-store's web implementation is broken in this SDK version
// (`getValueWithKeyAsync is not a function` at runtime, not a build-time
// issue) — the Chrome/expo-web dev build isn't a store-shipping target
// (no Keychain/EncryptedSharedPreferences exists in a browser anyway), so
// tokens fall back to AsyncStorage there. iOS/Android still get the real
// encrypted SecureStore.
const secureGet = (key: string) => (Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key));
const secureSet = (key: string, value: string) => (Platform.OS === 'web' ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value));
const secureDelete = (key: string) => (Platform.OS === 'web' ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key));

export const TOKEN_KEY = 'aes_token';
export const REFRESH_TOKEN_KEY = 'aes_refresh_token';

export const THEME_KEY = 'aes_theme';
export const INSTALL_DRAFT_KEY = 'aes_install_draft_v1';
export const SERVICE_DRAFT_KEY = 'aes_service_draft_v1';

// SecureStore is backed by the Android Keystore on some devices, which caps
// individual values around 2048 bytes. JWTs are normally well under this,
// but a mis-issued token could silently fail to persist — warn loudly
// rather than let the user get logged out for no visible reason.
const SECURE_STORE_WARN_BYTES = 2000;

function warnIfNearSecureStoreLimit(key: string, value: string): void {
  if (value.length > SECURE_STORE_WARN_BYTES) {
    console.warn(
      `[storage] "${key}" is ${value.length} bytes, close to SecureStore's ~2048 byte ` +
        'limit on some Android devices. It may fail to persist.',
    );
  }
}

let tokenCache: string | null = null;
let refreshTokenCache: string | null = null;
let hydrated = false;

/** Call once at app boot, before the first API request is made. */
export async function hydrateTokenCache(): Promise<void> {
  const [token, refreshToken] = await Promise.all([
    secureGet(TOKEN_KEY),
    secureGet(REFRESH_TOKEN_KEY),
  ]);
  tokenCache = token;
  refreshTokenCache = refreshToken;
  hydrated = true;
}

export function isTokenCacheHydrated(): boolean {
  return hydrated;
}

/** Synchronous read from the in-memory cache — safe to call inside rawRequest. */
export function getToken(): string | null {
  return tokenCache;
}

export function getRefreshToken(): string | null {
  return refreshTokenCache;
}

export async function setToken(token: string | null): Promise<void> {
  tokenCache = token;
  if (token) {
    warnIfNearSecureStoreLimit(TOKEN_KEY, token);
    await secureSet(TOKEN_KEY, token);
  } else {
    await secureDelete(TOKEN_KEY);
  }
}

export async function setRefreshToken(token: string | null): Promise<void> {
  refreshTokenCache = token;
  if (token) {
    warnIfNearSecureStoreLimit(REFRESH_TOKEN_KEY, token);
    await secureSet(REFRESH_TOKEN_KEY, token);
  } else {
    await secureDelete(REFRESH_TOKEN_KEY);
  }
}

export async function clearTokens(): Promise<void> {
  await Promise.all([setToken(null), setRefreshToken(null)]);
}

// ─── Non-sensitive key/value storage (theme, wizard drafts) ────────────────
export async function getItem(key: string): Promise<string | null> {
  return AsyncStorage.getItem(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value);
}

export async function removeItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
