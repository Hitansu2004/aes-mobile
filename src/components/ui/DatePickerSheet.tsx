import React, {
  forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import { Pressable, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { useHaptics } from '@/hooks/useHaptics';
import { Text } from '@/components/primitives/Text';
import { Sheet, SheetRef } from '@/components/primitives/Sheet';

// RN has no native <input type="datetime-local"> equivalent — the web's
// coupon "valid until" field used one. MOBILE CHANGE: a small month-grid
// calendar in a bottom sheet, same forwardRef present()/dismiss() shape as
// every other sheet in the app (PaymentModal, LocationPicker, DetailSheets).
// Returns a UTC-midnight ISO string for the selected date, matching what the
// web sent via `new Date(validUntil).toISOString()` for a date-only pick.

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export interface DatePickerSheetRef extends SheetRef {}

export interface DatePickerSheetProps {
  value?: string | null;
  onChange: (iso: string) => void;
  minDate?: Date;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export const DatePickerSheet = forwardRef<DatePickerSheetRef, DatePickerSheetProps>(
  function DatePickerSheet({ value, onChange, minDate }, ref) {
    const { tokens } = useTheme();
    const haptics = useHaptics();
    const sheetRef = useRef<SheetRef>(null);
    const today = useMemo(() => startOfDay(new Date()), []);
    const min = minDate ? startOfDay(minDate) : today;
    const initial = value ? new Date(value) : today;
    const [cursor, setCursor] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }), []);

    const monthLabel = cursor.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const cells = useMemo(() => {
      const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const startWeekday = firstOfMonth.getDay();
      const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      const out: (Date | null)[] = [];
      for (let i = 0; i < startWeekday; i += 1) out.push(null);
      for (let d = 1; d <= daysInMonth; d += 1) out.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
      return out;
    }, [cursor]);

    const goPrev = useCallback(() => {
      haptics.tapLight();
      setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
    }, [haptics]);
    const goNext = useCallback(() => {
      haptics.tapLight();
      setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
    }, [haptics]);

    const selectedIso = value ? startOfDay(new Date(value)).toISOString() : null;

    return (
      <Sheet ref={sheetRef} title="Valid until" snapPoints={['62%']}>
        <View style={{ paddingHorizontal: space[5], paddingBottom: space[8], gap: space[4] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable
              onPress={goPrev}
              accessibilityLabel="Previous month"
              style={{
                width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
                backgroundColor: tokens.colors.surfaceContainerLow,
              }}
            >
              <ChevronLeft size={18} color={tokens.colors.onSurface} />
            </Pressable>
            <Text style={{ fontFamily: font('display', 600), fontSize: 17, color: tokens.colors.onSurfaceStrong }}>
              {monthLabel}
            </Text>
            <Pressable
              onPress={goNext}
              accessibilityLabel="Next month"
              style={{
                width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
                backgroundColor: tokens.colors.surfaceContainerLow,
              }}
            >
              <ChevronRight size={18} color={tokens.colors.onSurface} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row' }}>
            {WEEKDAY.map((w, i) => (
              <View key={`${w}-${i}`} style={{ width: `${100 / 7}%`, alignItems: 'center' }}>
                <Text style={{ fontFamily: font('mono', 600), fontSize: 10, letterSpacing: 1, color: tokens.colors.onSurfaceVariant }}>
                  {w}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((date, i) => {
              if (!date) return <View key={`empty-${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
              const iso = startOfDay(date).toISOString();
              const disabled = date < min;
              const selected = selectedIso === iso;
              return (
                <View key={iso} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }}>
                  <Pressable
                    disabled={disabled}
                    onPress={() => {
                      haptics.selection();
                      onChange(iso);
                      sheetRef.current?.dismiss();
                    }}
                    style={{
                      flex: 1,
                      borderRadius: radius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selected ? tokens.colors.secondary : 'transparent',
                      opacity: disabled ? 0.32 : 1,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: font('body', selected ? 700 : 500),
                        fontSize: 14,
                        color: selected ? tokens.colors.onSecondary : tokens.colors.onSurface,
                      }}
                    >
                      {date.getDate()}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      </Sheet>
    );
  },
);
