import { useMemo } from 'react';
import * as Haptics from 'expo-haptics';

/**
 * Thin haptic wrappers — every screen fires feedback through these, never
 * expo-haptics directly (see CLAUDE.md). Each call is a no-op on web/
 * unsupported hardware: expo-haptics already no-ops on web, and any device
 * without a haptics engine throws synchronously, which we swallow here.
 */
export interface Haptics_ {
  tapLight: () => void;
  tapMedium: () => void;
  success: () => void;
  warning: () => void;
  error: () => void;
  selection: () => void;
}

function safe(fn: () => Promise<void>): void {
  fn().catch(() => {});
}

export function useHaptics(): Haptics_ {
  return useMemo<Haptics_>(() => ({
    tapLight: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
    tapMedium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
    success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
    warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
    error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
    selection: () => safe(() => Haptics.selectionAsync()),
  }), []);
}
