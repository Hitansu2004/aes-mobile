import React, { useEffect, useRef } from 'react';
import {
  NativeSyntheticEvent, Platform, TextInput, TextInputKeyPressEventData, View,
} from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

// Ported from ../../aes-frontend/src/components/ui/OtpInput.js +
// OtpInput.module.css. RN specifics: keyboardType="number-pad",
// textContentType="oneTimeCode" (iOS SMS auto-fill), autoComplete="sms-otp"
// (Android SMS auto-fill) — a genuinely nice touch the web can't do. Used by
// PaymentModal. Shake-on-error is a Reanimated port of the web's `.shake`
// keyframes.
export interface OtpInputProps {
  value?: string;
  onChange: (next: string) => void;
  length?: number;
  autoFocus?: boolean;
  onComplete?: (code: string) => void;
  error?: boolean;
}

export function OtpInput({
  value = '', onChange, length = 6, autoFocus = true, onComplete, error = false,
}: OtpInputProps) {
  const { tokens } = useTheme();
  const refs = useRef<(TextInput | null)[]>([]);
  const shakeX = useSharedValue(0);
  const wasError = useRef(false);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (error && !wasError.current) {
      shakeX.value = withSequence(
        withTiming(-4, { duration: 60 }),
        withTiming(4, { duration: 80 }),
        withTiming(-4, { duration: 80 }),
        withTiming(4, { duration: 80 }),
        withTiming(0, { duration: 60 }),
      );
    }
    wasError.current = error;
  }, [error, shakeX]);

  const setAt = (i: number, ch: string) => {
    const arr = value.padEnd(length, ' ').split('');
    arr[i] = ch;
    return arr.join('').replace(/\s/g, '');
  };

  const handleChangeText = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');

    // Android/iOS SMS auto-fill can drop the whole code into one box.
    if (digits.length > 1) {
      const pasted = digits.slice(0, length);
      onChange(pasted);
      refs.current[Math.min(pasted.length, length - 1)]?.focus();
      if (pasted.length === length) onComplete?.(pasted);
      return;
    }

    if (!digits) return;
    const next = setAt(i, digits);
    onChange(next);
    if (i < length - 1) refs.current[i + 1]?.focus();
    if (next.length === length) onComplete?.(next);
  };

  const handleKeyPress = (i: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key !== 'Backspace') return;
    if (value[i]) {
      onChange(setAt(i, ''));
    } else if (i > 0) {
      refs.current[i - 1]?.focus();
      onChange(value.slice(0, i - 1));
    }
  };

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  return (
    <Animated.View style={[{ flexDirection: 'row', gap: 10, justifyContent: 'center' }, shakeStyle]}>
      {Array.from({ length }).map((_, i) => {
        const filled = !!value[i];
        return (
          <TextInput
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            value={value[i] || ''}
            onChangeText={(t) => handleChangeText(i, t)}
            onKeyPress={(e) => handleKeyPress(i, e)}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete={Platform.OS === 'android' ? 'sms-otp' : undefined}
            maxLength={length}
            accessibilityLabel={`Digit ${i + 1} of ${length}`}
            style={{
              width: 48,
              height: 56,
              borderRadius: 12,
              backgroundColor: filled ? tokens.colors.surfaceContainerLowest : tokens.colors.surfaceContainerLow,
              borderWidth: 1.5,
              borderColor: error ? tokens.colors.error : (filled ? tokens.colors.surfaceContainerHigh : 'transparent'),
              textAlign: 'center',
              fontSize: 22,
              fontWeight: '700',
              color: tokens.colors.onSurface,
            }}
          />
        );
      })}
    </Animated.View>
  );
}
