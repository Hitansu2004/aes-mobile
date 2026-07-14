import React, {
  forwardRef, useImperativeHandle, useRef, useState,
} from 'react';
import { View } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { AlertTriangle, Check, MapPin } from 'lucide-react-native';

import { Sheet, SheetRef } from '@/components/primitives/Sheet';
import { Text } from '@/components/primitives/Text';
import { Button } from '@/components/primitives/Button';
import { Input, Select } from '@/components/primitives/Input';
import { PressableScale } from '@/components/primitives/PressableScale';
import { ShakeView } from '@/components/primitives/ShakeView';
import { LocationPicker, LocationPickerRef, LocationPickerResult, isPlaceholderAddress } from '@/components/ui/LocationPicker';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { ENERGY_RATINGS } from '@/lib/constants';
import type { AcType, Property } from '@/types/api';

// Ported from ../../aes-frontend/src/app/account/page.js's inline "Add New
// Property" / "Add AC unit" forms — presented as bottom sheets rather than
// inline-expanding cards (RN has no native <select> and this app already
// puts every other form behind a Sheet: LocationPicker, DetailSheets,
// PaymentModal), keeping the same fields, order and validation messages.

export interface AccountSheetRef {
  present: () => void;
  dismiss: () => void;
}

const SNAP = ['85%', '95%'];

// ─── Add Property ──────────────────────────────────────────────────────

export interface AddPropertyData {
  label: string;
  addressLine1: string;
  city: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
  landmark?: string;
  secondaryPhone?: string;
  googlePlaceId?: string;
}

export interface AddPropertySheetProps {
  saving: boolean;
  onSubmit: (data: AddPropertyData) => Promise<void>;
  onWarn: (message: string) => void;
}

