import React, { memo } from 'react';
import { View, ViewStyle } from 'react-native';
import { Check } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives/Text';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';

// Shared bits used by every step of the installation wizard
// (../../aes-frontend/src/app/services/installation/page.js's `Heading` /
// `SectionLabel` + the `.checkBadge` class repeated on every selectable
// card). Kept in one file so the six step components stay focused on their
// own layout.

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
  const { tokens } = useTheme();
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
