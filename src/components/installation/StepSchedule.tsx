import React from 'react';
import { View } from 'react-native';
import { MotiView } from 'moti';
import {
  CalendarDays, Check, CloudSun, Lightbulb, Moon, Pencil, Sun, Clock, LucideIcon,
} from 'lucide-react-native';

import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives/Text';
import { PressableScale } from '@/components/primitives/PressableScale';
import { DayPicker } from '@/components/ui/DayPicker';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useHaptics } from '@/hooks/useHaptics';
import { TIME_SLOTS, slotLabel, acTypeLabel } from '@/lib/constants';
import { BUILDING_TYPES } from '@/lib/aesCatalog';
import type { InstallState } from '@/store/installationStore';
import type { Property } from '@/types/api';
import { WizardHeading, SectionLabel } from './shared';

// Step 5 — Schedule + Summary. Ported from installation/page.js's `Step4` +
// its .infoBanner/.slotList/.summaryCard classes.
const SLOT_ICONS: Record<string, LucideIcon> = {
  EARLY: Clock, MORNING: Sun, AFTERNOON: CloudSun, EVENING: Moon,
};

export interface StepScheduleProps {
  state: InstallState;
  set: (patch: Partial<InstallState>) => void;
  propertyList: Property[];
  onEdit: (step: number) => void;
}

export function StepSchedule({
  state, set, propertyList, onEdit,
}: StepScheduleProps) {
  const styles = useThemedStyles(makeStyles);
  const { tokens } = useTheme();
  const haptics = useHaptics();

  const property = propertyList.find((p) => p.id === state.propertyId);
  const equipment = [
    state.brand,
    state.tonnage ? `${state.tonnage}T` : null,
    acTypeLabel(state.acType),
    state.modelNumber,
  ].filter(Boolean).join(' · ');
  const spaceLabel = BUILDING_TYPES.find((b) => b.value === state.buildingType)?.label || 'Not specified';

  const scheduledLabel = state.scheduledDate
    ? new Date(state.scheduledDate).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })
    : 'Pick a date';

  const locationLabel = property
    ? `${state.rooms.length} room${state.rooms.length === 1 ? '' : 's'} @ ${property.label}`
    : state.propertyAddress
      ? `${state.rooms.length} room${state.rooms.length === 1 ? '' : 's'} @ new address`
      : 'No address selected';

  return (
    <View>
      <WizardHeading title="When should we visit?" sub="Free site visit. We'll provide a detailed quote within 24 hours." />

      <View style={[styles.infoBanner, { backgroundColor: tokens.colors.infoLight }]}>
        <CalendarDays size={16} color={tokens.colors.secondaryInk} />
        <Text style={[styles.infoBannerLabel, { color: tokens.colors.secondaryInk }]}>
          Today is unavailable — earliest slot is tomorrow.
        </Text>
      </View>

      <SectionLabel>Pick a day</SectionLabel>
      <DayPicker value={state.scheduledDate} onChange={(d) => set({ scheduledDate: d })} />

      <SectionLabel>Time slot</SectionLabel>
      <View style={{ gap: space[2] + 2 }}>
        {TIME_SLOTS.map(({ value, label, range }, i) => {
          const Icon = SLOT_ICONS[value] || Sun;
          const selected = state.scheduledSlot === value;
          return (
            <MotiView
              key={value}
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 220, delay: Math.min(i, 9) * 40 }}
            >
              <PressableScale
                scaleTo={0.98}
                onPress={() => { haptics.selection(); set({ scheduledSlot: value }); }}
                style={[
                  styles.slotCard,
                  { borderColor: selected ? tokens.colors.secondary : tokens.colors.borderLight },
                  selected && { backgroundColor: tokens.colors.secondarySoft, ...shadow('sm') },
                ]}
              >
                <View style={[styles.slotIcon, { backgroundColor: selected ? tokens.colors.secondary : tokens.colors.surfaceContainer }]}>
                  <Icon size={20} color={selected ? tokens.colors.onSecondary : tokens.colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.slotLabel} color="onSurface">{label}</Text>
                  <Text style={styles.slotRange} color="onSurfaceVariant">{range}</Text>
                </View>
                {selected && (
                  <View style={[styles.slotCheck, { backgroundColor: tokens.colors.secondary }]}>
                    <Check size={14} strokeWidth={3} color={tokens.colors.onSecondary} />
                  </View>
                )}
              </PressableScale>
            </MotiView>
          );
        })}
      </View>

      <View style={[styles.summaryCard, { borderColor: tokens.colors.borderLight }]}>
        <View style={[styles.summaryHeader, { backgroundColor: tokens.colors.surfaceContainerLow }]}>
          <Lightbulb size={16} color={tokens.colors.primaryDark} />
          <Text style={[styles.summaryHeaderLabel, { color: tokens.colors.primaryDark }]}>Installation Summary</Text>
        </View>
        <SummaryRow label="Space" value={spaceLabel} onEdit={() => onEdit(1)} isFirst />
        <SummaryRow label="Equipment" value={equipment || 'Not specified'} onEdit={() => onEdit(3)} />
        <SummaryRow label="Location" value={locationLabel} onEdit={() => onEdit(4)} />
        <SummaryRow label="Scheduled visit" value={`${scheduledLabel} · ${slotLabel(state.scheduledSlot)}`} hideEdit />
      </View>
    </View>
  );
}

