import React, { memo } from 'react';
import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { ColorToken } from '@/theme/tokens';
import { headlineLgTablet, headlineXlTablet, typography } from '@/theme/typography';
import { useBreakpoint } from '@/hooks/useBreakpoint';

export type TextVariant = keyof typeof typography;

export interface TextProps extends Omit<RNTextProps, 'style'> {
  variant?: TextVariant;
  color?: ColorToken;
  align?: TextStyle['textAlign'];
  numberOfLines?: number;
  style?: RNTextProps['style'];
  children?: React.ReactNode;
}

// The one and only text renderer in the app — nothing else should import RN's
// <Text> directly (see CLAUDE.md Phase 2 rule). Auto-upsizes headlineXl/Lg on
// tablet+ to match globals.css `@media (min-width: 768px) { .headline-xl, .headline-lg }`.
function TextImpl({
  variant = 'bodyMd', color = 'onSurface', align, numberOfLines, style, children, ...rest
}: TextProps) {
  const { tokens } = useTheme();
  const { isPhone } = useBreakpoint();

  let typeStyle = typography[variant];
  if (!isPhone) {
    if (variant === 'headlineXl') typeStyle = headlineXlTablet;
    else if (variant === 'headlineLg') typeStyle = headlineLgTablet;
  }

  return (
    <RNText
      numberOfLines={numberOfLines}
      style={[typeStyle, { color: tokens.colors[color], textAlign: align }, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

export const Text = memo(TextImpl);
