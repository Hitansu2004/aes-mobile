import React, { memo } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius } from '@/theme/spacing';
import { Text } from './Text';

export type BadgeTone = 'amc' | 'warranty' | 'paid' | 'escalated' | 'resolved' | 'open' | 'neutral';

export interface BadgeProps {
  tone: BadgeTone;
  children: React.ReactNode;
}

// Ports .badge*: padding 4/10, radius sm(4), 11px/700/uppercase/ls 0.06em.
// Colours always come from tokens.badges — 'neutral' isn't a web badge tone,
// so it falls back to the generic surface/on-surface-variant pair instead of
// a hand-picked hex.
function BadgeImpl({ tone, children }: BadgeProps) {
  const { tokens } = useTheme();

  const { fg, bg } = tone === 'neutral'
    ? { fg: tokens.colors.onSurfaceVariant, bg: tokens.colors.surfaceContainerHigh }
    : tokens.badges[tone];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: radius.xs,
        backgroundColor: bg,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontFamily: font('body', 700),
          fontSize: 11,
          letterSpacing: 0.06 * 11,
          textTransform: 'uppercase',
          lineHeight: 14,
          color: fg,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export const Badge = memo(BadgeImpl);
