import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Every entry/press/transition animation in the app must collapse to a plain
// opacity fade when this is true (see CLAUDE.md Phase 20, "RESPECT THE USER").
// Apple and Google review for this — it is not optional polish.
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setReduceMotion(value);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduceMotion;
}
