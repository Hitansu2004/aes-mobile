import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { Splash } from '@/components/shell/Splash';

// Auth guard for every route under (app)/ — ported from the intent of
// ../../aes-frontend/src/components/Shell.js + AuthContext.js's redirect
// behaviour. Every screen under (app)/ renders its own <AppShell ...> (with
// its own hero/focused/bare props), so this layout must NOT wrap the Stack
// in a second AppShell — a blanket wrap here would nest AppShell twice and
// always show the sidebar/top bar/bottom nav even on `focused` screens like
// the installation wizard, which need the chrome-free full-bleed layout.
export default function AppGroupLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading || user) return;
    const next = `/${segments.join('/')}`;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [loading, user, segments, router]);

  if (loading) return <Splash />;
  if (!user) return <Splash />;

  // Bottom-nav / sidebar destinations cross-fade into each other (they're
  // tabs, not a drill-down); everything else — ticket/installation detail,
  // the wizards — keeps the default slide_from_right push. CLAUDE.md Phase 20,
  // TRANSITIONS.
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="dashboard" options={{ animation: 'fade' }} />
      <Stack.Screen name="tickets/index" options={{ animation: 'fade' }} />
      <Stack.Screen name="installations/index" options={{ animation: 'fade' }} />
      <Stack.Screen name="services/index" options={{ animation: 'fade' }} />
      <Stack.Screen name="account" options={{ animation: 'fade' }} />
      <Stack.Screen name="crm" options={{ animation: 'fade' }} />
      <Stack.Screen name="ops" options={{ animation: 'fade' }} />
      <Stack.Screen name="engineer" options={{ animation: 'fade' }} />
      <Stack.Screen name="admin/index" options={{ animation: 'fade' }} />
      <Stack.Screen name="admin/revenue" options={{ animation: 'fade' }} />
      <Stack.Screen name="admin/coupons" options={{ animation: 'fade' }} />
    </Stack>
  );
}
