import React, { memo, useEffect } from 'react';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useAnimatedProps, useSharedValue, withDelay, withTiming, Easing,
} from 'react-native-reanimated';

import { useReduceMotion } from '@/hooks/useReduceMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_PATH = 'M4 12.5L9.5 18L20 6';
const PATH_LENGTH = 24;

export interface AnimatedCheckmarkProps {
  size?: number;
  color: string;
  strokeWidth?: number;
  delay?: number;
}

// A self-drawing checkmark (stroke-dashoffset sweep) — CLAUDE.md Phase 20,
// "Success → the check draws itself". Reduce-motion renders the completed
// check immediately instead of animating the stroke.
function AnimatedCheckmarkImpl({
  size = 40, color, strokeWidth = 3, delay = 150,
}: AnimatedCheckmarkProps) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(reduceMotion ? 0 : PATH_LENGTH);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 0;
      return;
    }
    progress.value = withDelay(delay, withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }));
  }, [reduceMotion, delay, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: progress.value,
  }));

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <AnimatedPath
        d={CHECK_PATH}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={PATH_LENGTH}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

export const AnimatedCheckmark = memo(AnimatedCheckmarkImpl);
