import React, {
  forwardRef, useImperativeHandle, useRef, useState,
} from 'react';
import { TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import {
  Check, ChevronDown, MapPin, Plus, Snowflake, LucideIcon,
} from 'lucide-react-native';

import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives/Text';
import { PressableScale } from '@/components/primitives/PressableScale';
import { Button } from '@/components/primitives/Button';
import { EmptyState } from '@/components/primitives/EmptyState';
import { Skeleton } from '@/components/primitives/Skeleton';
import { Sheet, SheetRef } from '@/components/primitives/Sheet';
import { ShakeView } from '@/components/primitives/ShakeView';
import { Select } from '@/components/primitives/Input';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/context/ToastContext';
import { AC_TYPES, acTypeLabel } from '@/lib/constants';
import type { AcUnit, Property } from '@/types/api';
import { WizardHeading, acStatusTone } from './shared';

// Step 2 — select an AC unit. Ported from ../../aes-frontend/src/app/
// services/ticket/page.js's Step2SelectAc + PropertySheet + AddAcUnitSheet.
export interface SelectableAcUnit extends AcUnit {
  propertyLabel?: string;
}

export interface StepSelectAcProps {
  loading: boolean;
  properties: Property[];
  activeProperty: Property | null;
  acUnits: SelectableAcUnit[];
  onPickProperty: (id: string) => void;
  onAddAcUnit: (args: { propertyId: string; payload: Record<string, unknown>; autoSelect: boolean }) => Promise<boolean>;
  selectedId: string;
  onSelect: (unit: SelectableAcUnit) => void;
}

export function StepSelectAc({
  loading, properties, activeProperty, acUnits, onPickProperty, onAddAcUnit, selectedId, onSelect,
}: StepSelectAcProps) {
  const styles = useThemedStyles(makeStyles);
  const { tokens } = useTheme();
  const haptics = useHaptics();
  const router = useRouter();
  const propertySheetRef = useRef<SheetRef>(null);
  const addAcSheetRef = useRef<AddAcUnitSheetRef>(null);

  if (loading) {
    return (
      <View>
        <WizardHeading title="Which AC needs service?" sub="Pick the unit from your saved properties." />
        <View style={{ gap: space[3] }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={96} radius={radius.lg - 2} />)}
        </View>
      </View>
    );
  }

  if (properties.length === 0) {
    return (
      <View>
        <EmptyState
          icon={<Snowflake size={28} color={tokens.colors.secondaryInk} />}
          headline="No properties yet"
          body="You need a property and at least one AC unit before raising a service ticket. It takes 30 seconds."
          ctaLabel="Add a property"
          onCtaPress={() => router.push('/account?tab=properties&new=1')}
        />
        <Button variant="ghost" fullWidth onPress={() => router.push('/dashboard')}>Back to Home</Button>
      </View>
    );
  }

  const noAcUnits = properties.every((p) => (p.acUnits?.length ?? 0) === 0);
  if (noAcUnits) {
    return (
      <>
        <EmptyState
          icon={<Snowflake size={28} color={tokens.colors.secondaryInk} />}
          headline="No AC units yet"
          body={`Add an AC unit to ${properties.length === 1 ? `"${properties[0].label}"` : 'one of your properties'} so we know what needs servicing. It takes 20 seconds and we'll select it for you automatically.`}
          ctaLabel="Add AC unit"
          onCtaPress={() => addAcSheetRef.current?.present()}
        />
        <Button variant="ghost" fullWidth onPress={() => router.push('/account?tab=properties')}>Manage in account</Button>
        <AddAcUnitSheet
          ref={addAcSheetRef}
          properties={properties}
          defaultPropertyId={activeProperty?.id || properties[0]?.id}
          onSubmit={async (payload) => onAddAcUnit({ propertyId: payload.propertyId, payload: payload.unit, autoSelect: true })}
        />
      </>
    );
  }

  return (
    <View>
      <View style={styles.headingTight}>
        <PressableScale
          onPress={() => { if (properties.length > 1) { haptics.selection(); propertySheetRef.current?.present(); } }}
          style={[styles.propertyTrigger, { backgroundColor: tokens.colors.surfaceContainer }]}
        >
          <MapPin size={14} color={tokens.colors.secondaryInk} />
          <Text style={styles.propertyTriggerLabel} color="secondaryInk" numberOfLines={1}>
            {activeProperty?.label || 'Pick a property'}
          </Text>
          {properties.length > 1 && <ChevronDown size={14} color={tokens.colors.secondaryInk} />}
        </PressableScale>
        <WizardHeading title="Which AC needs service?" sub="Tap a unit to continue." />
      </View>

      {acUnits.length === 0 ? (
        <View style={styles.emptyOnProperty}>
          <Text variant="headlineSm" align="center">No AC units on this property</Text>
          <Text variant="bodyMd" color="onSurfaceVariant" align="center">Add an AC unit on this property to raise a service ticket.</Text>
        </View>
      ) : (
        <View style={{ gap: space[3] }}>
          {acUnits.map((u, i) => {
            const tone = acStatusTone(u.serviceStatus);
            const selected = selectedId === u.id;
            return (
              <MotiView
                key={u.id}
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 220, delay: i * 40 }}
              >
                <PressableScale
                  scaleTo={0.99}
                  onPress={() => { haptics.selection(); onSelect(u); }}
                  style={[
                    styles.acCard,
                    { borderColor: selected ? tokens.colors.secondary : tokens.colors.borderLight },
                    selected && { backgroundColor: tokens.colors.secondarySoft },
                  ]}
                >
                  <View style={[styles.acIcon, { backgroundColor: tone.bg }]}>
                    <Snowflake size={26} color={tone.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.acTopRow}>
                      <Text style={styles.acRoom} color="onSurfaceStrong" numberOfLines={1}>{u.roomLabel}</Text>
                      <View style={[styles.acPill, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.acPillLabel, { color: tone.fg }]}>{tone.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.acMeta} color="onSurfaceVariant">{`${u.brand || ''} ${u.modelNumber || ''}`.trim()}</Text>
                    <Text style={styles.acMetaSub} color="onSurfaceVariant">
                      {`${acTypeLabel(u.acType)} · ${Number(u.tonnage || 0).toFixed(1)} Ton`}
                    </Text>
                    <View style={styles.acCtaRow}>
                      {selected ? (
                        <>
                          <Check size={13} strokeWidth={3} color={tokens.colors.secondaryInk} />
                          <Text style={styles.acCtaLabel} color="secondaryInk">Selected</Text>
                        </>
                      ) : (
                        <Text style={styles.acCtaLabel} color="onSurfaceVariant">Select for service →</Text>
                      )}
                    </View>
                  </View>
                </PressableScale>
              </MotiView>
            );
          })}
        </View>
      )}

      <View style={{ marginTop: space[4] }}>
        <Button
          variant="outline"
          fullWidth
          leftIcon={<Plus size={16} color={tokens.colors.primary} />}
          onPress={() => addAcSheetRef.current?.present()}
        >
          Add a new AC unit
        </Button>
      </View>

      <Sheet ref={propertySheetRef} title="Choose a property">
        <View style={{ paddingHorizontal: space[5], paddingBottom: space[8], gap: space[2] }}>
          {properties.map((p) => {
            const active = p.id === activeProperty?.id;
            return (
              <PressableScale
                key={p.id}
                onPress={() => { haptics.selection(); onPickProperty(p.id); propertySheetRef.current?.dismiss(); }}
                style={[
                  styles.sheetItem,
                  { backgroundColor: active ? tokens.colors.secondarySoft : tokens.colors.surfaceContainerLow },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetItemLabel} color="onSurface">{p.label}</Text>
                  <Text style={styles.sheetItemSub} color="onSurfaceVariant">
                    {[p.addressLine1, p.city].filter(Boolean).join(', ')}
                  </Text>
                </View>
                {active && <Check size={18} color={tokens.colors.secondaryInk} />}
              </PressableScale>
            );
          })}
        </View>
      </Sheet>

      <AddAcUnitSheet
        ref={addAcSheetRef}
        properties={properties}
        defaultPropertyId={activeProperty?.id || properties[0]?.id}
        onSubmit={async (payload) => onAddAcUnit({ propertyId: payload.propertyId, payload: payload.unit, autoSelect: true })}
      />
    </View>
  );
}

