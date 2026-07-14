import React from 'react';
import { TextInput, View } from 'react-native';
import { MotiView } from 'moti';
import {
  AlertTriangle, Award, Check, Clock, CloudSun, History, IndianRupee,
  Info, MapPin, MapPinned, Moon, ShieldCheck, Snowflake, Sun, Tag, Wrench, LucideIcon,
} from 'lucide-react-native';

import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives/Text';
import { PressableScale } from '@/components/primitives/PressableScale';
import { Button } from '@/components/primitives/Button';
import { Select } from '@/components/primitives/Input';
import { Spinner } from '@/components/primitives/Spinner';
import { CountUp } from '@/components/primitives/CountUp';
import { DayPicker, DayAvailability } from '@/components/ui/DayPicker';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { useHaptics } from '@/hooks/useHaptics';
import { PROBLEM_CATEGORIES, TIME_SLOTS, acTypeLabel } from '@/lib/constants';
import { PRIORITY_INFO, ServiceState } from '@/store/serviceStore';
import type { AcUnit, PriceQuote, Property, TimeSlot } from '@/types/api';
import { inrFmt, SectionLabel, WizardHeading } from './shared';

// Step 4 — schedule + dynamic pricing + summary. Ported from
// ../../aes-frontend/src/app/services/ticket/page.js's Step4Schedule +
// PriceCard. The pricing/coupon logic here is the most business-critical
// code in the wizard — the parent screen owns priceQuote/coupon state and
// debounces the coupon re-fetch; this component only renders it.
const SLOT_ICONS: Record<string, LucideIcon> = {
  EARLY: Clock, MORNING: Sun, AFTERNOON: CloudSun, EVENING: Moon,
};

export interface StepScheduleProps {
  priority: string;
  acMeta: ServiceState['acUnitMeta'];
  state: ServiceState;
  set: (patch: Partial<ServiceState>) => void;
  priceQuote: PriceQuote | null;
  pricingLoading: boolean;
  couponInput: string;
  onCouponChange: (v: string) => void;
  ticketProperty: Property | null;
  addressMissing: boolean;
  onPickAddress: () => void;
  propertiesList: Property[];
  acUnitsForActiveProperty: (AcUnit & { propertyLabel?: string })[];
  activePropertyId: string | null;
  slotAvailability: Record<string, DayAvailability & { slots?: Record<string, { available: number; full: boolean }> }>;
  dayCapacity: number;
  onChangeProperty: (propertyId: string) => void;
  onChangeAcUnit: (acUnitId: string) => void;
}