export const AddPropertySheet = forwardRef<AccountSheetRef, AddPropertySheetProps>(function AddPropertySheet(
  { saving, onSubmit, onWarn },
  ref,
) {
  const { tokens } = useTheme();
  const sheetRef = useRef<SheetRef>(null);
  const locRef = useRef<LocationPickerRef>(null);

  const [label, setLabel] = useState('');
  const [addr, setAddr] = useState('');
  const [city, setCity] = useState('');
  const [pin, setPin] = useState('');
  const [pinned, setPinned] = useState<LocationPickerResult | null>(null);
  const [shakeKey, setShakeKey] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    present: () => {
      setLabel(''); setAddr(''); setCity(''); setPin(''); setPinned(null); setShakeKey(null);
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }), []);

  const fail = (message: string) => {
    onWarn(message);
    setShakeKey(`${message}-${Date.now()}`);
  };

  const submit = async () => {
    if (!label.trim()) { fail('Property label is required.'); return; }
    if (!addr.trim()) { fail('Address is required.'); return; }
    if (pin && !/^\d{6}$/.test(pin)) { fail('PIN code must be 6 digits.'); return; }
    await onSubmit({
      label: label.trim(),
      addressLine1: addr.trim(),
      city: city.trim() || 'Hyderabad',
      pincode: pin.trim() || undefined,
      latitude: pinned?.lat,
      longitude: pinned?.lng,
      formattedAddress: pinned?.formattedAddress,
      landmark: pinned?.landmark || undefined,
      secondaryPhone: pinned?.secondaryPhone || undefined,
      googlePlaceId: pinned?.googlePlaceId || undefined,
    });
  };

  const hasPin = pinned && !isPlaceholderAddress({ latitude: pinned.lat, longitude: pinned.lng, formattedAddress: pinned.formattedAddress });

  return (
    <>
      <Sheet ref={sheetRef} snapPoints={SNAP} title="Add New Property">
        <BottomSheetScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
          <ShakeView shakeKey={shakeKey} style={{ gap: space[4] }}>
            <Input label="Property Label*" placeholder="e.g., Villa #42" value={label} onChangeText={setLabel} />
            <Input label="Address*" placeholder="e.g., Plot 42, Road No. 10, Jubilee Hills" value={addr} onChangeText={setAddr} />
            <View style={{ flexDirection: 'row', gap: space[3] }}>
              <View style={{ flex: 1 }}>
                <Input label="City" placeholder="Hyderabad" value={city} onChangeText={setCity} />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="PIN code" placeholder="500034" maxLength={6} keyboardType="number-pad" value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, ''))} />
              </View>
            </View>

            <PressableScale
              onPress={() => locRef.current?.present()}
              style={{
                flexDirection: 'row',
                alignItems: hasPin ? 'flex-start' : 'center',
                gap: 10,
                padding: space[3],
                borderRadius: radius.sm + 2,
                backgroundColor: hasPin ? tokens.colors.successLight : tokens.colors.surfaceContainerLow,
                borderWidth: 1,
                borderStyle: hasPin ? 'solid' : 'dashed',
                borderColor: hasPin ? tokens.colors.success : tokens.colors.borderLight,
              }}
            >
              {hasPin ? (
                <Check size={16} color={tokens.colors.success} style={{ marginTop: 2 }} />
              ) : (
                <MapPin size={16} color={tokens.colors.secondaryInk} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontFamily: font('body', 700), fontSize: 11, letterSpacing: 0.03 * 11, textTransform: 'uppercase',
                }}
                color={hasPin ? 'success' : 'onSurface'}
                >
                  {hasPin ? 'Pinned on map · tap to change' : 'Pin on map (recommended)'}
                </Text>
                <Text variant="bodySm" color="onSurfaceVariant" style={{ marginTop: 2 }}>
                  {hasPin ? pinned!.formattedAddress : "We'll use this for accurate distance pricing & engineer routing."}
                </Text>
              </View>
            </PressableScale>
          </ShakeView>

          <Button variant="primary" size="lg" fullWidth loading={saving} onPress={submit}>
            Add Property
          </Button>
        </BottomSheetScrollView>
      </Sheet>

      <LocationPicker
        ref={locRef}
        initial={pinned ? {
          lat: pinned.lat, lng: pinned.lng, formattedAddress: pinned.formattedAddress, landmark: pinned.landmark, secondaryPhone: pinned.secondaryPhone,
        } : undefined}
        onSave={(loc) => {
          setPinned(loc);
          setAddr(loc.formattedAddress);
          if (loc.city) setCity(loc.city);
          if (loc.pincode) setPin(loc.pincode);
          locRef.current?.dismiss();
        }}
      />
    </>
  );
});

// ─── Add AC unit ────────────────────────────────────────────────────────

const AC_TYPE_OPTIONS = [
  { label: 'Split', value: 'SPLIT' },
  { label: 'Window', value: 'WINDOW' },
  { label: 'Cassette', value: 'CASSETTE' },
  { label: 'Central', value: 'CENTRAL' },
  { label: 'VRF / VRV', value: 'VRF_VRV' },
];

export interface AddAcUnitData {
  roomLabel: string;
  acType: AcType;
  brand: string;
  modelNumber?: string;
  tonnage: number;
  energyStarRating?: number;
}

export interface AddAcUnitSheetProps {
  saving: boolean;
  onSubmit: (data: AddAcUnitData) => Promise<void>;
  onWarn: (message: string) => void;
}

export interface AddAcUnitSheetHandle extends AccountSheetRef {
  presentFor: (property: Property) => void;
}