// ─── Add AC unit sheet ───────────────────────────────────────────────────

interface AddAcUnitSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface AddAcUnitPayload {
  propertyId: string;
  unit: {
    roomLabel: string;
    acType: string;
    brand: string;
    modelNumber?: string;
    tonnage: number;
    energyStarRating?: number;
  };
}

const AddAcUnitSheet = forwardRef<AddAcUnitSheetRef, {
  properties: Property[];
  defaultPropertyId?: string;
  onSubmit: (payload: AddAcUnitPayload) => Promise<boolean>;
}>(function AddAcUnitSheet({ properties, defaultPropertyId, onSubmit }, ref) {
  const styles = useThemedStyles(makeStyles);
  const { tokens } = useTheme();
  const toast = useToast();
  const sheetRef = useRef<SheetRef>(null);

  const [propertyId, setPropertyId] = useState(defaultPropertyId || properties[0]?.id || '');
  const [roomLabel, setRoomLabel] = useState('');
  const [acType, setAcType] = useState('SPLIT');
  const [brand, setBrand] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [tonnage, setTonnage] = useState('1.5');
  const [starRating, setStarRating] = useState('3');
  const [saving, setSaving] = useState(false);
  const [shakeKey, setShakeKey] = useState<number | null>(null);

  useImperativeHandle(ref, () => ({
    present: () => {
      setPropertyId(defaultPropertyId || properties[0]?.id || '');
      setRoomLabel(''); setAcType('SPLIT'); setBrand(''); setModelNumber('');
      setTonnage('1.5'); setStarRating('3');
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }), [defaultPropertyId, properties]);

  const submit = async () => {
    if (!propertyId) { toast.warning('Pick a property.'); setShakeKey((k) => (k ?? 0) + 1); return; }
    if (!roomLabel.trim()) { toast.warning('Room label is required.'); setShakeKey((k) => (k ?? 0) + 1); return; }
    if (!brand.trim()) { toast.warning('Brand is required.'); setShakeKey((k) => (k ?? 0) + 1); return; }
    const tonNum = Number(tonnage);
    if (!Number.isFinite(tonNum) || tonNum < 0.5 || tonNum > 20) {
      toast.warning('Tonnage must be between 0.5 and 20.'); setShakeKey((k) => (k ?? 0) + 1); return;
    }
    setSaving(true);
    try {
      const ok = await onSubmit({
        propertyId,
        unit: {
          roomLabel: roomLabel.trim(),
          acType,
          brand: brand.trim(),
          modelNumber: modelNumber.trim() || undefined,
          tonnage: tonNum,
          energyStarRating: Number(starRating) || undefined,
        },
      });
      if (ok) sheetRef.current?.dismiss();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet ref={sheetRef} title="Add AC unit" snapPoints={['92%']}>
      <ShakeView shakeKey={shakeKey} style={{ paddingHorizontal: space[5], paddingBottom: space[8], gap: space[3] }}>
        <Text variant="bodySm" color="onSurfaceVariant">
          We&apos;ll add this unit to your property and pre-select it for this service request.
        </Text>

        {properties.length > 1 ? (
          <Select
            label="Property"
            options={properties.map((p) => ({ label: p.label, value: p.id }))}
            value={propertyId}
            onChange={setPropertyId}
          />
        ) : null}

        <LabeledInput label="Room label*" placeholder="Living Room / Master Bedroom" value={roomLabel} onChangeText={setRoomLabel} tokens={tokens} />

        <Select
          label="AC type"
          options={AC_TYPES.map((t) => ({ label: t.label, value: t.value }))}
          value={acType}
          onChange={setAcType}
        />

        <LabeledInput
          label="Tonnage*"
          placeholder="1.5"
          value={tonnage}
          onChangeText={(t) => setTonnage(t.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          tokens={tokens}
        />

        <LabeledInput label="Brand*" placeholder="Daikin / LG / Voltas / Blue Star…" value={brand} onChangeText={setBrand} tokens={tokens} />
        <LabeledInput label="Model number" placeholder="FTKM50UV (optional)" value={modelNumber} onChangeText={setModelNumber} tokens={tokens} />

        <Select
          label="Energy star rating"
          options={[1, 2, 3, 4, 5].map((n) => ({ label: `${n} star`, value: String(n) }))}
          value={starRating}
          onChange={setStarRating}
        />

        <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[2] }}>
          <View style={{ flex: 1 }}>
            <Button variant="ghost" fullWidth disabled={saving} onPress={() => sheetRef.current?.dismiss()}>Cancel</Button>
          </View>
          <View style={{ flex: 2 }}>
            <Button variant="primary" fullWidth loading={saving} onPress={submit}>Add &amp; continue</Button>
          </View>
        </View>
      </ShakeView>
    </Sheet>
  );
});

function LabeledInput({
  label, placeholder, value, onChangeText, keyboardType, tokens,
}: {
  label: string; placeholder: string; value: string; onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'decimal-pad'; tokens: ReturnType<typeof useTheme>['tokens'];
}) {
  return (
    <View style={{ gap: space[2] }}>
      <Text
        style={{
          fontFamily: font('body', 600), fontSize: 12, letterSpacing: 0.06 * 12, textTransform: 'uppercase',
        }}
        color="onSurfaceVariant"
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.colors.outline}
        keyboardType={keyboardType}
        style={{
          height: 52,
          paddingHorizontal: space[4],
          backgroundColor: tokens.colors.surfaceContainerLow,
          borderWidth: 1.5,
          borderColor: 'transparent',
          borderRadius: radius.sm,
          fontFamily: font('body', 400),
          fontSize: 15,
          color: tokens.colors.onSurface,
        }}
      />
    </View>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  headingTight: {
    gap: space[2],
    marginBottom: space[3],
  },
  propertyTrigger: {
    flexDirection: 'row' as const,
    alignSelf: 'flex-start' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
  },
  propertyTriggerLabel: {
    fontFamily: font('body', 700),
    fontSize: 12,
    maxWidth: 220,
  },
  emptyOnProperty: {
    alignItems: 'center' as const,
    gap: space[2],
    paddingVertical: space[8],
  },
  acCard: {
    flexDirection: 'row' as const,
    gap: space[3],
    padding: space[3] + 2,
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: tokens.colors.surfaceContainerLowest,
  },
  acIcon: {
    width: 84,
    height: 84,
    borderRadius: radius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  acTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: space[2],
  },
  acRoom: {
    flex: 1,
    fontFamily: font('body', 700),
    fontSize: 15,
  },
  acPill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.full,
  },
  acPillLabel: {
    fontFamily: font('body', 700),
    fontSize: 10,
    letterSpacing: 0.04 * 10,
    textTransform: 'uppercase' as const,
  },
  acMeta: {
    fontFamily: font('body', 500),
    fontSize: 13,
    marginTop: 3,
  },
  acMetaSub: {
    fontFamily: font('body', 400),
    fontSize: 12,
    marginTop: 1,
  },
  acCtaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: space[2],
  },
  acCtaLabel: {
    fontFamily: font('body', 700),
    fontSize: 12,
  },
  sheetItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[3],
    padding: space[4],
    borderRadius: radius.md,
  },
  sheetItemLabel: {
    fontFamily: font('body', 700),
    fontSize: 14,
  },
  sheetItemSub: {
    fontFamily: font('body', 400),
    fontSize: 12,
    marginTop: 2,
  },
});
