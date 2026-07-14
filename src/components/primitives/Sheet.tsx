import React, {
  forwardRef, memo, useCallback, useImperativeHandle, useMemo, useRef,
} from 'react';
import { Pressable, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { Check } from 'lucide-react-native';
import { WithSpringConfig } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { space, radius } from '@/theme/spacing';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Text } from './Text';

// A sheet stretched edge-to-edge on a 1024px-wide tablet reads as a bug, not
// a bottom sheet — cap it to a phone-shaped column and centre it so it looks
// like a floating panel instead of full-bleed chrome.
const TABLET_SHEET_MAX_WIDTH = 480;

export interface SheetRef {
  present: () => void;
  dismiss: () => void;
}

// Every sheet springs up with this exact feel (CLAUDE.md Phase 20, TRANSITIONS)
// instead of @gorhom/bottom-sheet's default spring.
const SHEET_SPRING: WithSpringConfig = { damping: 20, stiffness: 180 };

export interface SheetProps {
  snapPoints?: (string | number)[];
  title?: string;
  onDismiss?: () => void;
  children?: React.ReactNode;
}

// Wraps @gorhom/bottom-sheet's BottomSheetModal — this replaces every
// `.sheetBackdrop`/`.sheet` on the web (property picker, add-AC, PaymentModal,
// the CRM/Ops/Engineer/Admin modals) and every `<select>` dropdown (RN has no
// native <select>). Grab handle, tap-to-dismiss backdrop, swipe-to-dismiss,
// safe-area-aware bottom padding and keyboard avoidance all come from the
// underlying library; we only theme it.
export const Sheet = memo(forwardRef<SheetRef, SheetProps>(function Sheet(
  { snapPoints, title, onDismiss, children },
  ref,
) {
  const { tokens } = useTheme();
  const { isPhone, width } = useBreakpoint();
  const modalRef = useRef<BottomSheetModal>(null);
  const points = useMemo(() => snapPoints ?? ['50%'], [snapPoints]);

  const sheetMargin = isPhone ? 0 : Math.max(0, (width - TABLET_SHEET_MAX_WIDTH) / 2);

  useImperativeHandle(ref, () => ({
    present: () => modalRef.current?.present(),
    dismiss: () => modalRef.current?.dismiss(),
  }), []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.5}
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={points}
      enablePanDownToClose
      animationConfigs={SHEET_SPRING}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onDismiss={onDismiss}
      backdropComponent={renderBackdrop}
      style={isPhone ? undefined : { marginHorizontal: sheetMargin, maxWidth: TABLET_SHEET_MAX_WIDTH, alignSelf: 'center' }}
      backgroundStyle={{
        backgroundColor: tokens.colors.surfaceContainerLowest,
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
        borderBottomLeftRadius: isPhone ? 0 : radius.xl,
        borderBottomRightRadius: isPhone ? 0 : radius.xl,
      }}
      handleIndicatorStyle={{ backgroundColor: tokens.colors.outline }}
    >
      {title ? (
        <View style={{ paddingHorizontal: space[5], paddingBottom: space[3] }}>
          <Text variant="headlineSm">{title}</Text>
        </View>
      ) : null}
      {children}
    </BottomSheetModal>
  );
}));

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectSheetProps {
  options: SelectOption[];
  label?: string;
  value?: string;
  onChange: (value: string) => void;
}

// The standard `<select>` replacement — `<SelectSheet options label value
// onChange />` opens a bottom sheet list, checkmarking the active option.
export const SelectSheet = memo(forwardRef<SheetRef, SelectSheetProps>(function SelectSheet(
  {
    options, label, value, onChange,
  },
  ref,
) {
  const { tokens } = useTheme();
  const sheetRef = useRef<SheetRef>(null);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }), []);

  return (
    <Sheet ref={sheetRef} title={label}>
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: space[8] }}>
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                onChange(option.value);
                sheetRef.current?.dismiss();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: space[5],
                paddingVertical: space[4],
              }}
            >
              <Text
                style={{
                  fontFamily: font('body', isSelected ? 600 : 400),
                  color: isSelected ? tokens.colors.onSurfaceStrong : tokens.colors.onSurface,
                }}
              >
                {option.label}
              </Text>
              {isSelected ? <Check size={18} color={tokens.colors.secondaryInk} /> : null}
            </Pressable>
          );
        })}
      </BottomSheetScrollView>
    </Sheet>
  );
}));
