import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { Timer } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives';
import { radius, space } from '@/theme/spacing';
import { font } from '@/theme/typography';
import useSlaCountdown, { SlaTone } from '@/hooks/useSlaCountdown';
import { useHaptics } from '@/hooks/useHaptics';

// Ported from ../../aes-frontend/src/components/ui/SlaCountdown.js +
// SlaCountdown.module.css, backed by the already-ported useSlaCountdown
// hook. MOTION additions beyond the web: the chip pulses (ported from
// globals.css `.pulse` keyframes) when tone flips to 'critical', and fires
// a single warning haptic the instant tone flips to 'breached'.
const TONE_LABEL: Record<SlaTone, string> = {
  safe: 'Response time',
  warning: 'Response Deadline',
  critical: 'RESPOND NOW',
  breached: 'SLA Breached',
};

// Chip tone hexes are copied verbatim from SlaCountdown.module.css — no
// matching semantic token exists for these, same treatment as PriorityBadge.
const CHIP_TONE: Record<SlaTone, { bg: string; fg: string }> = {
  safe: { bg: '#dcfce7', fg: '#166534' },
  warning: { bg: '#fef3c7', fg: '#b45309' },
  critical: { bg: '#fee2e2', fg: '#b91c1c' },
  breached: { bg: '', fg: '' }, // resolved from tokens.colors.error/onError below
};

const BANNER_TONE: Record<SlaTone, { bg: string; border: string; fg: string; barTrack: string; barFill: string }> = {
  safe: {
    bg: '#ecfdf5', border: '#a7f3d0', fg: '#065f46', barTrack: 'rgba(22, 101, 52, 0.18)', barFill: '#10b981',
  },
  warning: {
    bg: '#fff8f0', border: '#fcd9a4', fg: '#b45309', barTrack: 'rgba(180, 83, 9, 0.18)', barFill: '#f59e0b',
  },
  critical: {
    bg: '#fee2e2', border: '#fca5a5', fg: '#991b1b', barTrack: 'rgba(153, 27, 27, 0.20)', barFill: '#ef4444',
  },
  breached: {
    bg: '', border: '', fg: '', barTrack: 'rgba(255, 255, 255, 0.30)', barFill: '#ffffff',
  },
};

export interface SlaCountdownProps {
  deadlineISO?: string | null;
  initialOffsetSeconds?: number;
  variant?: 'chip' | 'banner';
  totalSeconds?: number;
  label?: string;
}

export function SlaCountdown({
  deadlineISO, initialOffsetSeconds, variant = 'chip', totalSeconds, label,
}: SlaCountdownProps) {
  const { tokens } = useTheme();
  const haptics = useHaptics();
  const { displayText, tone, remainingSeconds } = useSlaCountdown(deadlineISO, { initialOffsetSeconds });

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const prevTone = useRef<SlaTone | null>(null);

  useEffect(() => {
    if (tone === 'critical') {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      scale.value = withTiming(1, { duration: 150 });
      opacity.value = withTiming(1, { duration: 150 });
    }

    if (tone === 'breached' && prevTone.current !== 'breached') {
      haptics.warning();
    }
    prevTone.current = tone;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tone]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (variant === 'banner') {
    const safeTotal = totalSeconds && totalSeconds > 0 ? totalSeconds : 1800;
    const pct = remainingSeconds == null
      ? 0
      : Math.max(0, Math.min(100, (remainingSeconds / safeTotal) * 100));
    const bt = tone === 'breached'
      ? {
        bg: tokens.colors.error, border: tokens.colors.error, fg: tokens.colors.onError, barTrack: BANNER_TONE.breached.barTrack, barFill: BANNER_TONE.breached.barFill,
      }
      : BANNER_TONE[tone];

    return (
      <View
        style={{
          borderRadius: radius.md,
          padding: 14,
          paddingHorizontal: space[4],
          gap: 10,
          borderWidth: 1,
          backgroundColor: bt.bg,
          borderColor: bt.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Timer size={18} color={bt.fg} />
          <Text style={{ fontSize: 14, fontFamily: font('body', 600), color: bt.fg, flexShrink: 1 }}>
            {`${label || TONE_LABEL[tone]}: ${displayText}${tone !== 'breached' ? ' remaining' : ''}`}
          </Text>
        </View>
        <View style={{
          width: '100%', height: 4, borderRadius: radius.full, overflow: 'hidden', backgroundColor: bt.barTrack,
        }}
        >
          <View style={{
            height: '100%', width: `${pct}%`, borderRadius: radius.full, backgroundColor: bt.barFill,
          }}
          />
        </View>
      </View>
    );
  }

  const ct = tone === 'breached'
    ? { bg: tokens.colors.error, fg: tokens.colors.onError }
    : CHIP_TONE[tone];

  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 6,
          paddingVertical: 4,
          paddingHorizontal: 10,
          borderRadius: radius.full,
          backgroundColor: ct.bg,
        },
        pulseStyle,
      ]}
    >
      <Timer size={14} color={ct.fg} strokeWidth={2.4} />
      <Text style={{ fontSize: 12, fontFamily: font('body', 700), letterSpacing: 0.24, color: ct.fg }}>
        {`${displayText}${tone === 'critical' ? ' · RESPOND NOW' : ''}`}
      </Text>
    </Animated.View>
  );
}
