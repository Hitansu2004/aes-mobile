import React, { memo } from 'react';
import { View } from 'react-native';

import { space } from '@/theme/spacing';

export interface SpacerProps {
  size?: keyof typeof space;
  horizontal?: boolean;
}

function SpacerImpl({ size = 4, horizontal = false }: SpacerProps) {
  const px = space[size];
  return <View style={horizontal ? { width: px } : { height: px }} />;
}

export const Spacer = memo(SpacerImpl);
