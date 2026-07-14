import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { Appearance, ColorSchemeName, Platform, StyleSheet, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';

import { darkTokens, lightTokens, Tokens } from './tokens';

// Ported from ../aes-frontend/src/context/ThemeContext.js. Theme is
// 'light' | 'dark' | 'system', persisted under the same storage key the web
// app uses ('aes_theme') so behaviour parity is obvious when comparing the
// two apps side by side.
export type ThemeName = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'aes_theme';
const VALID = new Set<ThemeName>(['light', 'dark', 'system']);

interface ThemeContextValue {
  theme: ThemeName;
  resolvedTheme: ResolvedTheme;
  tokens: Tokens;
  setTheme: (next: ThemeName) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

function toResolved(scheme: ColorSchemeName): ResolvedTheme {
  return scheme === 'dark' ? 'dark' : 'light';
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('system');
  const [hydrated, setHydrated] = useState(false);
  const systemScheme = useColorScheme();
  const systemRef = useRef<ResolvedTheme>(toResolved(systemScheme));

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored && VALID.has(stored as ThemeName)) setThemeState(stored as ThemeName);
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // useColorScheme() already re-renders on OS theme change, but we also keep
  // an Appearance listener in sync so `system` never reads a stale value
  // between renders (mirrors the web's matchMedia 'change' listener).
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      systemRef.current = toResolved(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const resolvedTheme: ResolvedTheme = theme === 'system' ? toResolved(systemScheme) : theme;

  const setTheme = useCallback((next: ThemeName) => {
    if (!VALID.has(next)) return;
    setThemeState(next);
    if (next === 'system') {
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    } else {
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    }
  }, []);

  const toggleTheme = useCallback(() => {
    // Two-state toggle: flip whatever the user is currently *seeing*.
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  // Match the Android nav bar icon color to the theme, the closest analogue
  // to ThemeContext.js's applyToDom() flipping <meta name="theme-color">.
  // SDK 57 enforces edge-to-edge on Android: the nav bar is always
  // transparent and its background color can no longer be set from JS
  // (expo-navigation-bar dropped setBackgroundColorAsync), so only the
  // button/icon style is adjustable here.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    NavigationBar.setStyle(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme]);

  const tokens = resolvedTheme === 'dark' ? darkTokens : lightTokens;

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      tokens,
      setTheme,
      toggleTheme,
      isDark: resolvedTheme === 'dark',
    }),
    [theme, resolvedTheme, tokens, setTheme, toggleTheme],
  );

  if (!hydrated) return null;

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

// Every screen builds its StyleSheet through this hook instead of a
// module-level StyleSheet.create — a module-level sheet is created once and
// can never react to a theme change.
export function useThemedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<unknown>>(
  fn: (tokens: Tokens) => T,
): T {
  const { tokens } = useTheme();
  return useMemo(() => StyleSheet.create(fn(tokens)), [tokens, fn]);
}
