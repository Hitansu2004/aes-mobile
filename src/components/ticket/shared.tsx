import React, { memo } from 'react';
import { View, ViewStyle } from 'react-native';
import { Check } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives/Text';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';

// Shared bits used by every step of the service-ticket wizard — same
// anatomy as ../installation/shared.tsx (kept as its own copy per
// per-wizard-folder convention rather than a cross-import).

export interface WizardHeadingProps {
  title: string;
  sub: string;
}

function WizardHeadingImpl({ title, sub }: WizardHeadingProps) {
  return (
    <View style={{ gap: space[2] - 2, marginBottom: space[1] }}>
      <Text variant="headlineMd" color="onSurfaceStrong">{title}</Text>
      <Text variant="bodyMd" color="onSurfaceVariant">{sub}</Text>
    </View>
  );
}

export const WizardHeading = memo(WizardHeadingImpl);

export interface SectionLabelProps {
  children: React.ReactNode;
  right?: React.ReactNode;
}

function SectionLabelImpl({ children, right }: SectionLabelProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginTop: space[3],
      }}
    >
      <Text
        style={{
          fontFamily: font('body', 700),
          fontSize: 12,
          letterSpacing: 0.10 * 12,
          textTransform: 'uppercase',
        }}
        color="secondaryInk"
      >
        {children}
      </Text>
      {right}
    </View>
  );
}

export const SectionLabel = memo(SectionLabelImpl);

export interface CheckBadgeProps {
  size?: number;
  style?: ViewStyle;
}

function CheckBadgeImpl({ size = 22, style }: CheckBadgeProps) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        {
          position: 'absolute',
          top: 10,
          right: 10,
          width: size,
          height: size,
          borderRadius: radius.full,
          backgroundColor: tokens.colors.secondary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Check size={Math.round(size * 0.62)} strokeWidth={3} color={tokens.colors.onSecondary} />
    </View>
  );
}

export const CheckBadge = memo(CheckBadgeImpl);

export const inrFmt = (n: number): string => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** AC unit / priority service-status → badge tone. Same hex pairs as
 * PriorityBadge's toneMeta so the two badges read as one visual language. */
export function acStatusTone(status?: string | null): { label: string; bg: string; fg: string } {
  switch (status) {
    case 'P1_AMC': return { label: 'AMC Covered', bg: '#E6EAF0', fg: '#0B1A2C' };
    case 'P2_WARRANTY': return { label: 'In Warranty', bg: '#F2E7C4', fg: '#8F701E' };
    case 'P3_PAID': return { label: 'Out of Warranty', bg: '#ECEDF0', fg: '#4E5663' };
    default: return { label: 'Unknown', bg: '#ECEDF0', fg: '#4E5663' };
  }
}
