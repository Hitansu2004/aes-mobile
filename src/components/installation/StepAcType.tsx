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
import { AcTypeIcon } from '@/components/ui/AcTypeIcon';
import { AC_TYPES } from '@/lib/constants';
import { AC_TYPE_IMAGES } from '@/lib/aesCatalog';
import { WizardHeading, CheckBadge } from './shared';

// Step 2 — AC type. Ported from installation/page.js's `Step1` (yes, the web
// numbers this Step1 too — it's the second step in the wizard) +
// .acTypeGrid/.acTypeCard/.acTypePhoto classes.
export interface StepAcTypeProps {
  value: string;
  buildingType: string;
  onChange: (value: string) => void;
}

export function StepAcType({ value, buildingType, onChange }: StepAcTypeProps) {
  const styles = useThemedStyles(makeStyles);
  const { tokens } = useTheme();
  const { isPhone, isLarge } = useBreakpoint();
  const haptics = useHaptics();
  const columns = isPhone ? 1 : isLarge ? 3 : 2;

  const sub = buildingType
    ? 'Tap a system to pick the unit type. Photos are reference shots from arialengineering.com.'
    : 'Choose based on your space requirements.';

  return (
    <View>
      <WizardHeading title="What type of AC do you need?" sub={sub} />
      <View style={styles.grid}>
        {AC_TYPES.map((t, i) => {
          const selected = value === t.value;
          const photo = AC_TYPE_IMAGES[t.value];
          return (
            <MotiView
              key={t.value}
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 260, delay: i * 40 }}
              style={{ width: `${100 / columns}%`, padding: space[2] / 2 }}
            >
              <PressableScale
                scaleTo={0.98}
                onPress={() => { haptics.selection(); onChange(t.value); }}
                style={[
                  styles.card,
                  { borderColor: selected ? tokens.colors.secondary : tokens.colors.borderLight },
                  selected && { backgroundColor: tokens.colors.secondarySoft, ...shadow('card') },
                ]}
              >
                {selected && <CheckBadge />}
                <View style={[styles.photo, { backgroundColor: selected ? 'rgba(255,255,255,0.7)' : tokens.colors.surfaceContainer }]}>
                  {photo ? (
                    <Image
                      source={{ uri: photo }}
                      style={styles.photoImg}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                      transition={200}
                      accessibilityLabel={t.label}
                    />
                  ) : (
                    <AcTypeIcon type={t.value} size={28} color={tokens.colors.primaryDark} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} color="onSurface">{t.label}</Text>
                  <Text style={styles.desc} color="onSurfaceVariant">{t.desc}</Text>
                  <View style={[styles.range, { backgroundColor: selected ? 'rgba(255,255,255,0.65)' : tokens.colors.surfaceContainer }]}>
                    <Text style={styles.rangeLabel} color="primaryDark">{t.range}</Text>
                  </View>
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
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[4],
    padding: space[4],
    borderWidth: 1.5,
    borderRadius: radius.lg - 2,
    backgroundColor: tokens.colors.surfaceContainerLowest,
  },
  photo: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  photoImg: {
    width: '100%' as const,
    height: '100%' as const,
  },
  name: {
    fontFamily: font('body', 700),
    fontSize: 16,
  },
  desc: {
    fontFamily: font('body', 400),
    fontSize: 13,
    marginTop: 2,
  },
  range: {
    alignSelf: 'flex-start' as const,
    marginTop: space[2],
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
  },
  rangeLabel: {
    fontFamily: font('body', 600),
    fontSize: 11,
  },
});
