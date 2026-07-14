import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Linking, ScrollView, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  ArrowRight, Check, Phone,
} from 'lucide-react-native';

import { AppShell } from '@/components/shell/AppShell';
import { Text } from '@/components/primitives/Text';
import { PressableScale } from '@/components/primitives/PressableScale';
import { Sheet, SheetRef } from '@/components/primitives/Sheet';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import {
  AES_BRANDS, AES_PROJECTS, BUILDING_TYPES, PRODUCT_FAMILIES,
} from '@/lib/aesCatalog';
import type { ProductFamily } from '@/lib/aesCatalog';
import type { PropertyType } from '@/types/api';

// Ported from ../../aes-frontend/src/app/services/products/page.js +
// products.module.css. The web opens a centred modal on desktop / bottom
// sheet on mobile for family detail — mobile always uses the bottom sheet
// (via @gorhom/bottom-sheet, same as every other picker in the app).
type FilterValue = 'ALL' | PropertyType;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'ALL', label: 'All spaces' },
  ...BUILDING_TYPES.map((b) => ({ value: b.value, label: b.label.split(' /')[0] })),
];

const HERO_PHOTOS = PRODUCT_FAMILIES.slice(0, 6).map((f) => f.cover);

export default function ProductsCatalogScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const { isPhone, isLarge } = useBreakpoint();
  const styles = useThemedStyles(makeStyles);
  const sheetRef = useRef<SheetRef>(null);

  const [filter, setFilter] = useState<FilterValue>('ALL');
  const [active, setActive] = useState<ProductFamily | null>(null);
  const columns = isPhone ? 1 : isLarge ? 3 : 2;

  const filtered = useMemo(() => {
    if (filter === 'ALL') return PRODUCT_FAMILIES;
    return PRODUCT_FAMILIES.filter((p) => p.bestFor.some((t) => t.toUpperCase() === filter));
  }, [filter]);

  const projectStrip = useMemo(() => {
    const pool = filter === 'ALL' ? AES_PROJECTS : AES_PROJECTS.filter((p) => p.category === filter);
    return pool.slice(0, 8);
  }, [filter]);

  const openFamily = useCallback((fam: ProductFamily) => {
    setActive(fam);
    sheetRef.current?.present();
  }, []);

  const projectSub = filter === 'ALL'
    ? 'Across India'
    : `${filter[0]}${filter.slice(1).toLowerCase()} portfolio`;

  return (
    <AppShell bare>
      {/* Hero */}
      <View style={[styles.hero, !isPhone && styles.heroWide]}>
        <View style={[styles.heroText, !isPhone && styles.heroTextWide]}>
          <View style={[styles.dealerBadge, { backgroundColor: tokens.colors.successLight }]}>
            <Check size={14} strokeWidth={3} color={tokens.colors.success} />
            <Text style={[styles.dealerBadgeLabel, { color: tokens.colors.success }]}>Authorised dealer</Text>
          </View>
          <Text variant="headlineXl" color="onSurfaceStrong" style={styles.heroTitle}>
            Cooling &amp; air-distribution for every kind of space.
          </Text>
          <Text variant="bodyLg" color="onSurfaceVariant" style={styles.heroSub}>
            We design, supply, install and maintain Mitsubishi Electric, LG,
            Hisense, Hitachi and O&apos;General systems across residential,
            commercial, industrial and institutional projects since 2006.
          </Text>
          <View style={styles.heroCtas}>
            <PressableScale
              style={[styles.heroCta, { backgroundColor: tokens.colors.secondary }, shadow('cta')]}
              haptic
              onPress={() => router.push('/services/installation')}
            >
              <Text style={[styles.heroCtaLabel, { color: tokens.colors.onSecondary }]}>PLAN AN INSTALLATION</Text>
              <ArrowRight size={16} strokeWidth={2.4} color={tokens.colors.onSecondary} />
            </PressableScale>
            <PressableScale style={styles.heroCall} onPress={() => Linking.openURL('tel:+914066131555')}>
              <Phone size={14} color={tokens.colors.onSurface} />
              <Text style={[styles.heroCallLabel, { color: tokens.colors.onSurface }]}>+91 40-6613-1555</Text>
            </PressableScale>
          </View>
        </View>

        <View style={[styles.heroGrid, !isPhone && styles.heroGridWide]}>
          {HERO_PHOTOS.map((src) => (
            <View key={src} style={[styles.heroTile, { backgroundColor: tokens.colors.surfaceContainerLow, borderColor: tokens.colors.outlineVariant }]}>
              <Image source={{ uri: src }} style={styles.heroTileImg} contentFit="contain" cachePolicy="memory-disk" transition={200} />
            </View>
          ))}
        </View>
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={[styles.filterGroup, { backgroundColor: tokens.colors.surfaceContainerLow }]}
      >
        {FILTERS.map((f) => {
          const isActive = filter === f.value;
          return (
            <PressableScale
              key={f.value}
              scaleTo={0.96}
              style={[styles.filterChip, isActive && { backgroundColor: tokens.colors.primaryDark }]}
              onPress={() => setFilter(f.value)}
            >
              {isActive && <Check size={14} strokeWidth={3} color={tokens.colors.onPrimary} />}
              <Text style={[styles.filterChipLabel, { color: isActive ? tokens.colors.onPrimary : tokens.colors.onSurfaceVariant }]}>
                {f.label}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      {/* Product family grid */}
      <View style={styles.grid}>
        {filtered.map((fam, i) => (
          <MotiView
            key={fam.slug}
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 320, delay: i < 10 ? i * 60 : 0 }}
            style={{ width: columns === 1 ? '100%' : `${100 / columns}%`, padding: space[2] }}
          >
            <PressableScale
              scaleTo={0.98}
              style={[styles.card, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
              onPress={() => openFamily(fam)}
            >
              <View style={[styles.cardMedia, { backgroundColor: tokens.colors.surfaceContainerLow }]}>
                <Image source={{ uri: fam.cover }} style={styles.cardMediaImg} contentFit="contain" cachePolicy="memory-disk" transition={200} />
                <View style={styles.cardCount}>
                  <Text style={styles.cardCountLabel}>{fam.photos.length} photos</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text variant="headlineMd" color="onSurfaceStrong">{fam.name}</Text>
                <Text variant="bodyMd" color="onSurfaceVariant" style={styles.cardTagline}>{fam.tagline}</Text>
                <View style={styles.cardChips}>
                  {fam.bestFor.slice(0, 3).map((t) => (
                    <View key={t} style={[styles.cardChip, { backgroundColor: tokens.colors.secondarySoft }]}>
                      <Text style={[styles.cardChipLabel, { color: tokens.colors.secondaryInk }]}>{t}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.cardArrowRow}>
                  <Text style={[styles.cardArrowLabel, { color: tokens.colors.secondaryInk }]}>Explore range</Text>
                  <ArrowRight size={16} strokeWidth={2.4} color={tokens.colors.secondaryInk} />
                </View>
              </View>
            </PressableScale>
          </MotiView>
        ))}

        {filtered.length === 0 && (
          <Text variant="bodyMd" color="onSurfaceVariant" align="center" style={styles.emptyGrid}>
            No families match this space — try another filter.
          </Text>
        )}
      </View>

      {/* Brand strip */}
      <View style={[styles.brandSection, { borderTopColor: tokens.colors.outlineVariant }]}>
        <Text variant="headlineLg" color="onSurfaceStrong">Authorised dealer for</Text>
        <View style={styles.brandRow}>
          {AES_BRANDS.map((b) => (
            <View key={b.name} style={[styles.brandTile, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
              <Image source={{ uri: b.logo }} style={styles.brandTileImg} contentFit="contain" cachePolicy="memory-disk" transition={200} accessibilityLabel={b.name} />
            </View>
          ))}
        </View>
      </View>

      {/* Project showcase */}
      <View style={styles.projects}>
        <View style={[styles.sectionHead, { borderBottomColor: tokens.colors.outlineVariant }]}>
          <Text variant="headlineLg" color="onSurfaceStrong">Trusted on projects like</Text>
          <Text variant="bodyMd" color="onSurfaceVariant">{projectSub}</Text>
        </View>
        <View style={styles.projectGrid}>
          {projectStrip.map((p) => (
            <View key={p.name + p.city} style={[styles.projectTile, { backgroundColor: tokens.colors.surfaceContainer }]}>
              <Image source={{ uri: p.image }} style={styles.projectTileImg} contentFit="cover" cachePolicy="memory-disk" transition={200} />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.85)']}
                style={styles.projectMetaGradient}
              />
              <View style={styles.projectMeta}>
                <Text style={styles.projectMetaTitle}>{p.name}</Text>
                <Text style={styles.projectMetaSub}>{p.city}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <Sheet ref={sheetRef} onDismiss={() => setActive(null)} snapPoints={['90%']}>
        {active && (
          <BottomSheetScrollView contentContainerStyle={styles.sheetBody}>
            <View style={[styles.modalHero, { backgroundColor: tokens.colors.surfaceContainerLow }]}>
              <Image source={{ uri: active.cover }} style={styles.modalHeroImg} contentFit="contain" cachePolicy="memory-disk" transition={200} />
            </View>

            <Text variant="headlineXl" color="onSurfaceStrong">{active.name}</Text>
            <Text variant="bodyLg" color="onSurfaceVariant">{active.tagline}</Text>

            <Text style={styles.modalSub} color="onSurfaceVariant">Variants</Text>
            <View style={styles.thumbRow}>
              {active.photos.map((src) => (
                <Image
                  key={src}
                  source={{ uri: src }}
                  style={[styles.thumbImg, { backgroundColor: tokens.colors.surfaceContainerLow, borderColor: tokens.colors.outlineVariant }]}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  transition={200}
                />
              ))}
            </View>

            {(active.indoorUnits || active.variants || active.accessories) && (
              <>
                <Text style={styles.modalSub} color="onSurfaceVariant">Configurations</Text>
                <View style={styles.variantGrid}>
                  {(active.indoorUnits || active.variants || active.accessories || []).map((v) => (
                    <View key={v.label} style={[styles.variantTile, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
                      <Image source={{ uri: v.image }} style={[styles.variantImg, { backgroundColor: tokens.colors.surfaceContainerLow }]} contentFit="contain" cachePolicy="memory-disk" transition={200} />
                      <Text style={styles.variantLabel} color="onSurfaceVariant" align="center">{v.label}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.modalSub} color="onSurfaceVariant">Best for</Text>
            <View style={styles.cardChips}>
              {active.bestFor.map((t) => (
                <View key={t} style={[styles.cardChip, { backgroundColor: tokens.colors.secondarySoft }]}>
                  <Text style={[styles.cardChipLabel, { color: tokens.colors.secondaryInk }]}>{t}</Text>
                </View>
              ))}
            </View>

            <PressableScale
              style={[styles.modalCta, { backgroundColor: tokens.colors.secondary }, shadow('cta')]}
              haptic
              onPress={() => { sheetRef.current?.dismiss(); router.push('/services/installation'); }}
            >
              <Text style={[styles.modalCtaLabel, { color: tokens.colors.onSecondary }]}>Get a quote for this</Text>
              <ArrowRight size={16} color={tokens.colors.onSecondary} />
            </PressableScale>
          </BottomSheetScrollView>
        )}
      </Sheet>
    </AppShell>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  hero: {
    gap: space[6],
    marginBottom: space[10],
  },
  heroWide: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  heroText: {
    gap: space[4],
  },
  heroTextWide: {
    flex: 1,
  },
  dealerBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
  },
  dealerBadgeLabel: {
    fontFamily: font('body', 700),
    fontSize: 11,
    letterSpacing: 0.08 * 11,
    textTransform: 'uppercase' as const,
  },
  heroTitle: {
    maxWidth: 540,
  },
  heroSub: {
    maxWidth: 520,
  },
  heroCtas: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
    gap: space[5],
    marginTop: space[1],
  },
  heroCta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[3],
    paddingVertical: space[4] - 2,
    paddingHorizontal: space[6],
    borderRadius: radius.sm,
  },
  heroCtaLabel: {
    fontFamily: font('body', 700),
    fontSize: 13,
    letterSpacing: 0.08 * 13,
  },
  heroCall: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[2],
  },
  heroCallLabel: {
    fontFamily: font('body', 700),
    fontSize: 13,
    letterSpacing: 0.06 * 13,
    textTransform: 'uppercase' as const,
  },
  heroGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: space[3],
  },
  heroGridWide: {
    flex: 1,
  },
  heroTile: {
    width: '31%' as const,
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space[3],
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  heroTileImg: {
    width: '100%' as const,
    height: '100%' as const,
  },

  filterBar: {
    marginBottom: space[8],
  },
  filterGroup: {
    flexDirection: 'row' as const,
    gap: space[2] - 2,
    padding: space[2] - 2,
    borderRadius: radius.full,
  },
  filterChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: space[3] - 2,
    paddingHorizontal: space[5] - 2,
    borderRadius: radius.full,
  },
  filterChipLabel: {
    fontFamily: font('body', 600),
    fontSize: 13,
    letterSpacing: 0.04 * 13,
  },

  grid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    marginHorizontal: -space[2],
    marginBottom: space[10],
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden' as const,
  },
  cardMedia: {
    width: '100%' as const,
    aspectRatio: 16 / 10,
  },
  cardMediaImg: {
    width: '100%' as const,
    height: '100%' as const,
    padding: space[6],
  },
  cardCount: {
    position: 'absolute' as const,
    top: 14,
    right: 14,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(15, 28, 44, 0.75)',
  },
  cardCountLabel: {
    fontFamily: font('body', 600),
    fontSize: 11,
    letterSpacing: 0.04 * 11,
    color: '#fff',
  },
  cardBody: {
    padding: space[6],
    gap: space[3] + 2,
  },
  cardTagline: {
    minHeight: 42,
  },
  cardChips: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: space[2] - 2,
  },
  cardChip: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 6,
  },
  cardChipLabel: {
    fontFamily: font('body', 700),
    fontSize: 10,
    letterSpacing: 0.06 * 10,
    textTransform: 'uppercase' as const,
  },
  cardArrowRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 6,
  },
  cardArrowLabel: {
    fontFamily: font('body', 700),
    fontSize: 13,
    letterSpacing: 0.05 * 13,
  },
  emptyGrid: {
    width: '100%' as const,
    paddingVertical: space[12],
  },

  brandSection: {
    borderTopWidth: 1,
    paddingTop: space[10],
    gap: space[6],
    marginBottom: space[10],
  },
  brandRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: space[3],
  },
  brandTile: {
    width: '31%' as const,
    height: 100,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: space[5],
  },
  brandTileImg: {
    width: '100%' as const,
    height: '100%' as const,
  },

  projects: {
    gap: space[7],
  },
  sectionHead: {
    gap: space[2],
    paddingBottom: space[5],
    borderBottomWidth: 1,
  },
  projectGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: space[3] + 2,
  },
  projectTile: {
    width: '48%' as const,
    aspectRatio: 4 / 3,
    borderRadius: radius.md + 2,
    overflow: 'hidden' as const,
  },
  projectTileImg: {
    width: '100%' as const,
    height: '100%' as const,
  },
  projectMetaGradient: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%' as const,
  },
  projectMeta: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    padding: space[4],
  },
  projectMetaTitle: {
    fontFamily: font('display', 600),
    fontSize: 16,
    color: '#fff',
  },
  projectMetaSub: {
    fontFamily: font('body', 500),
    fontSize: 12,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 2,
  },

  sheetBody: {
    paddingHorizontal: space[6],
    paddingBottom: space[10],
    gap: space[3],
  },
  modalHero: {
    width: '100%' as const,
    height: 200,
    borderRadius: radius.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: space[2],
  },
  modalHeroImg: {
    width: '100%' as const,
    height: '100%' as const,
    padding: space[6],
  },
  modalSub: {
    fontFamily: font('body', 700),
    fontSize: 11,
    letterSpacing: 0.12 * 11,
    textTransform: 'uppercase' as const,
    marginTop: space[3],
  },
  thumbRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: space[3] - 2,
  },
  thumbImg: {
    width: 96,
    height: 96,
    borderRadius: radius.md - 2,
    borderWidth: 1,
    padding: space[3] - 2,
  },
  variantGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: space[3] - 2,
  },
  variantTile: {
    width: '31%' as const,
    alignItems: 'center' as const,
    gap: space[2],
    padding: space[3],
    borderWidth: 1,
    borderRadius: radius.md,
  },
  variantImg: {
    width: '100%' as const,
    aspectRatio: 1,
    borderRadius: radius.sm,
  },
  variantLabel: {
    fontFamily: font('body', 600),
    fontSize: 11.5,
  },
  modalCta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: space[2],
    marginTop: space[5],
    paddingVertical: space[4],
    paddingHorizontal: space[6],
    borderRadius: radius.full,
  },
  modalCtaLabel: {
    fontFamily: font('body', 600),
    fontSize: 14.5,
  },
});
