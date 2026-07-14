import React, { memo } from 'react';
import {
  Pressable, PressableProps, StyleProp, ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  scaleTo?: number;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

// Uniform press feedback for every tappable card in the app — this is the
// web's `:active { transform: scale(0.98) }` made tactile. If a card is
// tappable and doesn't route through this, that's a bug (see CLAUDE.md Phase 2).
function PressableScaleImpl({
  scaleTo = 0.97, haptic = false, style, onPressIn, onPressOut, children, ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, { damping: 18, stiffness: 300 });
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 18, stiffness: 300 });
        onPressOut?.(e);
      }}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

export const PressableScale = memo(PressableScaleImpl);
