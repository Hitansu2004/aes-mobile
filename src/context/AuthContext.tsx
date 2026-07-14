import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { auth as authApi, user as userApi, setAuthFailureHandler } from '@/lib/api';
import {
  getToken,
  getRefreshToken,
  setToken,
  setRefreshToken,
  clearTokens,
  hydrateTokenCache,
  isTokenCacheHydrated,
} from '@/lib/storage';
import { reconnectStompClient } from '@/lib/stomp';
import { getRegisteredDeviceToken } from '@/hooks/usePushRegistration';
import type { User, UserRole } from '@/types/api';

// Ported from ../../aes-frontend/src/context/AuthContext.js.
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  fetchUser: () => Promise<User | null>;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUser = useCallback(async (): Promise<User | null> => {
    if (!isTokenCacheHydrated()) await hydrateTokenCache();
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const me = await userApi.getMe();
      setUser(me);
      return me;
    } catch {
      await clearTokens();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Wire global auth-failure handler so 401s after refresh-fail force a redirect.
  useEffect(() => {
    setAuthFailureHandler(() => {
      setUser(null);
      router.replace('/login');
    });
    return () => setAuthFailureHandler(null);
  }, [router]);

  const login = useCallback(async (identifier: string, password: string): Promise<void> => {
    const data = await authApi.login(identifier, password);
    await Promise.all([setToken(data.accessToken), setRefreshToken(data.refreshToken ?? null)]);
    setUser(data.user ?? null);
    reconnectStompClient();
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      const refresh = getRefreshToken();
      if (refresh) await authApi.logout(refresh, getRegisteredDeviceToken() ?? undefined);
    } catch {
      /* ignore */
    }
    await clearTokens();
    setUser(null);
    reconnectStompClient();
    router.replace('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, fetchUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Default route for a given role. */
export function defaultRouteForRole(role: UserRole | undefined): string {
  if (role === 'SUPER_ADMIN') return '/admin/revenue';
  if (role === 'OPS_MANAGER') return '/crm'; // V14: ops triage retired, goes to pool
  if (role === 'CRM_AGENT') return '/crm';
  if (role === 'SITE_ENGINEER') return '/engineer';
  if (role === 'SERVICE_MANAGER' || role === 'ADMIN') return '/admin';
  return '/dashboard';
}