export const AddAcUnitSheet = forwardRef<AddAcUnitSheetHandle, AddAcUnitSheetProps>(function AddAcUnitSheet(
  { saving, onSubmit, onWarn },
  ref,
) {
  const sheetRef = useRef<SheetRef>(null);
  const [propertyLabel, setPropertyLabel] = useState('');
  const [room, setRoom] = useState('');
  const [acType, setAcType] = useState<AcType>('SPLIT');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [ton, setTon] = useState('1.5');
  const [star, setStar] = useState(3);
  const [shakeKey, setShakeKey] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
    presentFor: (property: Property) => {
      setPropertyLabel(property.label);
      setRoom(''); setAcType('SPLIT'); setBrand(''); setModel(''); setTon('1.5'); setStar(3); setShakeKey(null);
      sheetRef.current?.present();
    },
  }), []);

  const fail = (message: string) => {
    onWarn(message);
    setShakeKey(`${message}-${Date.now()}`);
  };

  const submit = async () => {
    if (!room.trim()) { fail('Room label is required.'); return; }
    if (!brand.trim()) { fail('Brand is required.'); return; }
    const tonNum = Number(ton);
    if (!Number.isFinite(tonNum) || tonNum < 0.5 || tonNum > 20) { fail('Tonnage must be between 0.5 and 20.'); return; }
    await onSubmit({
      roomLabel: room.trim(),
      acType,
      brand: brand.trim(),
      modelNumber: model.trim() || undefined,
      tonnage: tonNum,
      energyStarRating: star || undefined,
    });
  };

  return (
    <Sheet ref={sheetRef} snapPoints={SNAP} title={propertyLabel ? `Add AC unit to ${propertyLabel}` : 'Add AC unit'}>
      <BottomSheetScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
        <ShakeView shakeKey={shakeKey} style={{ gap: space[4] }}>
          <Input label="Room label*" placeholder="Living Room" value={room} onChangeText={setRoom} />
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            <View style={{ flex: 1 }}>
              <Select label="AC type" options={AC_TYPE_OPTIONS} value={acType} onChange={(v) => setAcType(v as AcType)} />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Tonnage*" placeholder="1.5" keyboardType="decimal-pad" value={ton} onChangeText={setTon} />
            </View>
          </View>
          <Input label="Brand*" placeholder="Daikin / LG / Voltas…" value={brand} onChangeText={setBrand} />
          <Input label="Model number" placeholder="FTKM50UV (optional)" value={model} onChangeText={setModel} />
          <Select
            label="Energy rating"
            options={ENERGY_RATINGS.map((r) => ({ label: r.label, value: String(r.value) }))}
            value={String(star)}
            onChange={(v) => setStar(Number(v))}
          />
        </ShakeView>
        <Button variant="primary" size="lg" fullWidth loading={saving} onPress={submit}>
          Add AC unit
        </Button>
      </BottomSheetScrollView>
    </Sheet>
  );
});

// ─── Generic destructive confirm ────────────────────────────────────────

export interface ConfirmSheetProps {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}

export const ConfirmSheet = forwardRef<AccountSheetRef, ConfirmSheetProps>(function ConfirmSheet(
  {
    title, body, confirmLabel, onConfirm,
  },
  ref,
) {
  const { tokens } = useTheme();
  const sheetRef = useRef<SheetRef>(null);
  const [busy, setBusy] = useState(false);

  useImperativeHandle(ref, () => ({
    present: () => { setBusy(false); sheetRef.current?.present(); },
    dismiss: () => sheetRef.current?.dismiss(),
  }), []);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet ref={sheetRef} snapPoints={['40%']}>
      <View style={{ padding: space[5], gap: space[4], alignItems: 'center' }}>
        <View
          style={{
            width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.errorContainer,
          }}
        >
          <AlertTriangle size={26} color={tokens.colors.error} />
        </View>
        <Text variant="headlineSm" align="center">{title}</Text>
        <Text variant="bodyMd" color="onSurfaceVariant" align="center">{body}</Text>
        <View style={{ width: '100%', gap: space[2] }}>
          <Button variant="danger" size="lg" fullWidth loading={busy} onPress={confirm}>
            {confirmLabel}
          </Button>
          <Button variant="ghost" size="lg" fullWidth onPress={() => sheetRef.current?.dismiss()}>
            Cancel
          </Button>
        </View>
      </View>
    </Sheet>
  );
});
