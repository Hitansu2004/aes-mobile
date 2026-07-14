import React from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { MotiView } from 'moti';
import {
  AlertCircle, ArrowUpRight, LayoutGrid, Phone, ShieldCheck, Snowflake, Wrench,
} from 'lucide-react-native';

import { AppShell } from '@/components/shell/AppShell';
import { Text } from '@/components/primitives/Text';
import { PressableScale } from '@/components/primitives/PressableScale';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { AES_BRANDS } from '@/lib/aesCatalog';

// Ported from ../../aes-frontend/src/app/services/page.js + services.module.css.
// Every string, card and chip below is copied verbatim from OPTIONS; motion
// (stagger fade+rise) is the mobile-only addition. --aes-primary-fixed /
// --aes-primary-ink (web) have no mobile token equivalent — mapped to
// secondarySoft / secondaryInk, matching the same substitution already used
// by dashboard.tsx's ActionCard icon chip.
const OPTIONS = [
  {
    id: 'install',
    href: '/services/installation',
    eyebrow: 'Project',
    title: 'New AC Installation',
    desc: 'Install a Split, Central, VRF/VRV or Cassette unit at your home or office.',
    chips: ['Split AC', 'Central AC', 'VRF/VRV'],
    Icon: Snowflake,
  },
  {
    id: 'service',
    href: '/services/ticket',
    eyebrow: 'Support',
    title: 'Service / Repair Request',
    desc: 'Your existing AC needs attention — we will diagnose and fix it.',
    chips: ['Not Cooling', 'Noise', 'Water Leak'],
    Icon: Wrench,
  },
  {
    id: 'amc',
    href: '/services/amc',
    eyebrow: 'Maintenance',
    title: 'Schedule AMC Visit',
    desc: 'Book your routine AMC service or check upcoming visits.',
    chips: ['4 visits / year', 'Priority response'],
    Icon: ShieldCheck,
  },
  {
    id: 'catalog',
    href: '/services/products',
    eyebrow: 'Catalog',
    title: 'Browse Products',
    desc: 'VRF, chillers, ductable, cassettes, AHU, ventilation — see the full range.',
    chips: ['VRF', 'Chillers', 'Cassette', 'AHU'],
    Icon: LayoutGrid,
  },
  {
    id: 'errors',
    href: '/services/error-codes',
    eyebrow: 'Diagnose',
    title: 'Error Code Guide',
    desc: 'Look up your AC error code and learn what it means before raising a ticket.',
    chips: ['Daikin', 'Mitsubishi', 'Carrier'],
    Icon: AlertCircle,
  },
] as const;

