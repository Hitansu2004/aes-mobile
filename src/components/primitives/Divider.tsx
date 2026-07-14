import React, { memo } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/spacing';

export interface DividerProps {
  spacing?: number;
}

function DividerImpl({ spacing = space[4] }: DividerProps) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        height: 1,
        width: '100%',
        backgroundColor: tokens.colors.borderLight,
        marginVertical: spacing,
      }}
    />
  );
}

export const Divider = memo(DividerImpl);
