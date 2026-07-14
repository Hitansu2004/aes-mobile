import React, { memo } from 'react';
import {
  StyleProp, View, ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { PressableScale } from './PressableScale';

export type CardVariant = 'default' | 'flat' | 'outlined';

export interface CardProps {
  variant?: CardVariant;
  interactive?: boolean;
  padded?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

// Ports .card / .card-interactive: bg surfaceContainerLowest, radius md(12),
// padding space5(20), shadow('card'). Interactive cards add press scale 0.98
// via PressableScale — every tappable card in the app should look like this.
function CardImpl({
  variant = 'default', interactive = false, padded = true, onPress, style, children,
}: CardProps) {
  const { tokens } = useTheme();

  const variantStyle: ViewStyle = (() => {
    switch (variant) {
      case 'flat':
        return {};
      case 'outlined':
        return { borderWidth: 1, borderColor: tokens.colors.outlineVariant };
      case 'default':
      default:
        return shadow('card');
    }
  })();

  const content: ViewStyle = {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: radius.md,
    padding: padded ? space[5] : 0,
    ...variantStyle,
  };

  if (interactive) {
    return (
      <PressableScale scaleTo={0.98} onPress={onPress} style={[content, style]}>
        {children}
      </PressableScale>
    );
  }

  return <View style={[content, style]}>{children}</View>;
}

export const Card = memo(CardImpl);
