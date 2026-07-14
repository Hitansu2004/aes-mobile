import React, { memo } from 'react';
import { ScrollView, StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

// The filter pill used on /tickets, /installations, /crm, /error-codes and
// the tonnage/duration selectors in both wizards. Selected = gold fill,
// navy text; unselected = soft surface fill.
function ChipImpl({
  label, selected = false, onPress, style,
}: ChipProps) {
  const { tokens } = useTheme();

  return (
    <PressableScale
      scaleTo={0.96}
      onPress={onPress}
      style={[
        {
          paddingVertical: space[2],
          paddingHorizontal: 14,
          borderRadius: radius.full,
          backgroundColor: selected ? tokens.colors.secondary : tokens.colors.surfaceContainer,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={{
          fontFamily: font('body', 600),
          fontSize: 13,
          letterSpacing: 0.02 * 13,
          color: selected ? tokens.colors.onSecondary : tokens.colors.onSurfaceVariant,
        }}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

export const Chip = memo(ChipImpl);

export interface ChipRowProps {
  children: React.ReactNode;
}

function ChipRowImpl({ children }: ChipRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: 'row', gap: space[2] }}
    >
      {children}
    </ScrollView>
  );
}

export const ChipRow = memo(ChipRowImpl);
