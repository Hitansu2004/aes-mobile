import React from 'react';
import {
  Snowflake, LayoutGrid, Wind, Building2, Square, Fan, LucideIcon,
} from 'lucide-react-native';

// Ported from ../../aes-frontend/src/components/ui/AcTypeIcon.js
const MAP: Record<string, LucideIcon> = {
  SPLIT: Snowflake,
  CASSETTE: LayoutGrid,
  CENTRAL: Wind,
  VRF_VRV: Building2,
  WINDOW: Square,
  PORTABLE: Fan,
};

export interface AcTypeIconProps {
  type?: string;
  size?: number;
  color?: string;
}

export function AcTypeIcon({ type, size = 22, color }: AcTypeIconProps) {
  const Icon = (type && MAP[type]) || Snowflake;
  return <Icon size={size} color={color} strokeWidth={1.8} />;
}