export function StepSchedule({
  priority, acMeta, state, set,
  priceQuote, pricingLoading, couponInput, onCouponChange, ticketProperty,
  addressMissing, onPickAddress,
  propertiesList, acUnitsForActiveProperty, activePropertyId, onChangeProperty, onChangeAcUnit,
  slotAvailability, dayCapacity,
}: StepScheduleProps) {
  const styles = useThemedStyles(makeStyles);
  const { tokens } = useTheme();
  const haptics = useHaptics();

  const info = priority ? PRIORITY_INFO[priority as 'P1' | 'P2' | 'P3'] : null;
  const todaysSlots = state.scheduledDate ? slotAvailability[state.scheduledDate]?.slots : null;

  return (
    <View>
      <WizardHeading title="Schedule the visit" sub="Pick the date and slot that suits you best." />

      {info && (() => {
        // ticket.module.css's .banner_${accent} varies the WHOLE banner's
        // bg/text per priority tier (amc/warranty/paid), not one generic
        // "info" tone — P1=amc (light blue-navy), P2=warranty (gold),
        // P3=paid (solid navy/white). The web icon also sits bare on that
        // background (no separate chip); the icon-chip here is a mobile-only
        // embellishment, kept but recoloured to the same tone so it doesn't
        // clash with the now-correct banner colour.
        const tone = {
          amc: { bg: tokens.colors.primaryContainer, fg: tokens.colors.primary, chip: 'rgba(11,26,44,0.10)' },
          warranty: { bg: tokens.colors.secondarySoft, fg: tokens.colors.secondaryInk, chip: 'rgba(143,112,30,0.14)' },
          paid: { bg: tokens.colors.primary, fg: '#ffffff', chip: 'rgba(255,255,255,0.16)' },
        }[info.accent];
        return (
          <View style={[styles.banner, { backgroundColor: tone.bg }]}>
            <View style={[styles.bannerIcon, { backgroundColor: tone.chip }]}>
              {priority === 'P1' && <ShieldCheck size={16} color={tone.fg} />}
              {priority === 'P2' && <Award size={16} color={tone.fg} />}
              {priority === 'P3' && <Wrench size={16} color={tone.fg} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: tone.fg }]}>{info.badge}</Text>
              <Text style={[styles.bannerSub, { color: tone.fg, opacity: 0.8 }]}>{`${info.sla} · ${info.headline}`}</Text>
            </View>
          </View>
        );
      })()}

      {priority === 'P3' && (
        <PriceCard
          quote={priceQuote}
          loading={pricingLoading}
          couponInput={couponInput}
          onCouponChange={onCouponChange}
          property={ticketProperty}
          acMeta={acMeta}
          addressMissing={addressMissing}
          onPickAddress={onPickAddress}
        />
      )}

      <View style={[styles.summaryCard, { borderColor: tokens.colors.borderLight }]}>
        <View style={[styles.summaryHead, { backgroundColor: tokens.colors.surfaceContainerLow }]}>
          <Text style={styles.summaryHeadLabel} color="primaryDark">Service Summary</Text>
        </View>

        <View style={styles.summaryRow}>
          <MapPin size={18} color={tokens.colors.onSurfaceVariant} style={styles.summaryIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel} color="onSurfaceVariant">Property</Text>
            <Select
              options={propertiesList.map((p) => ({ value: p.id, label: p.label }))}
              value={activePropertyId || acMeta?.propertyId || ''}
              onChange={onChangeProperty}
              placeholder="Select a property"
            />
          </View>
        </View>

        <View style={styles.summaryRow}>
          <Snowflake size={18} color={tokens.colors.onSurfaceVariant} style={styles.summaryIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel} color="onSurfaceVariant">AC Unit</Text>
            <Select
              options={acUnitsForActiveProperty.map((u) => ({
                value: u.id,
                label: `${u.brand || ''} ${u.modelNumber || ''} · ${u.roomLabel} · ${acTypeLabel(u.acType)}`.replace(/\s+/g, ' ').trim(),
              }))}
              value={state.acUnitId || ''}
              onChange={onChangeAcUnit}
              placeholder="Select an AC unit"
              helperText={acUnitsForActiveProperty.length === 0 ? 'No AC units on this property — add one from the Account page first.' : undefined}
            />
          </View>
        </View>

        <View style={styles.summaryRow}>
          <AlertTriangle size={18} color={tokens.colors.onSurfaceVariant} style={styles.summaryIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel} color="onSurfaceVariant">Problem</Text>
            <Select
              options={PROBLEM_CATEGORIES.map((p) => ({ value: p.value, label: p.label }))}
              value={state.problemCategory || ''}
              onChange={(v) => set({ problemCategory: v })}
              placeholder="Select a problem"
              helperText={state.errorCode ? `Reported error code · ${state.errorCode}` : undefined}
            />
          </View>
        </View>
      </View>

      <View style={styles.scheduleSection}>
        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionHeading} color="onSurfaceStrong">Select Date &amp; Time</Text>
          <View style={styles.capacityHint}>
            <History size={11} color={tokens.colors.onSurfaceVariant} />
            <Text style={styles.capacityHintLabel} color="onSurfaceVariant">{`${dayCapacity} slots / day`}</Text>
          </View>
        </View>

        <DayPicker
          value={state.scheduledDate}
          onChange={(iso) => {
            const newSlotsForDay = slotAvailability[iso]?.slots;
            const stillOk = state.scheduledSlot && newSlotsForDay
              ? !newSlotsForDay[state.scheduledSlot]?.full
              : true;
            set({ scheduledDate: iso, scheduledSlot: stillOk ? state.scheduledSlot : '' });
          }}
          days={14}
          availability={slotAvailability}
          dayCapacity={dayCapacity}
        />

        {state.scheduledDate && slotAvailability[state.scheduledDate]?.busyReason && (
          <View style={styles.busyBanner}>
            <AlertTriangle size={13} color={tokens.colors.warning} />
            <Text style={styles.busyBannerLabel} color="warning">{slotAvailability[state.scheduledDate].busyReason}</Text>
          </View>
        )}

        <View style={styles.slotGrid}>
          {TIME_SLOTS.map(({ value: v, label, range }, i) => {
            const Icon = SLOT_ICONS[v] || Sun;
            const selected = state.scheduledSlot === v;
            const slotInfo = todaysSlots?.[v as TimeSlot];
            const slotFull = !!slotInfo?.full;
            const disabled = !state.scheduledDate || slotFull;
            return (
              <MotiView
                key={v}
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 220, delay: Math.min(i, 9) * 40 }}
                style={styles.slotCardWrap}
              >
                <PressableScale
                  scaleTo={disabled ? 1 : 0.97}
                  onPress={() => { if (!disabled) { haptics.selection(); set({ scheduledSlot: v }); } }}
                  style={[
                    styles.slotCard,
                    { borderColor: selected ? tokens.colors.secondary : tokens.colors.borderLight },
                    selected && { backgroundColor: tokens.colors.secondarySoft },
                    slotFull && styles.slotCardFull,
                    disabled && { opacity: 0.55 },
                  ]}
                >
                  <Icon size={18} color={slotFull ? '#b91c1c' : selected ? tokens.colors.primaryDark : tokens.colors.onSurface} />
                  <Text style={[styles.slotLabel, slotFull && { color: '#b91c1c' }]} color="onSurface">{label}</Text>
                  <Text style={styles.slotRange} color="onSurfaceVariant">{range}</Text>
                  {slotInfo ? (
                    <Text style={[styles.slotTag, { color: slotFull ? '#b91c1c' : tokens.colors.warning }]}>
                      {slotFull ? 'Full' : `${slotInfo.available} left`}
                    </Text>
                  ) : null}
                </PressableScale>
              </MotiView>
            );
          })}
        </View>
      </View>

      <View style={styles.whatsNext}>
        <View style={styles.sectionHeadRow}>
          <Info size={15} color={tokens.colors.primaryDark} />
          <Text style={styles.sectionHeading} color="onSurfaceStrong">What Happens Next</Text>
        </View>
        <View style={{ gap: space[1] + 2 }}>
          {[
            'Ticket generated & assigned to available technician',
            'Technician confirms dispatch time via app',
            'Service performed and documented',
            'Review and closure',
          ].map((line) => (
            <View key={line} style={styles.timelineRow}>
              <View style={[styles.timelineDot, { backgroundColor: tokens.colors.outline }]} />
              <Text style={styles.timelineLabel} color="onSurfaceVariant">{line}</Text>
            </View>
          ))}
        </View>
      </View>

      {info && (
        <View style={[
          styles.chargeNote,
          { backgroundColor: info.chargeTone === 'success' ? tokens.colors.successLight : tokens.colors.surfaceContainer },
        ]}
        >
          {info.chargeTone === 'success'
            ? <Check size={18} color={tokens.colors.success} />
            : <IndianRupee size={18} color={tokens.colors.onSurfaceVariant} />}
          <Text style={styles.chargeNoteLabel} color={info.chargeTone === 'success' ? 'success' : 'onSurface'}>
            {info.chargeNote}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Dynamic pricing card (P3 only) ──────────────────────────────────────

function PriceCard({
  quote, loading, couponInput, onCouponChange, property, acMeta, addressMissing, onPickAddress,
}: {
  quote: PriceQuote | null; loading: boolean; couponInput: string; onCouponChange: (v: string) => void;
  property: Property | null; acMeta: ServiceState['acUnitMeta']; addressMissing: boolean; onPickAddress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { tokens } = useTheme();
  const distance = quote?.distanceKm != null ? Number(quote.distanceKm).toFixed(1) : null;
  const total = quote?.total ?? 0;
  const couponApplied = !!quote?.couponCode && (quote?.discountAmount ?? 0) > 0;
  const couponError = !!quote?.couponMessage && !couponApplied;

  return (
    <View style={[styles.priceCard, { borderColor: tokens.colors.borderLight, backgroundColor: tokens.colors.surfaceContainerLow }]}>
      {addressMissing ? (
        <PressableScale style={[styles.addressPrompt, { backgroundColor: '#fde68a30', borderColor: '#f59e0b' }]} onPress={onPickAddress}>
          <View style={[styles.addressPromptIcon, { backgroundColor: '#f59e0b' }]}>
            <MapPin size={18} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.addressPromptTitle}>Set your visit address</Text>
            <Text style={styles.addressPromptSub}>We&rsquo;ll calculate the exact service charge based on the distance from our office.</Text>
          </View>
        </PressableScale>
      ) : (
        <PressableScale
          style={[styles.addressCard, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.borderLight }]}
          onPress={onPickAddress}
        >
          <MapPinned size={16} color={tokens.colors.secondaryInk} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.addressCardLabel} color="onSurfaceVariant">Visit address</Text>
            <Text style={styles.addressCardValue} color="onSurface">
              {property?.formattedAddress || [property?.addressLine1, property?.city].filter(Boolean).join(', ')}
            </Text>
            {property?.landmark ? (
              <Text style={styles.addressCardLandmark} color="onSurfaceVariant">{`Landmark: ${property.landmark}`}</Text>
            ) : null}
          </View>
          <Text style={styles.addressCardChange} color="secondaryInk">Change</Text>
        </PressableScale>
      )}

      <View style={styles.priceHeadRow}>
        <IndianRupee size={16} color={tokens.colors.secondaryInk} />
        <Text style={styles.priceHeadLabel} color="onSurface">Service charge breakdown</Text>
      </View>

      {loading && (
        <View style={styles.priceLoadingRow}>
          <Spinner size="sm" />
          <Text variant="bodySm" color="onSurfaceVariant">Calculating based on AC type and distance…</Text>
        </View>
      )}

      {!loading && quote && !addressMissing && (
        <>
          <View style={{ gap: 6 }}>
            <PriceRow label={`Base — ${acTypeLabel(acMeta?.acType || '')}`} value={inrFmt(quote.baseCharge)} />
            <PriceRow label={`Distance — ${distance} km from AES office`} value={quote.distanceCharge ? `+${inrFmt(quote.distanceCharge)}` : 'Free'} />
            {couponApplied && (
              <PriceRow
                label={`Coupon ${quote.couponCode} (${quote.discountPct}% off)`}
                value={`− ${inrFmt(quote.discountAmount)}`}
                positive
              />
            )}
            <View style={[styles.priceDivider, { backgroundColor: tokens.colors.borderLight }]} />
            <View style={styles.priceTotalRow}>
              <Text style={styles.priceTotalLabel} color="onSurfaceVariant">You pay now</Text>
              <CountUp
                value={total}
                format={inrFmt}
                duration={400}
                style={{ fontFamily: font('body', 800), fontSize: 16, color: tokens.colors.onSurfaceStrong }}
              />
            </View>
          </View>

          <View style={styles.couponRow}>
            <View style={[styles.couponInputWrap, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.borderLight }]}>
              <Tag size={14} color={tokens.colors.onSurfaceVariant} />
              <TextInput
                value={couponInput}
                onChangeText={(t) => onCouponChange(t.toUpperCase())}
                placeholder="Apply discount code"
                placeholderTextColor={tokens.colors.outline}
                autoCapitalize="characters"
                style={[styles.couponInput, { color: tokens.colors.onSurface }]}
              />
            </View>
            {couponInput ? (
              <Button variant="ghost" size="sm" onPress={() => onCouponChange('')}>Clear</Button>
            ) : null}
          </View>

          {couponError && <Text variant="bodySm" color="error">{quote.couponMessage}</Text>}
          {couponApplied && <Text variant="bodySm" color="success">{quote.couponMessage}</Text>}
        </>
      )}

      {!loading && addressMissing && (
        <Text variant="bodySm" color="onSurfaceVariant">
          Once you set your address, we&rsquo;ll show the final amount (base + distance band).
        </Text>
      )}
    </View>
  );
}

