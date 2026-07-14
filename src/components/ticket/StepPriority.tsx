import React from 'react';
import { View } from 'react-native';
import { MotiView } from 'moti';
import {
  Award, Check, ShieldCheck, Wrench, LucideIcon,
} from 'lucide-react-native';

import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives/Text';
import { PressableScale } from '@/components/primitives/PressableScale';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useHaptics } from '@/hooks/useHaptics';
import { PRIORITY_INFO } from '@/store/serviceStore';
import { WizardHeading } from './shared';

// Step 1 — priority overview. Ported from ../../aes-frontend/src/app/
// services/ticket/page.js's Step1Priority + PriorityCard. This is only a
// HINT — once an AC unit is picked in step 2 the real priority is derived
// from its serviceStatus (see priorityFromServiceStatus in serviceStore).
export interface StepPriorityProps {
  value: string;
  onChange: (v: string) => void;
}

const CARDS: { code: 'P1' | 'P2' | 'P3'; Icon: LucideIcon; dark?: boolean }[] = [
  { code: 'P1', Icon: ShieldCheck },
  { code: 'P2', Icon: Award },
  { code: 'P3', Icon: Wrench, dark: true },
];

export function StepPriority({ value, onChange }: StepPriorityProps) {
  const styles = useThemedStyles(makeStyles);
  const { tokens } = useTheme();
  const haptics = useHaptics();

  return (
    <View>
      <WizardHeading
        title="What type of service do you have?"
        sub="This determines your priority and service charges."
      />

      <View style={{ gap: space[3] }}>
        {CARDS.map(({ code, Icon, dark }, i) => {
          const info = PRIORITY_INFO[code];
          const selected = value === code;
          return (
            <MotiView
              key={code}
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 260, delay: i * 60 }}
            >
              <PressableScale
                scaleTo={0.99}
                onPress={() => { haptics.selection(); onChange(code); }}
                style={[
                  styles.card,
                  dark
                    ? { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary }
                    : { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.borderLight },
                  selected && !dark && { borderColor: tokens.colors.secondary, backgroundColor: tokens.colors.secondarySoft, ...shadow('card') },
                  selected && dark && { borderColor: tokens.colors.secondary, ...shadow('card') },
                ]}
              >
                <View style={styles.head}>
                  <Text
                    style={styles.eyebrow}
                    color={dark ? 'secondaryLight' : 'secondaryInk'}
                  >
                    {info.badge}
                  </Text>
                  <View style={[styles.iconWrap, { backgroundColor: dark ? 'rgba(255,255,255,0.1)' : tokens.colors.surfaceContainer }]}>
                    <Icon size={22} color={dark ? '#ffffff' : tokens.colors.primaryDark} />
                  </View>
                </View>

                <Text style={styles.title} color={dark ? 'onPrimary' : 'onSurfaceStrong'}>
                  {info.headline}
                </Text>
                <Text style={[styles.desc, dark && { color: 'rgba(255,255,255,0.75)' }]} color="onSurfaceVariant">
                  {info.desc}
                </Text>

                <View style={styles.chipRow}>
                  {info.chips.map((c) => (
                    <View
                      key={c}
                      style={[
                        styles.chip,
                        { backgroundColor: dark ? 'rgba(255,255,255,0.1)' : tokens.colors.surfaceContainer },
                      ]}
                    >
                      <Check size={11} strokeWidth={3} color={dark ? '#ffffff' : tokens.colors.primaryDark} />
                      <Text style={[styles.chipLabel, { color: dark ? '#ffffff' : tokens.colors.onSurface }]}>{c}</Text>
                    </View>
                  ))}
                </View>

                <View
                  style={[
                    styles.ctaRow,
                    selected
                      ? { backgroundColor: tokens.colors.secondary, borderColor: tokens.colors.secondary, ...shadow('cta') }
                      : {
                        backgroundColor: 'transparent',
                        borderColor: dark ? tokens.colors.secondary : tokens.colors.secondaryInk,
                        ...shadow('glow'),
                      },
                  ]}
                >
                  {selected ? (
                    <>
                      <Check size={16} strokeWidth={3} color={tokens.colors.onSecondary} />
                      <Text style={[styles.ctaLabel, { color: tokens.colors.onSecondary }]}>
                        Selected — Tap Continue
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.ctaLabel, { color: dark ? tokens.colors.secondary : tokens.colors.secondaryInk }]}>
                      {info.cta} →
                    </Text>
                  )}
                </View>
              </PressableScale>
            </MotiView>
          );
        })}
      </View>

      <Text style={styles.footnote} color="onSurfaceVariant" align="center">
        Not sure? Our team will verify your contract status upon assignment.
      </Text>
    </View>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  card: {
    padding: space[4] + 2,
    borderWidth: 1.5,
    borderRadius: radius.md,
  },
  head: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
  },
  eyebrow: {
    fontFamily: font('body', 700),
    fontSize: 11,
    letterSpacing: 0.10 * 11,
    textTransform: 'uppercase' as const,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  title: {
    fontFamily: font('display', 600),
    fontSize: 20,
    marginTop: space[3],
  },
  desc: {
    fontFamily: font('body', 400),
    fontSize: 13,
    lineHeight: 19,
    marginTop: space[2],
  },
  chipRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: space[2],
    marginTop: space[4],
  },
  chip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  chipLabel: {
    fontFamily: font('body', 600),
    fontSize: 11,
  },
  ctaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    marginTop: space[4],
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  ctaLabel: {
    fontFamily: font('body', 700),
    fontSize: 14,
  },
  footnote: {
    fontFamily: font('body', 400),
    fontSize: 12,
    marginTop: space[5],
  },
});
