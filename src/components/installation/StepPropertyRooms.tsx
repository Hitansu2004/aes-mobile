import React, { useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MotiView } from 'moti';
import { Building2, Home, MapPin, Plus, X } from 'lucide-react-native';

import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives/Text';
import { PressableScale } from '@/components/primitives/PressableScale';
import { TextArea, NumberInput, Select } from '@/components/primitives/Input';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useHaptics } from '@/hooks/useHaptics';
import { AC_TYPES, ROOM_TYPES } from '@/lib/constants';
import type { Property } from '@/types/api';
import type { InstallRoom } from '@/store/installationStore';
import { WizardHeading, SectionLabel } from './shared';

// Step 4 — Property & Rooms. Ported from installation/page.js's `Step3` +
// its .segment/.propertyList/.roomCard classes. Every web `<select>` here
// becomes a <Select> (opens a SelectSheet — RN has no native <select>).
export interface StepPropertyRoomsProps {
  propertyId: string | null;
  propertyAddress: string;
  rooms: InstallRoom[];
  notes: string;
  acType: string;
  propertyList: Property[];
  showAddAddress: boolean;
  setShowAddAddress: (v: boolean) => void;
  set: (patch: { propertyId?: string | null; propertyAddress?: string; notes?: string }) => void;
  addRoom: (acType?: string) => void;
  updateRoom: (index: number, patch: Partial<InstallRoom>) => void;
  removeRoom: (index: number) => void;
}

const ROOM_TYPE_OPTIONS = ROOM_TYPES.map((r) => ({ label: r, value: r }));
const AC_TYPE_OPTIONS = AC_TYPES.map((t) => ({ label: t.label, value: t.value }));

