import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { Splash } from '@/components/shell/Splash';

// Ported from ../../aes-frontend/src/app/page.js (HomeRedirector).
export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    router.replace(defaultRouteForRole(user.role));
  }, [user, loading, router]);

  return <Splash />;
}
