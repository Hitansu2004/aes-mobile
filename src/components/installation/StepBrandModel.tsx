import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { MotiView } from 'moti';
import { Check, Plus, Sparkles } from 'lucide-react-native';

import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives/Text';
import { PressableScale } from '@/components/primitives/PressableScale';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useHaptics } from '@/hooks/useHaptics';
import {
  BRANDS, TONNAGES, ENERGY_RATINGS, SUGGESTED_MODELS, modelDiscount, modelEmi,
  SuggestedModel,
} from '@/lib/constants';
import { BRAND_LOGOS } from '@/lib/aesCatalog';
import type { InstallState } from '@/store/installationStore';
import { WizardHeading, SectionLabel, inrFmt } from './shared';

// Step 3 — Brand & Model. Ported from installation/page.js's `Step2` (the
// web's internal numbering again lags the wizard-visible step by one) +
// its .brandGrid/.chipScroll/.modelGrid/.modelCard classes. The biggest step
// in the wizard — every field on the model card is ported, including the
// sort (matching star rating first, then offer price ascending).
export interface StepBrandModelProps {
  brand: string;
  tonnage: string;
  energyRating: number;
  modelNumber: string;
  onChange: (patch: Partial<InstallState>) => void;
}

export function StepBrandModel({
  brand, tonnage, energyRating, modelNumber, onChange,
}: StepBrandModelProps) {
  const styles = useThemedStyles(makeStyles);
  const { tokens } = useTheme();
  const { isPhone, isLarge } = useBreakpoint();
  const haptics = useHaptics();
  const brandColumns = isLarge ? 6 : isPhone ? 2 : 4;
  const modelColumns = isLarge ? 3 : isPhone ? 1 : 2;

  const filteredModels = useMemo(() => {
    if (!brand || brand === 'Other') return [];
    const base = SUGGESTED_MODELS.filter((m) => m.brand === brand && m.tonnage === tonnage);
    if (base.length === 0) return [];
    return [...base].sort((a, b) => {
      const aMatch = a.rating === energyRating ? 0 : 1;
      const bMatch = b.rating === energyRating ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return a.offer - b.offer;
    });
  }, [brand, tonnage, energyRating]);

  return (
    <View>
      <WizardHeading
        title="Pick a brand & model"
        sub="Select a system you want installed — or skip the model and let our engineer recommend during the site visit."
      />

      <SectionLabel>Select Brand</SectionLabel>
      <View style={styles.brandGrid}>
        {BRANDS.map((b) => {
          const selected = brand === b;
          const logo = BRAND_LOGOS[b];
          const initials = b.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
          return (
            <View key={b} style={{ width: `${100 / brandColumns}%`, padding: space[1] + 1 }}>
              <PressableScale
                scaleTo={0.96}
                onPress={() => { haptics.selection(); onChange({ brand: b, modelNumber: '' }); }}
                style={[
                  styles.brandTile,
                  { borderColor: selected ? tokens.colors.secondary : tokens.colors.borderLight },
                  selected && { backgroundColor: tokens.colors.secondarySoft, ...shadow('sm') },
                ]}
              >
                {selected && (
                  <View style={[styles.brandCheck, { backgroundColor: tokens.colors.secondary }]}>
                    <Check size={11} strokeWidth={3} color={tokens.colors.onSecondary} />
                  </View>
                )}
                {logo ? (
                  <Image
                    source={{ uri: logo }}
                    style={styles.brandLogo}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={200}
                    accessibilityLabel={b}
                  />
                ) : (
                  <View style={[styles.brandInitials, { backgroundColor: selected ? tokens.colors.secondary : tokens.colors.surfaceContainer }]}>
                    <Text style={[styles.brandInitialsLabel, { color: selected ? tokens.colors.onSecondary : tokens.colors.primaryDark }]}>
                      {initials}
                    </Text>
                  </View>
                )}
                <Text style={styles.brandName} color={selected ? 'secondaryInk' : 'onSurfaceVariant'} numberOfLines={2} align="center">
                  {b}
                </Text>
              </PressableScale>
            </View>
          );
        })}
      </View>

      <PressableScale
        onPress={() => { haptics.selection(); onChange({ brand: brand === 'Other' ? '' : 'Other', modelNumber: '' }); }}
        style={styles.linkButton}
      >
        <Plus size={14} color={tokens.colors.secondaryInk} />
        <Text style={[styles.linkButtonLabel, { color: tokens.colors.secondaryInk, fontFamily: font('body', brand === 'Other' ? 700 : 600) }]}>
          Other brand — engineer will recommend
        </Text>
      </PressableScale>

      <SectionLabel>Capacity (Tonnage)</SectionLabel>
      <View style={styles.chipRow}>
        {TONNAGES.map((t) => {
          const active = tonnage === t;
          return (
            <PressableScale
              key={t}
              scaleTo={0.96}
              onPress={() => { haptics.selection(); onChange({ tonnage: t, modelNumber: '' }); }}
              style={[styles.chipPill, { backgroundColor: active ? tokens.colors.primary : tokens.colors.surfaceContainer }]}
            >
              <Text style={[styles.chipPillLabel, { color: active ? tokens.colors.onPrimary : tokens.colors.onSurface }]}>{t}T</Text>
            </PressableScale>
          );
        })}
      </View>

      <SectionLabel>Energy Rating</SectionLabel>
      <View style={styles.chipRow}>
        {ENERGY_RATINGS.map(({ value, label }) => {
          const active = energyRating === value;
          const gold = value === 5 && active;
          return (
            <PressableScale
              key={value}
              scaleTo={0.96}
              onPress={() => { haptics.selection(); onChange({ energyRating: value }); }}
              style={[
                styles.ratingChip,
                { backgroundColor: active ? (gold ? '#f97316' : tokens.colors.primary) : tokens.colors.surfaceContainer },
              ]}
            >
              <Text style={[styles.chipPillLabel, { color: active ? '#fff' : tokens.colors.onSurface }]}>{label}</Text>
              <Text style={styles.starRow}>{'★'.repeat(value)}</Text>
            </PressableScale>
          );
        })}
      </View>

      {brand && brand !== 'Other' && (
        <>
          <SectionLabel
            right={filteredModels.length > 0 ? (
              <View style={[styles.modelCount, { backgroundColor: tokens.colors.secondarySoft }]}>
                <Text style={[styles.modelCountLabel, { color: tokens.colors.secondaryInk }]}>
                  {filteredModels.length} model{filteredModels.length === 1 ? '' : 's'}
                </Text>
              </View>
            ) : null}
          >
            {`Suggested Models · ${brand} · ${tonnage}T`}
          </SectionLabel>

          {filteredModels.length === 0 ? (
            <View style={[styles.emptyCard, { borderColor: tokens.colors.outlineVariant }]}>
              <Sparkles size={18} color={tokens.colors.onSurfaceVariant} />
              <View style={{ flex: 1 }}>
                <Text style={styles.emptyTitle} color="onSurface">No catalog match for this combo</Text>
                <Text style={styles.emptyBody} color="onSurfaceVariant">
                  Try a nearby tonnage or rating — or continue and our engineer will suggest the best fit during the site visit.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.modelGrid}>
              {filteredModels.map((mdl, i) => (
                <MotiView
                  key={mdl.model}
                  from={{ opacity: 0, translateY: 12 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 260, delay: i * 40 }}
                  style={{ width: `${100 / modelColumns}%`, padding: space[2] }}
                >
                  <ModelCard
                    model={mdl}
                    selected={modelNumber === mdl.model}
                    tokens={tokens}
                    styles={styles}
                    onSelect={() => {
                      haptics.selection();
                      const selected = modelNumber === mdl.model;
                      onChange({
                        modelNumber: selected ? '' : mdl.model,
                        energyRating: selected ? energyRating : mdl.rating,
                      });
                    }}
                  />
                </MotiView>
              ))}
            </View>
          )}

          <Text style={styles.disclaimer} color="onSurfaceVariant" align="center">
            Indicative MRP / online-offer prices · final quote shared after the free site visit.
          </Text>
        </>
      )}
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;
type Tokens = ReturnType<typeof useTheme>['tokens'];

function ModelCard({
  model: mdl, selected, tokens, styles, onSelect,
}: {
  model: SuggestedModel; selected: boolean; tokens: Tokens; styles: Styles; onSelect: () => void;
}) {
  const discount = modelDiscount(mdl);
  const emi = modelEmi(mdl);
  const isInverter = mdl.features.some((f) => /inverter/i.test(f));
  const logo = BRAND_LOGOS[mdl.brand];

  return (
    <View style={[styles.modelCard, { borderColor: selected ? tokens.colors.secondary : tokens.colors.borderLight }, selected && { backgroundColor: tokens.colors.secondarySoft, ...shadow('card') }]}>
      <View style={styles.modelMedia}>
        <Image source={{ uri: mdl.photo }} style={styles.modelMediaImg} contentFit="contain" cachePolicy="memory-disk" transition={200} accessibilityLabel={`${mdl.brand} ${mdl.model}`} />
        <View style={styles.modelBadgeRow}>
          <View style={styles.modelStarBadge}>
            <Text style={styles.modelStarBadgeLabel}>{'★'.repeat(mdl.rating)}</Text>
          </View>
          {isInverter && (
            <View style={[styles.modelInvBadge, { backgroundColor: tokens.colors.primary }]}>
              <Text style={[styles.modelInvBadgeLabel, { color: tokens.colors.onPrimary }]}>Inverter</Text>
            </View>
          )}
        </View>
        {discount > 0 && (
          <View style={styles.modelOffBadge}>
            <Text style={styles.modelOffBadgeLabel}>{discount}% OFF</Text>
          </View>
        )}
      </View>

      <View style={styles.modelBody}>
        <View style={styles.modelHead}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.modelBrandLogo} contentFit="contain" cachePolicy="memory-disk" accessibilityLabel={mdl.brand} />
          ) : (
            <Text style={[styles.modelBrandText, { color: tokens.colors.primaryDark }]}>{mdl.brand}</Text>
          )}
          <Text style={styles.modelEyebrow} color="onSurfaceVariant">{mdl.model}</Text>
        </View>

        <Text style={styles.modelTitle} color="onSurface">
          {`${mdl.brand} ${mdl.tonnage}T ${mdl.rating}-Star ${isInverter ? 'Inverter ' : ''}Split AC`}
        </Text>

        <View style={styles.modelPriceRow}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={[styles.modelOffer, { color: tokens.colors.primaryDark }]}>{inrFmt(mdl.offer)}</Text>
            {mdl.mrp > mdl.offer && (
              <Text style={styles.modelMrp} color="onSurfaceVariant">{inrFmt(mdl.mrp)}</Text>
            )}
          </View>
          <Text style={styles.modelEmi} color="onSurfaceVariant">{`EMI ~ ${inrFmt(emi)}/mo`}</Text>
        </View>

        <View style={styles.modelFeatureRow}>
          {mdl.features.slice(0, 3).map((f) => (
            <View key={f} style={[styles.modelFeature, { backgroundColor: tokens.colors.surfaceContainer }]}>
              <Text style={[styles.modelFeatureLabel, { color: tokens.colors.primaryDark }]}>{f}</Text>
            </View>
          ))}
        </View>

        <PressableScale
          scaleTo={0.97}
          onPress={onSelect}
          style={[
            styles.modelButton,
            { borderColor: tokens.colors.secondary, backgroundColor: selected ? tokens.colors.secondary : 'transparent' },
          ]}
        >
          {selected ? (
            <>
              <Check size={14} strokeWidth={3} color={tokens.colors.onSecondary} />
              <Text style={[styles.modelButtonLabel, { color: tokens.colors.onSecondary }]}>Selected</Text>
            </>
          ) : (
            <Text style={[styles.modelButtonLabel, { color: tokens.colors.secondaryInk }]}>Select this model</Text>
          )}
        </PressableScale>
      </View>
    </View>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  brandGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    marginHorizontal: -space[1],
  },
  brandTile: {
    minHeight: 84,
    borderRadius: radius.lg - 2,
    borderWidth: 1.5,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: space[3],
    paddingHorizontal: space[2] + 2,
  },
  brandCheck: {
    position: 'absolute' as const,
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  brandLogo: {
    width: '90%' as const,
    maxWidth: 84,
    height: 30,
  },
  brandInitials: {
    width: 34,
    height: 34,
    borderRadius: radius.sm + 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  brandInitialsLabel: {
    fontFamily: font('body', 700),
    fontSize: 12.5,
    letterSpacing: 0.4,
  },
  brandName: {
    fontFamily: font('body', 600),
    fontSize: 11,
  },
  linkButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: 6,
    paddingVertical: space[2],
    marginTop: space[2],
  },
  linkButtonLabel: {
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: space[2],
  },
  chipPill: {
    paddingVertical: space[2],
    paddingHorizontal: space[4] + 2,
    borderRadius: radius.full,
  },
  chipPillLabel: {
    fontFamily: font('body', 600),
    fontSize: 13,
  },
  ratingChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: space[2],
    paddingHorizontal: space[3] + 2,
    borderRadius: radius.full,
  },
  starRow: {
    fontSize: 11,
    color: '#fbbf24',
  },
  modelCount: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: radius.full,
  },
  modelCountLabel: {
    fontFamily: font('body', 700),
    fontSize: 11,
  },
  emptyCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: space[3],
    padding: space[4],
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderRadius: radius.lg - 2,
    backgroundColor: tokens.colors.surfaceContainerLowest,
  },
  emptyTitle: {
    fontFamily: font('body', 700),
    fontSize: 14,
    marginBottom: 4,
  },
  emptyBody: {
    fontFamily: font('body', 400),
    fontSize: 12.5,
    lineHeight: 18,
  },
  modelGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    marginHorizontal: -space[2],
  },
  modelCard: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    overflow: 'hidden' as const,
  },
  modelMedia: {
    width: '100%' as const,
    aspectRatio: 16 / 11,
    backgroundColor: '#eef3f8',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  modelMediaImg: {
    width: '78%' as const,
    height: '78%' as const,
  },
  modelBadgeRow: {
    position: 'absolute' as const,
    top: 10,
    left: 10,
    flexDirection: 'row' as const,
    gap: 6,
  },
  modelStarBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  modelStarBadgeLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#f59e0b',
  },
  modelInvBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
  },
  modelInvBadgeLabel: {
    fontFamily: font('body', 700),
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  modelOffBadge: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radius.full,
    backgroundColor: '#f97316',
  },
  modelOffBadgeLabel: {
    fontFamily: font('body', 700),
    fontSize: 11,
    color: '#fff',
  },
  modelBody: {
    padding: space[3] + 2,
    gap: space[2],
  },
  modelHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: space[2],
  },
  modelBrandLogo: {
    height: 20,
    maxWidth: 84,
  },
  modelBrandText: {
    fontFamily: font('body', 700),
    fontSize: 12,
  },
  modelEyebrow: {
    fontFamily: font('body', 700),
    fontSize: 10.5,
    letterSpacing: 0.08 * 10.5,
    textTransform: 'uppercase' as const,
  },
  modelTitle: {
    fontFamily: font('body', 700),
    fontSize: 14,
    lineHeight: 19,
  },
  modelPriceRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'space-between' as const,
  },
  modelOffer: {
    fontFamily: font('display', 700),
    fontSize: 19,
  },
  modelMrp: {
    marginLeft: 8,
    fontSize: 12,
    fontFamily: font('body', 500),
    textDecorationLine: 'line-through' as const,
  },
  modelEmi: {
    fontFamily: font('body', 600),
    fontSize: 11,
  },
  modelFeatureRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  modelFeature: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
  },
  modelFeatureLabel: {
    fontFamily: font('body', 600),
    fontSize: 10.5,
  },
  modelButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    marginTop: space[1],
    paddingVertical: space[3] - 2,
    borderWidth: 1.5,
    borderRadius: radius.md,
  },
  modelButtonLabel: {
    fontFamily: font('body', 700),
    fontSize: 13,
  },
  disclaimer: {
    marginTop: space[3],
    fontSize: 11.5,
  },
});