export function StepPropertyRooms({
  propertyId, propertyAddress, rooms, notes, acType,
  propertyList, showAddAddress, setShowAddAddress, set,
  addRoom, updateRoom, removeRoom,
}: StepPropertyRoomsProps) {
  const styles = useThemedStyles(makeStyles);
  const { tokens } = useTheme();
  const { isPhone } = useBreakpoint();
  const haptics = useHaptics();
  const [propertyType, setPropertyType] = useState<'RESIDENTIAL' | 'COMMERCIAL'>('RESIDENTIAL');

  const indicator = useSharedValue(propertyType === 'COMMERCIAL' ? 1 : 0);
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${indicator.value * 100}%` }],
  }));

  const selectSegment = (next: 'RESIDENTIAL' | 'COMMERCIAL') => {
    haptics.selection();
    setPropertyType(next);
    indicator.value = withTiming(next === 'COMMERCIAL' ? 1 : 0, { duration: 220 });
  };

  const showAddressInput = showAddAddress || (propertyList.length === 0 && !propertyId);

  return (
    <View>
      <WizardHeading
        title="Where do you need installation?"
        sub="Pick from your saved properties or add a new address."
      />

      <View style={[styles.segment, { backgroundColor: tokens.colors.surfaceContainer }]}>
        <Animated.View
          style={[
            styles.segmentIndicator,
            { backgroundColor: tokens.colors.surfaceContainerLowest },
            indicatorStyle,
          ]}
        />
        <PressableScale style={styles.segmentButton} onPress={() => selectSegment('RESIDENTIAL')}>
          <Home size={14} color={propertyType === 'RESIDENTIAL' ? tokens.colors.primaryDark : tokens.colors.onSurfaceVariant} />
          <Text style={[styles.segmentLabel, { color: propertyType === 'RESIDENTIAL' ? tokens.colors.primaryDark : tokens.colors.onSurfaceVariant }]}>
            Residential
          </Text>
        </PressableScale>
        <PressableScale style={styles.segmentButton} onPress={() => selectSegment('COMMERCIAL')}>
          <Building2 size={14} color={propertyType === 'COMMERCIAL' ? tokens.colors.primaryDark : tokens.colors.onSurfaceVariant} />
          <Text style={[styles.segmentLabel, { color: propertyType === 'COMMERCIAL' ? tokens.colors.primaryDark : tokens.colors.onSurfaceVariant }]}>
            Commercial / Office
          </Text>
        </PressableScale>
      </View>

      <SectionLabel>Installation Address</SectionLabel>
      {propertyList.length > 0 ? (
        <View style={{ gap: space[2] + 2 }}>
          {propertyList.map((p, i) => {
            const selected = propertyId === p.id && !showAddAddress;
            return (
              <MotiView
                key={p.id}
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 220, delay: Math.min(i, 9) * 40 }}
              >
                <PressableScale
                  scaleTo={0.98}
                  onPress={() => { haptics.selection(); set({ propertyId: p.id, propertyAddress: '' }); setShowAddAddress(false); }}
                  style={[
                    styles.propertyCard,
                    { borderColor: selected ? tokens.colors.secondary : tokens.colors.borderLight },
                    selected && { backgroundColor: tokens.colors.secondarySoft },
                  ]}
                >
                  <View style={[styles.propertyIcon, { backgroundColor: tokens.colors.secondary }]}>
                    <MapPin size={18} color={tokens.colors.onSecondary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.propertyLabel} color="onSurface">{p.label}</Text>
                    <Text style={styles.propertyAddr} color="onSurfaceVariant">
                      {[p.addressLine1, p.city].filter(Boolean).join(', ')}
                    </Text>
                    {p.isPrimary && (
                      <View style={[styles.primaryTag, { backgroundColor: tokens.colors.secondary }]}>
                        <Text style={[styles.primaryTagLabel, { color: tokens.colors.onSecondary }]}>Primary</Text>
                      </View>
                    )}
                  </View>
                  {selected && (
                    <View style={[styles.propertyCheck, { backgroundColor: tokens.colors.secondary }]}>
                      <Text style={{ color: tokens.colors.onSecondary, fontFamily: font('body', 700) }}>✓</Text>
                    </View>
                  )}
                </PressableScale>
              </MotiView>
            );
          })}
        </View>
      ) : (
        <Text style={styles.muted} color="onSurfaceVariant">
          You have no saved properties — add a new address below.
        </Text>
      )}

      <PressableScale
        onPress={() => {
          haptics.selection();
          const next = !showAddAddress;
          setShowAddAddress(next);
          if (next) set({ propertyId: null });
          else set({ propertyAddress: '' });
        }}
        style={styles.linkButton}
      >
        <Plus size={14} color={tokens.colors.secondaryInk} />
        <Text style={[styles.linkButtonLabel, { color: tokens.colors.secondaryInk }]}>
          {showAddAddress ? 'Cancel' : 'Add new address'}
        </Text>
      </PressableScale>

      {showAddressInput && (
        <TextArea
          label="Address"
          placeholder="House / flat number, road, locality, city, PIN"
          value={propertyAddress}
          onChangeText={(v) => set({ propertyAddress: v })}
          maxLength={500}
        />
      )}

      <SectionLabel right={(
        <Text style={styles.muted} color="onSurfaceVariant">
          {rooms.length} room{rooms.length === 1 ? '' : 's'}
        </Text>
      )}
      >
        Room Details
      </SectionLabel>

      <View style={{ gap: space[3] }}>
        {rooms.map((room, i) => (
          <MotiView
            key={i}
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 220, delay: Math.min(i, 9) * 40 }}
          >
            <RoomCard
              index={i}
              room={room}
              canRemove={rooms.length > 1}
              defaultAcType={acType}
              onChange={(patch) => updateRoom(i, patch)}
              onRemove={() => { haptics.selection(); removeRoom(i); }}
            />
          </MotiView>
        ))}
        <PressableScale
          scaleTo={0.98}
          onPress={() => { haptics.selection(); addRoom(acType); }}
          style={[styles.addRoomBtn, { borderColor: tokens.colors.secondary }]}
        >
          <Plus size={16} color={tokens.colors.secondaryInk} />
          <Text style={[styles.addRoomLabel, { color: tokens.colors.secondaryInk }]}>Add another room</Text>
        </PressableScale>
      </View>

      <SectionLabel>Additional Notes</SectionLabel>
      <TextArea
        placeholder="Concealed wiring, specific unit placement, accessibility notes…"
        value={notes}
        onChangeText={(v) => set({ notes: v })}
        maxLength={1000}
      />
    </View>
  );
}

function RoomCard({
  index, room, canRemove, defaultAcType, onChange, onRemove,
}: {
  index: number; room: InstallRoom; canRemove: boolean; defaultAcType: string;
  onChange: (patch: Partial<InstallRoom>) => void; onRemove: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { tokens } = useTheme();

  return (
    <View style={[styles.roomCard, { borderColor: tokens.colors.borderLight }]}>
      <View style={styles.roomHeader}>
        <View style={[styles.roomBadge, { backgroundColor: tokens.colors.surfaceContainer }]}>
          <Text style={[styles.roomBadgeLabel, { color: tokens.colors.primaryDark }]}>{`Room ${index + 1}`}</Text>
        </View>
        {canRemove && (
          <PressableScale onPress={onRemove} style={styles.roomRemove} accessibilityLabel={`Remove room ${index + 1}`}>
            <X size={16} color={tokens.colors.onSurfaceVariant} />
          </PressableScale>
        )}
      </View>

      <Select
        label="Room type"
        options={ROOM_TYPE_OPTIONS}
        value={room.roomType}
        onChange={(v) => onChange({ roomType: v })}
      />

      <View style={styles.roomGrid}>
        <View style={{ flex: 1 }}>
          <NumberInput
            label="Size (sq ft)"
            placeholder="200"
            value={room.sizeSqft}
            onChangeText={(digits) => onChange({ sizeSqft: digits })}
            maxLength={5}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Select
            label="AC type"
            placeholder="Select AC type…"
            options={AC_TYPE_OPTIONS}
            value={room.acType || defaultAcType}
            onChange={(v) => onChange({ acType: v })}
          />
        </View>
      </View>
    </View>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  segment: {
    position: 'relative' as const,
    flexDirection: 'row' as const,
    padding: 4,
    borderRadius: radius.full,
    marginBottom: space[2],
  },
  segmentIndicator: {
    position: 'absolute' as const,
    top: 4,
    bottom: 4,
    left: 4,
    width: '50%' as const,
    borderRadius: radius.full,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: space[2] + 2,
  },
  segmentLabel: {
    fontFamily: font('body', 600),
    fontSize: 13,
  },
  propertyCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[3],
    padding: space[3] + 2,
    borderWidth: 1.5,
    borderRadius: radius.lg - 2,
    backgroundColor: tokens.colors.surfaceContainerLowest,
  },
  propertyIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  propertyLabel: {
    fontFamily: font('body', 700),
    fontSize: 15,
  },
  propertyAddr: {
    fontFamily: font('body', 400),
    fontSize: 13,
  },
  primaryTag: {
    alignSelf: 'flex-start' as const,
    marginTop: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.full,
  },
  primaryTagLabel: {
    fontFamily: font('body', 700),
    fontSize: 10,
    letterSpacing: 0.06 * 10,
    textTransform: 'uppercase' as const,
  },
  propertyCheck: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  muted: {
    fontFamily: font('body', 400),
    fontSize: 13,
  },
  linkButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: 6,
    paddingVertical: space[2],
    marginBottom: space[2],
  },
  linkButtonLabel: {
    fontFamily: font('body', 600),
    fontSize: 13,
  },
  roomCard: {
    gap: space[3],
    padding: space[4],
    borderWidth: 1.5,
    borderRadius: radius.lg - 2,
    backgroundColor: tokens.colors.surfaceContainerLowest,
  },
  roomHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  roomBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  roomBadgeLabel: {
    fontFamily: font('body', 700),
    fontSize: 11,
    letterSpacing: 0.06 * 11,
    textTransform: 'uppercase' as const,
  },
  roomRemove: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  roomGrid: {
    flexDirection: 'row' as const,
    gap: space[3],
  },
  addRoomBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: space[3],
    borderWidth: 1.5,
    borderStyle: 'dashed' as const,
    borderRadius: radius.md,
  },
  addRoomLabel: {
    fontFamily: font('body', 600),
    fontSize: 14,
  },
});