function SummaryRow({
  label, value, onEdit, hideEdit = false, isFirst = false,
}: { label: string; value: string; onEdit?: () => void; hideEdit?: boolean; isFirst?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const { tokens } = useTheme();
  return (
    <View style={[styles.summaryRow, { borderTopWidth: isFirst ? 0 : 1, borderTopColor: tokens.colors.borderLight }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.summaryLabel} color="onSurfaceVariant">{label}</Text>
        <Text style={styles.summaryValue} color="onSurface">{value}</Text>
      </View>
      {!hideEdit && onEdit && (
        <PressableScale onPress={onEdit} style={[styles.editBtn, { backgroundColor: tokens.colors.surfaceContainer }]} accessibilityLabel={`Edit ${label}`}>
          <Pencil size={14} color={tokens.colors.primaryDark} />
        </PressableScale>
      )}
    </View>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  infoBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[3],
    padding: space[3] + 2,
    borderRadius: radius.md,
    marginBottom: space[2],
  },
  infoBannerLabel: {
    flex: 1,
    fontFamily: font('body', 500),
    fontSize: 13,
  },
  slotCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[3],
    padding: space[4],
    borderWidth: 1.5,
    borderRadius: radius.lg - 2,
    backgroundColor: tokens.colors.surfaceContainerLowest,
  },
  slotIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  slotLabel: {
    fontFamily: font('body', 700),
    fontSize: 14,
  },
  slotRange: {
    fontFamily: font('body', 400),
    fontSize: 12,
    marginTop: 2,
  },
  slotCheck: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  summaryCard: {
    marginTop: space[5],
    borderWidth: 1,
    borderRadius: radius.lg - 2,
    overflow: 'hidden' as const,
    backgroundColor: tokens.colors.surfaceContainerLowest,
  },
  summaryHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[2],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
  },
  summaryHeaderLabel: {
    fontFamily: font('body', 700),
    fontSize: 13,
    letterSpacing: 0.04 * 13,
    textTransform: 'uppercase' as const,
  },
  summaryRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    gap: space[3],
    padding: space[4],
  },
  summaryLabel: {
    fontFamily: font('body', 700),
    fontSize: 11,
    letterSpacing: 0.10 * 11,
    textTransform: 'uppercase' as const,
  },
  summaryValue: {
    fontFamily: font('body', 600),
    fontSize: 14,
    marginTop: 2,
    lineHeight: 19,
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});
