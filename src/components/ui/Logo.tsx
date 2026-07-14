import React from 'react';
import { View } from 'react-native';
import { Snowflake } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives';

// Ported from ../../aes-frontend/src/components/ui/Logo.js
export type LogoSize = 'sm' | 'md' | 'lg';
export type LogoColor = 'rose' | 'white';

export interface LogoProps {
  size?: LogoSize;
  showWordmark?: boolean;
  color?: LogoColor;
}

const DIM: Record<LogoSize, number> = { sm: 24, md: 32, lg: 48 };

export function Logo({ size = 'md', showWordmark = true, color = 'rose' }: LogoProps) {
  const { tokens } = useTheme();
  const dim = DIM[size] ?? DIM.md;
  const chip = dim + 12;
  const palette = color === 'white'
    ? { bg: 'rgba(255,255,255,0.15)', fg: '#ffffff', text: '#ffffff' }
    : { bg: tokens.colors.primary, fg: '#ffffff', text: tokens.colors.primary };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View
        style={{
          width: chip,
          height: chip,
          borderRadius: 12,
          backgroundColor: palette.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Snowflake size={dim - 6} color={palette.fg} strokeWidth={2.2} />
      </View>
      {showWordmark && (
        <View style={{ flexDirection: 'column' }}>
          <Text
            style={{ fontSize: 16, fontWeight: '700', color: palette.text, letterSpacing: -0.16, lineHeight: 18 }}
          >
            Arial Engineering
          </Text>
          <Text
            color="onSurfaceVariant"
            style={{ fontSize: 11, fontWeight: '500', letterSpacing: 0.55, textTransform: 'uppercase', lineHeight: 14 }}
          >
            HVAC Services
          </Text>
        </View>
      )}
    </View>
  );
}