export default function ServicesChooserScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const { isPhone, isLarge } = useBreakpoint();
  const styles = useThemedStyles(makeStyles);
  const columns = isPhone ? 1 : isLarge ? 3 : 2;

  const hero = (
    <>
      <Text variant="headlineXl" color="onSurfaceStrong">How can we help you?</Text>
      <Text variant="bodyLg" color="onSurfaceVariant" style={styles.heroSub}>
        Choose the type of service you need — we will route you to the right team
        and respond within 30 minutes.
      </Text>
    </>
  );

  return (
    <AppShell hero={hero}>
      <View style={[styles.cards, { gap: isPhone ? space[3] : space[5] }]}>
        {OPTIONS.map(({
          id, href, title, desc, chips, eyebrow, Icon,
        }, i) => (
          <MotiView
            key={id}
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 320, delay: i * 60 }}
            style={{ width: columns === 1 ? '100%' : `${100 / columns}%`, padding: isPhone ? space[1] / 2 : space[2] }}
          >
            <PressableScale style={styles.card} scaleTo={0.98} haptic onPress={() => router.push(href)}>
              <View style={styles.cardHead}>
                <View style={[styles.cardIcon, { backgroundColor: tokens.colors.secondarySoft }]}>
                  <Icon size={24} strokeWidth={1.8} color={tokens.colors.secondaryInk} />
                </View>
                <Text style={styles.eyebrow} color="onSurfaceVariant">{eyebrow}</Text>
              </View>

              <View style={styles.cardBody}>
                <Text variant="headlineMd" color="onSurfaceStrong">{title}</Text>
                <Text variant="bodyMd" color="onSurfaceVariant">{desc}</Text>
              </View>

              <View style={[styles.cardFoot, { borderTopColor: tokens.colors.outlineVariant }]}>
                <View style={styles.chipRow}>
                  {chips.map((c) => (
                    <View key={c} style={[styles.chip, { backgroundColor: tokens.colors.surfaceContainerLow }]}>
                      <Text style={[styles.chipLabel, { color: tokens.colors.secondaryInk }]}>{c}</Text>
                    </View>
                  ))}
                </View>
                {/* services.module.css's .cardArrow reads `background:
                    var(--aes-primary)` — the same pre-Rose-redesign token
                    leftover as account.module.css's .tabActive (see the note
                    in account.tsx): its value is gold, not tokens.colors.primary
                    (navy). Matches the actual rendered web pixel. */}
                <View style={[styles.cardArrow, { backgroundColor: tokens.colors.secondary }, shadow('cta')]}>
                  <ArrowUpRight size={18} strokeWidth={2} color={tokens.colors.onSecondary} />
                </View>
              </View>
            </PressableScale>
          </MotiView>
        ))}
      </View>

      <View style={[styles.brandStrip, { backgroundColor: tokens.colors.surfaceContainerLowest }]}>
        <Text style={styles.brandLabel} color="onSurfaceVariant">Authorised dealer for</Text>
        {/* services.module.css's .brandLogos is `flex-wrap:wrap`, but its
            <img> tags are `width:auto` (natural aspect ratio at height 30) —
            on the web's own hero-width layout the 5 real logos are narrow
            enough to stay on one line in practice. RN's Image needs an
            explicit width, and a fixed-width-per-logo wrap was going to two
            rows on phone. A horizontal ScrollView guarantees the "one line"
            web looks like regardless of exact logo/screen width, without
            guessing at per-logo aspect ratios. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.brandLogos}
        >
          {AES_BRANDS.map((b) => (
            <Image
              key={b.name}
              source={{ uri: b.logo }}
              style={styles.brandLogo}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={200}
              accessibilityLabel={b.name}
            />
          ))}
        </ScrollView>
      </View>

      <PressableScale
        style={[styles.helpLine, { backgroundColor: tokens.colors.secondarySoft }]}
        haptic
        onPress={() => Linking.openURL('tel:+914066131555')}
      >
        <Phone size={14} color={tokens.colors.secondaryInk} />
        <Text style={[styles.helpLineText, { color: tokens.colors.secondaryInk }]}>
          Not sure where to start? Call us at <Text style={styles.helpLineStrong}>+91 40-6613-1555</Text>
        </Text>
      </PressableScale>
    </AppShell>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  heroSub: {
    maxWidth: 640,
    marginTop: space[1],
  },
  cards: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    marginBottom: space[8],
  },
  card: {
    flex: 1,
    gap: space[5],
    padding: space[6],
    minHeight: 220,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: 'rgba(11, 26, 44, 0.06)',
    borderRadius: radius.xl,
    ...shadow('card'),
  },
  cardHead: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    gap: space[4],
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  eyebrow: {
    fontFamily: font('mono', 600),
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    textTransform: 'uppercase' as const,
    paddingTop: 6,
  },
  cardBody: {
    flex: 1,
    gap: space[2],
  },
  cardFoot: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: space[3],
    paddingTop: space[4],
    borderTopWidth: 1,
    borderStyle: 'dashed' as const,
  },
  chipRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    flex: 1,
    gap: space[2] - 2,
  },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  chipLabel: {
    fontFamily: font('mono', 500),
    fontSize: 10,
    letterSpacing: 0.06 * 10,
    textTransform: 'uppercase' as const,
  },
  cardArrow: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  brandStrip: {
    gap: space[4],
    padding: space[6],
    borderWidth: 1,
    borderColor: 'rgba(11, 26, 44, 0.06)',
    borderRadius: radius.xl,
    marginBottom: space[6],
  },
  brandLabel: {
    fontFamily: font('mono', 500),
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    textTransform: 'uppercase' as const,
  },
  brandLogos: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[3],
  },
  brandLogo: {
    height: 28,
    width: 46,
    opacity: 0.75,
  },
  helpLine: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: space[2] + 2,
    paddingVertical: space[3] + 2,
    paddingHorizontal: space[5] + 2,
    borderRadius: radius.full,
  },
  helpLineText: {
    fontFamily: font('body', 400),
    fontSize: 13,
  },
  helpLineStrong: {
    fontFamily: font('body', 700),
  },
});
