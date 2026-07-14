import React, { memo, useRef, useState } from 'react';
import {
  TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { Text } from './Text';
import { SelectSheet, SelectOption, SheetRef } from './Sheet';

// ─── shared label/helper/error/char-count chrome ──────────────────────────

interface FieldChromeProps {
  label?: string;
  error?: string;
  helperText?: string;
  charCount?: { current: number; max: number };
  children: React.ReactNode;
}

function FieldChrome({
  label, error, helperText, charCount, children,
}: FieldChromeProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: space[2] }}>
      {label ? (
        <Text
          style={{
            fontFamily: font('body', 600),
            fontSize: 12,
            letterSpacing: 0.06 * 12,
            textTransform: 'uppercase',
            color: tokens.colors.onSurfaceVariant,
          }}
        >
          {label}
        </Text>
      ) : null}
      {children}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {error ? (
          <Text variant="bodySm" color="error">{error}</Text>
        ) : helperText ? (
          <Text variant="bodySm" color="onSurfaceVariant">{helperText}</Text>
        ) : <View />}
        {charCount ? (
          <Text variant="bodySm" color="onSurfaceVariant">
            {charCount.current}/{charCount.max}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Input ─────────────────────────────────────────────────────────────

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
  charCount?: number;
  maxLength?: number;
  style?: ViewStyle;
}

// Ports .input / .input-group / .input:focus. RN has no box-shadow ring, so
// the focus ring (4px, rgba(201,168,76,0.18)) is emulated with an outer
// padded View that only gains padding+tint while focused.
function InputImpl({
  label, error, helperText, charCount, maxLength, style, onFocus, onBlur, value, ...rest
}: InputProps) {
  const { tokens } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <FieldChrome
      label={label}
      error={error}
      helperText={helperText}
      charCount={maxLength ? { current: (value?.length ?? charCount ?? 0), max: maxLength } : undefined}
    >
      <View
        style={{
          borderRadius: radius.sm + 4,
          padding: focused && !error ? 4 : 0,
          backgroundColor: focused && !error ? 'rgba(201, 168, 76, 0.18)' : 'transparent',
        }}
      >
        <TextInput
          value={value}
          maxLength={maxLength}
          placeholderTextColor={tokens.colors.outline}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          style={[
            {
              height: 52,
              paddingHorizontal: space[4],
              backgroundColor: tokens.colors.surfaceContainerLow,
              borderWidth: 1.5,
              borderColor: error
                ? tokens.colors.error
                : focused ? tokens.colors.secondary : 'transparent',
              borderRadius: radius.sm,
              fontFamily: font('body', 400),
              fontSize: 15,
              color: tokens.colors.onSurface,
            },
            style,
          ]}
          {...rest}
        />
      </View>
    </FieldChrome>
  );
}

export const Input = memo(InputImpl);

// ─── TextArea ──────────────────────────────────────────────────────────

export interface TextAreaProps extends InputProps {
  minHeight?: number;
}

function TextAreaImpl({
  label, error, helperText, charCount, maxLength, style, minHeight = 100, onFocus, onBlur, value, ...rest
}: TextAreaProps) {
  const { tokens } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <FieldChrome
      label={label}
      error={error}
      helperText={helperText}
      charCount={maxLength ? { current: (value?.length ?? charCount ?? 0), max: maxLength } : undefined}
    >
      <View
        style={{
          borderRadius: radius.sm + 4,
          padding: focused && !error ? 4 : 0,
          backgroundColor: focused && !error ? 'rgba(201, 168, 76, 0.18)' : 'transparent',
        }}
      >
        <TextInput
          multiline
          textAlignVertical="top"
          value={value}
          maxLength={maxLength}
          placeholderTextColor={tokens.colors.outline}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          style={[
            {
              minHeight,
              paddingVertical: space[3],
              paddingHorizontal: space[4],
              backgroundColor: tokens.colors.surfaceContainerLow,
              borderWidth: 1.5,
              borderColor: error
                ? tokens.colors.error
                : focused ? tokens.colors.secondary : 'transparent',
              borderRadius: radius.sm,
              fontFamily: font('body', 400),
              fontSize: 15,
              lineHeight: 22.5,
              color: tokens.colors.onSurface,
            },
            style,
          ]}
          {...rest}
        />
      </View>
    </FieldChrome>
  );
}

export const TextArea = memo(TextAreaImpl);

// ─── NumberInput ───────────────────────────────────────────────────────

export interface NumberInputProps extends Omit<InputProps, 'onChangeText' | 'keyboardType' | 'value'> {
  value?: string;
  onChangeText?: (digitsOnly: string) => void;
}

function NumberInputImpl({ onChangeText, ...rest }: NumberInputProps) {
  return (
    <Input
      {...rest}
      keyboardType="numeric"
      onChangeText={(text) => onChangeText?.(text.replace(/[^0-9]/g, ''))}
    />
  );
}

export const NumberInput = memo(NumberInputImpl);

// ─── Select (opens a SelectSheet — RN has no native <select>) ────────────

export interface SelectProps {
  label?: string;
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
}

function SelectImpl({
  label, options, value, onChange, placeholder = 'Select…', error, helperText,
}: SelectProps) {
  const { tokens } = useTheme();
  const sheetRef = useRef<SheetRef>(null);
  const selected = options.find((o) => o.value === value);

  return (
    <FieldChrome label={label} error={error} helperText={helperText}>
      <View
        onTouchEnd={() => sheetRef.current?.present()}
        style={{
          height: 52,
          paddingHorizontal: space[4],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: tokens.colors.surfaceContainerLow,
          borderWidth: 1.5,
          borderColor: error ? tokens.colors.error : 'transparent',
          borderRadius: radius.sm,
        }}
      >
        <Text
          variant="bodyLg"
          color={selected ? 'onSurface' : 'onSurfaceVariant'}
          style={{ fontSize: 15 }}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown size={18} color={tokens.colors.onSurfaceVariant} />
      </View>
      <SelectSheet ref={sheetRef} options={options} label={label} value={value} onChange={onChange} />
    </FieldChrome>
  );
}

export const Select = memo(SelectImpl);
