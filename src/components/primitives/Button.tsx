import React, { memo } from 'react';
import {
  GestureResponderEvent, Pressable, PressableProps, View,
} from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { Spinner } from './Spinner';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'soft' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  children?: React.ReactNode;
  /** Fully-rounded footer CTA — ports `.primaryBtn`/`.secondaryBtn` from
   * ticket.module.css / installation's wizard footer (`--aes-radius-full`,
   * 12px 18px / 12px 16px padding, 14px/13px type at the ≤768px tier),
   * which is a distinct shape from the site-wide `.btn` this component
   * otherwise ports. Only the installation/ticket wizard footers use it. */
  pill?: boolean;
}

const SIZE_SPEC: Record<ButtonSize, { height: number; fontSize: number; paddingH: number; radius: number }> = {
  sm: { height: 36, fontSize: 13, paddingH: space[4], radius: radius.sm },
  md: { height: 48, fontSize: 15, paddingH: space[6], radius: radius.md },
  lg: { height: 52, fontSize: 16, paddingH: space[7], radius: radius.md },
};

// Ports .btn + its 7 variants from globals.css exactly. Press feedback is
// Reanimated scale(0.98)/100ms (the web's `.btn:active`), plus a light
// haptic on primary/secondary — the app's tactile signature. No hover: this
// is a phone.
function ButtonImpl({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  onPress,
  onPressIn,
  onPressOut,
  children,
  pill = false,
  ...rest
}: ButtonProps) {
  const { tokens } = useTheme();
  const scale = useSharedValue(1);
  const isGhost = variant === 'ghost';
  const spec = SIZE_SPEC[size];
  const blocked = disabled || loading;
  const pillFontSize = variant === 'primary' ? 14 : 13;
  const pillPaddingH = variant === 'primary' ? 18 : 16;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const variantStyle = (() => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: tokens.colors.secondary,
          textColor: tokens.colors.onSecondary,
          extra: shadow('sm'),
        };
      case 'secondary':
        return {
          backgroundColor: tokens.colors.primary,
          textColor: tokens.colors.onPrimary,
          extra: {},
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          textColor: tokens.colors.primary,
          extra: { borderWidth: 1.5, borderColor: tokens.colors.secondary },
        };
      case 'soft':
        return {
          backgroundColor: tokens.colors.surfaceContainer,
          textColor: tokens.colors.primary,
          extra: {},
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          textColor: tokens.colors.primary,
          extra: {},
        };
      case 'danger':
        return {
          backgroundColor: tokens.colors.error,
          textColor: tokens.colors.onError,
          extra: {},
        };
      default:
        return { backgroundColor: tokens.colors.secondary, textColor: tokens.colors.onSecondary, extra: {} };
    }
  })();

  // sm (36px) and ghost (no fixed height, ~32-36px) both fall short of the
  // 44x44 (iOS)/48x48 (Android) minimum tap target — hitSlop pads the
  // invisible touch area without changing the visual size the design
  // system specifies.
  const targetHitSlop = isGhost ? 6 : size === 'sm' ? 5 : 0;

  return (
    <AnimatedPressable
      disabled={blocked}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked }}
      hitSlop={targetHitSlop || undefined}
      onPressIn={(e) => {
        if (!blocked) scale.value = withTiming(0.98, { duration: 100 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: 100 });
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (blocked) return;
        if (variant === 'primary' || variant === 'secondary') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress?.(e);
      }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[2],
          height: isGhost || pill ? undefined : spec.height,
          paddingHorizontal: isGhost ? space[3] : pill ? pillPaddingH : spec.paddingH,
          paddingVertical: isGhost ? space[2] : pill ? 12 : undefined,
          borderRadius: isGhost ? radius.sm : pill ? radius.full : spec.radius,
          backgroundColor: variantStyle.backgroundColor,
          opacity: disabled ? 0.4 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          width: fullWidth ? '100%' : undefined,
        },
        variantStyle.extra,
        animatedStyle,
      ]}
      {...rest}
    >
      {/* Content stays mounted (opacity 0) while loading so the button never
          resizes mid-press — a button that shrinks to just a spinner feels
          broken (CLAUDE.md Phase 20, LOADING). */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], opacity: loading ? 0 : 1,
      }}
      >
        {leftIcon}
        {typeof children === 'string' ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: font('body', 600),
              fontSize: pill ? pillFontSize : spec.fontSize,
              letterSpacing: 0.005 * (pill ? pillFontSize : spec.fontSize),
              color: variantStyle.textColor,
            }}
          >
            {children}
          </Text>
        ) : (
          children
        )}
        {rightIcon}
      </View>
      {loading && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center',
        }}
        >
          <Spinner size="sm" />
        </View>
      )}
    </AnimatedPressable>
  );
}

export const Button = memo(ButtonImpl);
