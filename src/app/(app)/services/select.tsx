import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { Splash } from '@/components/shell/Splash';

// Ported from ../../aes-frontend/src/app/services/select/page.js — a legacy
// route kept alive purely as a redirect to /services.
export default function SelectRequestTypeRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/services');
  }, [router]);

  return <Splash message="Opening services hub…" />;
}
