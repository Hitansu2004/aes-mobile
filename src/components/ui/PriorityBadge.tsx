import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives';
import { radius } from '@/theme/spacing';

// Ported from ../../aes-frontend/src/components/ui/PriorityBadge.js +
// PriorityBadge.module.css. Priority → tone/label mapping and the
// tone hex pairs are copied verbatim from the CSS (not the token table —
// these exact hexes have no matching semantic token, same treatment as
// other one-off literals per CLAUDE.md's ground-truth-over-prose rule).
export type Priority = 'P1' | 'P2' | 'P3' | string;

interface ToneMeta {
  label: string;
  bg: string;
  fg: string;
  dotBg: string;
}

const META: Record<string, { label: string; tone: string }> = {
  P1: { label: 'P1 AMC', tone: 'amc' },
  P2: { label: 'P2 Warranty', tone: 'warranty' },
  P3: { label: 'P3 Paid', tone: 'paid' },
};

function toneMeta(tokens: ReturnType<typeof useTheme>['tokens'], tone: string): ToneMeta {
  switch (tone) {
    case 'amc':
      return {
        label: '', bg: '#E6EAF0', fg: '#0B1A2C', dotBg: '#0B1A2C',
      };
    case 'warranty':
      return {
        label: '', bg: '#F2E7C4', fg: '#8F701E', dotBg: '#C9A84C',
      };
    case 'paid':
      return {
        label: '', bg: '#ECEDF0', fg: '#4E5663', dotBg: '#4E5663',
      };
    default:
      return {
        label: '', bg: tokens.colors.surfaceContainerHigh, fg: tokens.colors.onSurfaceVariant, dotBg: tokens.colors.outlineVariant,
      };
  }
}

export interface PriorityBadgeProps {
  priority: Priority;
  dense?: boolean;
  label?: string;
}

export function PriorityBadge({ priority, dense = false, label }: PriorityBadgeProps) {
  const { tokens } = useTheme();
  const meta = META[priority] ?? { label: priority || '—', tone: 'neutral' };
  const tone = toneMeta(tokens, meta.tone);

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: dense ? 3 : 4,
        paddingHorizontal: dense ? 8 : 10,
        borderRadius: radius.sm,
        backgroundColor: tone.bg,
      }}
    >
      <Text
        style={{
          fontSize: dense ? 10 : 11,
          fontWeight: '700',
          letterSpacing: 0.66,
          textTransform: 'uppercase',
          color: tone.fg,
        }}
      >
        {label || meta.label}
      </Text>
    </View>
  );
}

export interface PriorityDotProps {
  priority: Priority;
}

export function PriorityDot({ priority }: PriorityDotProps) {
  const { tokens } = useTheme();
  const meta = META[priority] ?? { label: '', tone: 'neutral' };
  const tone = toneMeta(tokens, meta.tone);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 8, height: 8, borderRadius: 4, backgroundColor: tone.dotBg,
      }}
    />
  );
}