function PriceRow({ label, value, positive = false, bold = false }: { label: string; value: string; positive?: boolean; bold?: boolean }) {
  const { tokens } = useTheme();
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between', gap: space[3],
    }}
    >
      <Text style={{ flex: 1, fontSize: 13 }} color="onSurfaceVariant">{label}</Text>
      <Text style={{
        fontFamily: font('body', bold ? 800 : 600),
        fontSize: bold ? 16 : 13,
        color: positive ? tokens.colors.success : tokens.colors.onSurface,
      }}
      >
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  banner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[3],
    padding: space[3] + 2,
    borderRadius: radius.md,
    marginBottom: space[4],
  },
  bannerIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm + 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  bannerTitle: {
    fontFamily: font('body', 700),
    fontSize: 13,
  },
  bannerSub: {
    fontFamily: font('body', 400),
    fontSize: 12,
    marginTop: 1,
  },
  priceCard: {
    borderRadius: radius.lg - 2,
    borderWidth: 1,
    padding: space[4] + 2,
    gap: space[3],
    marginBottom: space[4],
  },
  addressPrompt: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[3],
    padding: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
  },
  addressPromptIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm + 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  addressPromptTitle: {
    fontFamily: font('body', 700),
    fontSize: 13,
    color: '#78350f',
  },
  addressPromptSub: {
    fontFamily: font('body', 400),
    fontSize: 11,
    color: '#92400e',
    marginTop: 2,
  },
  addressCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: space[2] + 2,
    padding: space[3],
    borderRadius: radius.sm + 2,
    borderWidth: 1,
  },
  addressCardLabel: {
    fontFamily: font('body', 700),
    fontSize: 10.5,
    letterSpacing: 0.04 * 10.5,
    textTransform: 'uppercase' as const,
  },
  addressCardValue: {
    fontFamily: font('body', 400),
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  addressCardLandmark: {
    fontFamily: font('body', 400),
    fontSize: 11,
    marginTop: 2,
  },
  addressCardChange: {
    fontFamily: font('body', 700),
    fontSize: 11,
  },
  priceHeadRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  priceHeadLabel: {
    fontFamily: font('body', 700),
    fontSize: 14,
  },
  priceLoadingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  priceDivider: {
    height: 1,
    marginVertical: 2,
  },
  priceTotalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  priceTotalLabel: {
    fontFamily: font('body', 600),
    fontSize: 13,
  },
  couponRow: {
    flexDirection: 'row' as const,
    gap: space[2],
    alignItems: 'stretch' as const,
  },
  couponInputWrap: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: space[3],
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  couponInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: font('body', 500),
    textTransform: 'uppercase' as const,
  },
  summaryCard: {
    borderRadius: radius.lg - 2,
    borderWidth: 1,
    overflow: 'hidden' as const,
    marginBottom: space[5],
  },
  summaryHead: {
    padding: space[3],
  },
  summaryHeadLabel: {
    fontFamily: font('body', 700),
    fontSize: 12,
    letterSpacing: 0.04 * 12,
    textTransform: 'uppercase' as const,
  },
  summaryRow: {
    flexDirection: 'row' as const,
    gap: space[3],
    padding: space[4],
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderLight,
  },
  summaryIcon: {
    marginTop: space[6] + 2,
  },
  summaryLabel: {
    fontFamily: font('body', 700),
    fontSize: 11,
    letterSpacing: 0.06 * 11,
    textTransform: 'uppercase' as const,
    marginBottom: space[1],
  },
  scheduleSection: {
    marginBottom: space[5],
  },
  sectionHeadRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: space[3],
  },
  sectionHeading: {
    fontFamily: font('body', 700),
    fontSize: 14,
  },
  capacityHint: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginLeft: 'auto' as const,
  },
  capacityHintLabel: {
    fontFamily: font('body', 500),
    fontSize: 11,
  },
  busyBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: space[2],
  },
  busyBannerLabel: {
    fontFamily: font('body', 500),
    fontSize: 12,
  },
  slotGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: space[2],
    marginTop: space[2],
  },
  slotCardWrap: {
    width: '48%' as const,
  },
  slotCard: {
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingVertical: space[3],
    paddingHorizontal: space[2],
    borderWidth: 1.5,
    borderRadius: radius.sm,
    backgroundColor: tokens.colors.surfaceContainerLowest,
  },
  slotCardFull: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  slotLabel: {
    fontFamily: font('body', 700),
    fontSize: 13,
  },
  slotRange: {
    fontFamily: font('body', 500),
    fontSize: 11,
  },
  slotTag: {
    fontFamily: font('body', 600),
    fontSize: 10,
    marginTop: 2,
  },
  whatsNext: {
    marginBottom: space[5],
  },
  timelineRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[2],
  },
  timelineDot: {
    width: 5,
    height: 5,
    borderRadius: radius.full,
  },
  timelineLabel: {
    fontFamily: font('body', 400),
    fontSize: 13,
  },
  chargeNote: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[3],
    padding: space[4],
    borderRadius: radius.md,
  },
  chargeNoteLabel: {
    flex: 1,
    fontFamily: font('body', 600),
    fontSize: 13,
  },
});
