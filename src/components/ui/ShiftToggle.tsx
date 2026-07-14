import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring,
} from 'react-native-reanimated';
import { Power } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives';
import { radius } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { staff } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { useHaptics } from '@/hooks/useHaptics';

// Ported from ../../aes-frontend/src/components/ui/ShiftToggle.js. End-shift
// is always a soft pause — every active assignment stays with the agent.
// MOTION: an animated track + knob spring across; track turns success-green
// when on-shift; haptic on toggle (a genuine upgrade over the web's plain
// button, which has no track/knob at all — compact variant here reuses the
// web's pill look, and a new track+knob switch is added for the full variant).
export interface ActiveWork {
  tickets?: number;
  offers?: number;
}

export interface ShiftToggleProps {
  onShift?: boolean;
  onChange?: (next: boolean) => void;
  compact?: boolean;
  activeWork?: ActiveWork;
}

export function ShiftToggle({
  onShift, onChange, compact = false, activeWork,
}: ShiftToggleProps) {
  const { tokens } = useTheme();
  const toast = useToast();
  const haptics = useHaptics();
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState(!!onShift);

  const knobX = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    knobX.value = withSpring(value ? 1 : 0, { damping: 16, stiffness: 220 });
  }, [value, knobX]);

  const toggle = async () => {
    const next = !value;
    setBusy(true);
    haptics.selection();
    try {
      await staff.toggleShift({ onShift: next, handoffWork: false });
      setValue(next);
      toast.success(
        next
          ? 'You are now on shift.'
          : 'You are off shift. Your tickets are paused, not reassigned.',
      );
      onChange?.(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not toggle shift.');
    } finally {
      setBusy(false);
    }
  };

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: knobX.value > 0.5 ? tokens.colors.success : tokens.colors.outlineVariant,
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knobX.value * 20 }],
  }));

  if (compact) {
    return (
      <Pressable
        onPress={toggle}
        disabled={busy}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled: busy }}
        accessibilityLabel={value ? 'On shift — tap to pause' : 'Off shift — tap to come back on'}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: value ? tokens.colors.success : tokens.colors.outlineVariant,
          backgroundColor: value ? tokens.colors.successLight : tokens.colors.surfaceContainer,
          opacity: busy ? 0.6 : 1,
        }}
      >
        <Power size={13} color={value ? tokens.colors.success : tokens.colors.onSurfaceVariant} />
        <Text style={{
          fontSize: 12, fontFamily: font('body', 700), color: value ? tokens.colors.success : tokens.colors.onSurfaceVariant,
        }}
        >
          {value ? 'ON SHIFT' : 'OFF SHIFT'}
        </Text>
      </Pressable>
    );
  }

  const ticketCount = activeWork?.tickets ?? 0;
  const offerCount = activeWork?.offers ?? 0;
  const hasWork = ticketCount + offerCount > 0;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: tokens.colors.surfaceContainerLowest,
        borderWidth: 1,
        borderColor: value ? tokens.colors.success : tokens.colors.outlineVariant,
        borderRadius: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontFamily: font('body', 700), color: tokens.colors.onSurface }}>
          {value ? 'You are on shift' : 'You are off shift'}
        </Text>
        <Text style={{
          fontSize: 12, color: tokens.colors.onSurfaceVariant, marginTop: 2, lineHeight: 17,
        }}
        >
          {value
            ? `You will receive new offers and ticket pings.${hasWork ? ` Currently holding ${ticketCount} ticket${ticketCount === 1 ? '' : 's'} · ${offerCount} pending offer${offerCount === 1 ? '' : 's'}.` : ''}`
            : 'No new offers will be routed to you. Existing tickets are still yours — toggle on to resume.'}
        </Text>
      </View>

      <Pressable
        onPress={toggle}
        disabled={busy}
        accessibilityRole="switch"
        accessibilityLabel="On shift"
        accessibilityState={{ checked: value, disabled: busy }}
      >
        <Animated.View
          style={[
            {
              width: 48, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center',
            },
            trackStyle,
            { opacity: busy ? 0.6 : 1 },
          ]}
        >
          <Animated.View
            style={[
              {
                width: 22, height: 22, borderRadius: 11, backgroundColor: '#ffffff',
              },
              knobStyle,
            ]}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}
