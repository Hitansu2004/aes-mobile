import React, {
  createContext, useCallback, useContext, useMemo, useRef, useState,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AnimatePresence, MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  AlertTriangle, CheckCircle2, Info, X, XCircle,
} from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { font } from '@/theme/typography';
import { Text } from '@/components/primitives/Text';
import { ColorToken } from '@/theme/tokens';

// Ported from ../../aes-frontend/src/components/ui/Toast.js.
export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastEntry {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  success: (message: string, duration?: number) => number;
  error: (message: string, duration?: number) => number;
  info: (message: string, duration?: number) => number;
  warning: (message: string, duration?: number) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 0;

const TONE_COLOR: Record<ToastVariant, ColorToken> = {
  success: 'success',
  error: 'error',
  info: 'secondary',
  warning: 'warning',
};

function ToastIcon({ variant, color }: { variant: ToastVariant; color: string }) {
  if (variant === 'success') return <CheckCircle2 size={20} color={color} />;
  if (variant === 'error') return <XCircle size={20} color={color} />;
  if (variant === 'warning') return <AlertTriangle size={20} color={color} />;
  return <Info size={20} color={color} />;
}

function fireHaptic(variant: ToastVariant): void {
  if (variant === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (variant === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  else if (variant === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const push = useCallback((variant: ToastVariant, message: string, duration = 3500): number => {
    const id = ++nextId;
    setToasts((t) => [...t, { id, variant, message }]);
    fireHaptic(variant);
    timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const value = useMemo<ToastContextValue>(() => ({
    success: (msg, d) => push('success', msg, d),
    error: (msg, d) => push('error', msg, d),
    info: (msg, d) => push('info', msg, d),
    warning: (msg, d) => push('warning', msg, d),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[styles.stack, { top: insets.top + space[3] }]}>
        <AnimatePresence>
          {toasts.map((t) => {
            const toneColor = tokens.colors[TONE_COLOR[t.variant]];
            return (
              <MotiView
                key={t.id}
                from={{ opacity: 0, translateY: -16, scale: 0.95 }}
                animate={{ opacity: 1, translateY: 0, scale: 1 }}
                exit={{ opacity: 0, translateY: -8, scale: 0.95 }}
                transition={{ type: 'timing', duration: 200 }}
                style={[
                  styles.toast,
                  shadow('lg'),
                  {
                    backgroundColor: tokens.colors.surfaceContainerLowest,
                    borderColor: tokens.colors.borderLight,
                    borderLeftColor: toneColor,
                  },
                ]}
              >
                <ToastIcon variant={t.variant} color={toneColor} />
                <Text
                  variant="bodyMd"
                  style={[styles.message, { fontFamily: font('body', 500) }]}
                >
                  {t.message}
                </Text>
                <Pressable onPress={() => dismiss(t.id)} hitSlop={8} accessibilityLabel="Dismiss">
                  <X size={16} color={tokens.colors.onSurfaceVariant} />
                </Pressable>
              </MotiView>
            );
          })}
        </AnimatePresence>
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: space[4],
    zIndex: 999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    width: '100%',
    maxWidth: 420,
    marginBottom: space[2],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: radius.sm,
  },
  message: {
    flex: 1,
  },
});
