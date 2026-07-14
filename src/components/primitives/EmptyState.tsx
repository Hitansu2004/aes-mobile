import React, { memo } from 'react';
import { View } from 'react-native';
import { MotiView } from 'moti';

import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/spacing';
import { Text } from './Text';
import { Button, ButtonProps } from './Button';

export interface EmptyStateProps {
  icon: React.ReactNode;
  headline: string;
  body: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  ctaVariant?: ButtonProps['variant'];
}

// The shared empty-state shape from /tickets, /installations, /notifications,
// /account, /admin/coupons: icon in a circle, headline, body, optional CTA.
// Fade + rise in on mount.
function EmptyStateImpl({
  icon, headline, body, ctaLabel, onCtaPress, ctaVariant = 'primary',
}: EmptyStateProps) {
  const { tokens } = useTheme();

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300 }}
      style={{ alignItems: 'center', paddingVertical: space[10], paddingHorizontal: space[6] }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.colors.surfaceContainer,
          marginBottom: space[5],
        }}
      >
        {icon}
      </View>
      <Text variant="headlineSm" align="center">{headline}</Text>
      <View style={{ height: space[2] }} />
      <Text variant="bodyMd" color="onSurfaceVariant" align="center">{body}</Text>
      {ctaLabel && onCtaPress ? (
        <View style={{ marginTop: space[6] }}>
          <Button variant={ctaVariant} onPress={onCtaPress}>{ctaLabel}</Button>
        </View>
      ) : null}
    </MotiView>
  );
}

export const EmptyState = memo(EmptyStateImpl);
