import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives';
import { radius, space } from '@/theme/spacing';
import { useBreakpoint } from '@/hooks/useBreakpoint';

// Ported from ../../aes-frontend/src/components/ui/AppTopBar.js +
// AppTopBar.module.css. The minimal back-header used by focused/wizard
// screens. `width` only affected max-width on the web's centred desktop
// layout — on mobile every screen is full-bleed, so it's accepted for API
// parity but has no visual effect below tablet.
export type AppTopBarVariant = 'light' | 'transparent';
export type AppTopBarWidth = 'narrow' | 'content' | 'detail';

export interface AppTopBarProps {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  showBack?: boolean;
  variant?: AppTopBarVariant;
  width?: AppTopBarWidth;
}

const MAX_WIDTH: Record<AppTopBarWidth, number> = {
  narrow: 480,
  content: 760,
  detail: 980,
};

export function AppTopBar({
  title, onBack, right, showBack = true, variant = 'light', width = 'narrow',
}: AppTopBarProps) {
  const { tokens } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPhone } = useBreakpoint();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <View
      style={{
        backgroundColor: variant === 'transparent' ? 'transparent' : tokens.colors.surface,
        borderBottomWidth: variant === 'transparent' ? 0 : 1,
        borderBottomColor: tokens.colors.borderLight,
        paddingTop: insets.top,
      }}
    >
      <View
        style={{
          height: 56,
          width: '100%',
          maxWidth: isPhone ? undefined : MAX_WIDTH[width],
          alignSelf: 'center',
          paddingHorizontal: space[3],
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
        }}
      >
        <View style={{ width: 40, alignItems: 'flex-start', justifyContent: 'center' }}>
          {showBack ? (
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
              style={{
                width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ArrowLeft size={22} color={tokens.colors.onSurface} />
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <Text
          variant="headlineSm"
          numberOfLines={1}
          style={{ flex: 1, textAlign: 'center', letterSpacing: -0.16 }}
        >
          {title}
        </Text>

        <View style={{
          width: 40, minWidth: 40, alignItems: 'flex-end', justifyContent: 'center',
        }}
        >
          {right || <View style={{ width: 40 }} />}
        </View>
      </View>
    </View>
  );
}
