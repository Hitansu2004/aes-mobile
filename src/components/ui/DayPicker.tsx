import React, { useEffect, useMemo, useRef } from 'react';
import {
  LayoutChangeEvent, Pressable, ScrollView, View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives';
import { radius, space } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { useHaptics } from '@/hooks/useHaptics';

// Ported from ../../aes-frontend/src/components/ui/DayPicker.js +
// DayPicker.module.css. Today is always disabled — backend requires
// scheduledDate >= tomorrow. MOTION: selected cell springs up + gold fill
// (web only has a CSS transition), selection fires Haptics.selectionAsync().
const WEEKDAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface Day {
  iso: string;
  weekday: string;
  day: number;
  month: string;
  isToday: boolean;
}

function buildDays(count: number): Day[] {
  const out: Day[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    out.push({
      iso: `${yyyy}-${mm}-${dd}`,
      weekday: WEEKDAY[d.getDay()],
      day: d.getDate(),
      month: d.toLocaleString('en-US', { month: 'short' }),
      isToday: i === 0,
    });
  }
  return out;
}

export interface DayAvailability {
  used: number;
  capacity: number;
  available: number;
  full: boolean;
  busyReason?: string;
}

export interface DayPickerProps {
  value?: string | null;
  onChange: (iso: string) => void;
  days?: number;
  availability?: Record<string, DayAvailability>;
  dayCapacity?: number;
}

const CELL_WIDTH = 72;
const CELL_GAP = 10;

export function DayPicker({
  value, onChange, days = 14, availability, dayCapacity = 30,
}: DayPickerProps) {
  const { tokens } = useTheme();
  const haptics = useHaptics();
  const list = useMemo(() => buildDays(days), [days]);
  const scrollRef = useRef<ScrollView>(null);
  const scrollWidth = useRef(0);

  useEffect(() => {
    if (!value) return;
    const index = list.findIndex((d) => d.iso === value);
    if (index === -1) return;
    const cellCenter = index * (CELL_WIDTH + CELL_GAP) + CELL_WIDTH / 2;
    const target = Math.max(0, cellCenter - scrollWidth.current / 2);
    scrollRef.current?.scrollTo({ x: target, animated: true });
  }, [value, list]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(e: LayoutChangeEvent) => { scrollWidth.current = e.nativeEvent.layout.width; }}
      contentContainerStyle={{ gap: CELL_GAP, paddingBottom: 4 }}
    >
      {list.map((d) => {
        const a = availability?.[d.iso];
        const fullCapacity = a?.full === true;
        const fewLeft = !!a && !fullCapacity && a.available <= Math.ceil(dayCapacity * 0.2);
        const selected = value === d.iso;
        const disabled = d.isToday || fullCapacity;
        const remainingLabel = a ? (fullCapacity ? 'Full' : `${a.available} left`) : null;

        return (
          <DayCell
            key={d.iso}
            day={d}
            availability={a}
            selected={selected}
            disabled={disabled}
            fewLeft={fewLeft}
            fullCapacity={fullCapacity}
            remainingLabel={remainingLabel}
            tokens={tokens}
            onPress={() => {
              if (disabled) return;
              haptics.selection();
              onChange(d.iso);
            }}
          />
        );
      })}
    </ScrollView>
  );
}

interface DayCellProps {
  day: Day;
  availability?: DayAvailability;
  selected: boolean;
  disabled: boolean;
  fewLeft: boolean;
  fullCapacity: boolean;
  remainingLabel: string | null;
  tokens: ReturnType<typeof useTheme>['tokens'];
  onPress: () => void;
}

function DayCell({
  day, availability, selected, disabled, fewLeft, fullCapacity, remainingLabel, tokens, onPress,
}: DayCellProps) {
  const lift = useSharedValue(0);

  useEffect(() => {
    lift.value = withSpring(selected ? -2 : 0, { damping: 14, stiffness: 220 });
  }, [selected, lift]);

  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
  }));

  let bg = tokens.colors.surfaceContainerLowest;
  let border = tokens.colors.borderLight;
  let fg = tokens.colors.onSurface;
  let mutedFg = tokens.colors.onSurfaceVariant;
  let remainingFg = tokens.colors.onSurfaceVariant;
  let fillColor = tokens.colors.secondary;
  let trackColor = tokens.colors.borderLight;

  if (fewLeft) {
    border = '#f59e0b';
    bg = '#fef3c7';
    remainingFg = '#b45309';
    fillColor = '#f59e0b';
    trackColor = '#fde68a';
  }
  if (fullCapacity) {
    bg = '#fef2f2';
    border = '#fecaca';
    fg = '#b91c1c';
    remainingFg = '#b91c1c';
    fillColor = '#ef4444';
  }
  if (selected) {
    bg = tokens.colors.secondary;
    border = tokens.colors.secondary;
    fg = tokens.colors.onSecondary;
    mutedFg = 'rgba(255,255,255,0.85)';
    remainingFg = 'rgba(255,255,255,0.85)';
    fillColor = 'rgba(255,255,255,0.8)';
  }

  const fillPct = availability ? Math.min(100, (availability.used / availability.capacity) * 100) : 0;

  return (
    <Animated.View style={liftStyle}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={`${day.weekday} ${day.month} ${day.day}${disabled ? ' (not available)' : ''}`}
        style={{
          width: CELL_WIDTH,
          paddingTop: 12,
          paddingHorizontal: 8,
          paddingBottom: 8,
          borderRadius: 14,
          backgroundColor: bg,
          borderWidth: 1.5,
          borderColor: border,
          alignItems: 'center',
          gap: 3,
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <Text style={{ fontSize: 10, fontFamily: font('body', 700), letterSpacing: 0.8, color: mutedFg, textTransform: 'uppercase' }}>
          {day.weekday}
        </Text>
        <Text style={{ fontSize: 22, fontFamily: font('body', 700), lineHeight: 24, color: fg, textDecorationLine: fullCapacity ? 'line-through' : 'none' }}>
          {day.day}
        </Text>
        <Text style={{ fontSize: 10, fontFamily: font('body', 600), letterSpacing: 0.6, color: mutedFg, textTransform: 'uppercase' }}>
          {day.month}
        </Text>
        {availability && (
          <>
            <View style={{
              width: '100%', height: 3, marginTop: 4, borderRadius: 2, backgroundColor: trackColor, overflow: 'hidden',
            }}
            >
              <View style={{
                width: `${fillPct}%`, height: '100%', backgroundColor: fillColor,
              }}
              />
            </View>
            <Text style={{ fontSize: 9, fontFamily: font('body', 600), letterSpacing: 0.36, color: remainingFg, textTransform: 'uppercase' }}>
              {remainingLabel}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
