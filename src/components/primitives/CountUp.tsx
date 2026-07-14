import React, { memo, useEffect } from 'react';
import { StyleProp, TextStyle } from 'react-native';
import Animated, {
  useAnimatedProps, useSharedValue, withTiming, Easing,
} from 'react-native-reanimated';
import { TextInput } from 'react-native';

import { useReduceMotion } from '@/hooks/useReduceMotion';

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export interface CountUpProps {
  value: number;
  /** e.g. (n) => `₹${n.toLocaleString('en-IN')}` */
  format?: (n: number) => string;
  duration?: number;
  style?: StyleProp<TextStyle>;
}

// Numbers that matter (price totals, revenue, counts) count up rather than
// snapping — CLAUDE.md Phase 20, "FEEDBACK". Renders via a disabled,
// non-editable TextInput so the animated text prop runs on the UI thread
// (a plain <Text> can't take an animatedProps text value).
function CountUpImpl({
  value, format = (n) => String(Math.round(n)), duration = 600, style,
}: CountUpProps) {
  const reduceMotion = useReduceMotion();
  const animated = useSharedValue(reduceMotion ? value : 0);

  useEffect(() => {
    animated.value = reduceMotion
      ? value
      : withTiming(value, { duration, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({
    text: format(animated.value),
    defaultValue: format(animated.value),
  }));

  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      animatedProps={animatedProps}
      // Unlike <Text>, a TextInput doesn't shrink-wrap to its content by
      // default — inside a flex row it stretches to fill the available
      // space (only visible at wider layouts / narrower siblings, which is
      // why this went unnoticed until the phone-width dashboard count
      // badge rendered as a full-width pill instead of a small circle).
      // flexGrow/flexShrink: 0 + alignSelf: 'flex-start' pin it to its
      // intrinsic text width like a normal <Text>, matching every call
      // site's expectation (dashboard/admin count badges, revenue KPIs,
      // ticket price totals). Still overridable via the style prop.
      style={[{ padding: 0, flexGrow: 0, flexShrink: 0, alignSelf: 'flex-start' }, style]}
    />
  );
}

export const CountUp = memo(CountUpImpl);
