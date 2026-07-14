import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { MotiView } from 'moti';

import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives/Text';
import { PressableScale } from '@/components/primitives/PressableScale';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useHaptics } from '@/hooks/useHaptics';
import { BUILDING_TYPES } from '@/lib/aesCatalog';
import { WizardHeading, CheckBadge } from './shared';

// Step 1 — Space. Ported from installation/page.js's `Step1Space` +
// .spaceGrid/.spaceCard/.spaceMedia/.spaceText classes.
export interface StepSpaceProps {
  value: string;
  onChange: (value: string) => void;
}

export function StepSpace({ value, onChange }: StepSpaceProps) {
  const styles = useThemedStyles(makeStyles);
  const { tokens } = useTheme();
  const { isPhone } = useBreakpoint();
  const haptics = useHaptics();
  const columns = isPhone ? 2 : 3;

  return (
    <View>
      <WizardHeading
        title="What kind of space is this for?"
        sub="So we can match the right team and equipment for your project."
      />
      <View style={styles.grid}>
        {BUILDING_TYPES.map((b, i) => {
          const selected = value === b.value;
          return (
            <MotiView
              key={b.value}
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 260, delay: i * 40 }}
              style={{ width: `${100 / columns}%`, padding: space[2] / 2 }}
            >
              <PressableScale
                scaleTo={0.97}
                onPress={() => { haptics.selection(); onChange(b.value); }}
                style={[
                  styles.card,
                  { borderColor: selected ? tokens.colors.secondary : tokens.colors.borderLight },
                  selected && { backgroundColor: tokens.colors.secondarySoft, ...shadow('card') },
                ]}
              >
                {selected && <CheckBadge />}
                <View style={[styles.media, { backgroundColor: tokens.colors.surfaceContainer }]}>
                  <Image
                    source={{ uri: b.image }}
                    style={styles.mediaImg}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={200}
                    accessibilityLabel={b.label}
                  />
                </View>
                <View style={styles.text}>
                  <Text style={styles.name} color="onSurface">{b.label}</Text>
                  <Text style={styles.desc} color="onSurfaceVariant">{b.description}</Text>
                </View>
              </PressableScale>
            </MotiView>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  grid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    marginHorizontal: -(space[2] / 2),
  },
  card: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    overflow: 'hidden' as const,
  },
  media: {
    width: '100%' as const,
    aspectRatio: 4 / 3,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  mediaImg: {
    width: '60%' as const,
    height: '60%' as const,
  },
  text: {
    padding: space[3] + 2,
    gap: 4,
  },
  name: {
    fontFamily: font('body', 700),
    fontSize: 15,
  },
  desc: {
    fontFamily: font('body', 400),
    fontSize: 12.5,
    lineHeight: 17,
  },
});
