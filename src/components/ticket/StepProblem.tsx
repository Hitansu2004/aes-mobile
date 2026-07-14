import React, { useRef, useState } from 'react';
import { Image, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MotiView } from 'moti';
import {
  Camera, Check, Droplet, Flame, Images, Info, MoreHorizontal, PowerOff,
  Settings, Snowflake, Sparkles, Volume2, Wind, X, LucideIcon,
} from 'lucide-react-native';

import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives/Text';
import { PressableScale } from '@/components/primitives/PressableScale';
import { Sheet, SheetRef } from '@/components/primitives/Sheet';
import { Spinner } from '@/components/primitives/Spinner';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/context/ToastContext';
import { uploads } from '@/lib/api';
import { PROBLEM_CATEGORIES, acTypeLabel } from '@/lib/constants';
import { lookupErrorCode } from '@/lib/errorCodes';
import type { AcUnitMeta, ServiceState } from '@/store/serviceStore';
import { WizardHeading } from './shared';

// Step 3 — problem details. Ported from ../../aes-frontend/src/app/
// services/ticket/page.js's Step3Problem. MOBILE CHANGE: the web
// base64-encodes photos into photoUrls; here we upload files to
// POST /uploads (multipart, via expo-image-picker) and store the returned
// https URLs instead — a 4-photo base64 payload would 413 on the JSON body
// limit (backend fix-pack Phase B4).
const PROBLEM_ICON: Record<string, LucideIcon> = {
  NOT_COOLING: Snowflake,
  NOISE: Volume2,
  LEAKING: Droplet,
  NOT_TURNING_ON: PowerOff,
  NO_AIRFLOW: Wind,
  SMELL_BURNING: Flame,
  REMOTE_WIFI: Settings,
  OTHER: MoreHorizontal,
};

const DURATIONS = ['Today', '2-3 Days', 'This Week', 'Over a Week'];

export interface StepProblemProps {
  priority: string;
  acMeta: AcUnitMeta | null;
  value: ServiceState;
  onChange: (patch: Partial<ServiceState>) => void;
}

export function StepProblem({
  priority, acMeta, value, onChange,
}: StepProblemProps) {
  const styles = useThemedStyles(makeStyles);
  const { tokens } = useTheme();
  const haptics = useHaptics();
  const toast = useToast();
  const router = useRouter();
  const photoSheetRef = useRef<SheetRef>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  const lookup = lookupErrorCode(value.errorCode);
  const photoCount = value.photoUrls?.length || 0;

  const pickAndUpload = async (source: 'camera' | 'library') => {
    photoSheetRef.current?.dismiss();
    const remaining = 4 - photoCount;
    if (remaining <= 0) return;

    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { toast.error('Camera permission denied — try the photo library instead.'); return; }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { toast.error('Photo library permission denied.'); return; }
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsMultipleSelection: true, selectionLimit: remaining,
      });

    if (result.canceled || !result.assets?.length) return;
    const assets = result.assets.slice(0, remaining);

    setUploadingCount((c) => c + assets.length);
    try {
      const files = assets.map((a, i) => ({
        uri: a.uri,
        name: a.fileName || `photo-${Date.now()}-${i}.jpg`,
        type: a.mimeType || 'image/jpeg',
      }));
      const res = await uploads.images(files);
      const next = [...(value.photoUrls || []), ...(res.urls || [])].slice(0, 4);
      onChange({ photoUrls: next });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not upload photo — try again.');
    } finally {
      setUploadingCount((c) => Math.max(0, c - assets.length));
    }
  };

  const removePhoto = (i: number) => {
    haptics.selection();
    onChange({ photoUrls: (value.photoUrls || []).filter((_, idx) => idx !== i) });
  };

  return (
    <View>
      {acMeta && (
        <View style={[styles.contextStrip, { backgroundColor: tokens.colors.surfaceContainer }]}>
          <Snowflake size={14} color={tokens.colors.secondaryInk} />
          <Text style={styles.contextText} color="onSurface" numberOfLines={2}>
            <Text style={styles.contextStrong} color="onSurfaceStrong">{acMeta.roomLabel}</Text>
            {` · ${acMeta.brand || ''} ${acMeta.modelNumber || ''} · ${Number(acMeta.tonnage || 0).toFixed(1)}T ${acTypeLabel(acMeta.acType || '')}`}
          </Text>
        </View>
      )}

      <WizardHeading title="What's the problem?" sub="Select the issue that best matches your observation." />

      <View style={styles.grid}>
        {PROBLEM_CATEGORIES.map(({ value: cat, label }, i) => {
          const Icon = PROBLEM_ICON[cat] || MoreHorizontal;
          const selected = value.problemCategory === cat;
          return (
            <MotiView
              key={cat}
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 220, delay: Math.min(i, 9) * 30 }}
              style={{ width: '23%' }}
            >
              <PressableScale
                scaleTo={0.96}
                onPress={() => { haptics.selection(); onChange({ problemCategory: cat }); }}
                style={[
                  styles.tile,
                  { width: '100%', borderColor: selected ? tokens.colors.secondary : tokens.colors.borderLight },
                  selected && { backgroundColor: tokens.colors.secondarySoft, ...shadow('sm') },
                ]}
              >
                {selected && (
                  <View style={[styles.tileTick, { backgroundColor: tokens.colors.secondary }]}>
                    <Check size={11} strokeWidth={3} color={tokens.colors.onSecondary} />
                  </View>
                )}
                <View style={[styles.tileIcon, { backgroundColor: selected ? tokens.colors.secondary : tokens.colors.surfaceContainer }]}>
                  <Icon size={20} strokeWidth={2} color={selected ? tokens.colors.onSecondary : tokens.colors.primaryDark} />
                </View>
                <Text style={styles.tileLabel} color="onSurface" numberOfLines={2} align="center">{label}</Text>
              </PressableScale>
            </MotiView>
          );
        })}
      </View>

      <View style={[styles.divider, { backgroundColor: tokens.colors.borderLight }]} />

      <FieldLabel>Error Code (if any)</FieldLabel>
      <TextInput
        value={value.errorCode}
        onChangeText={(t) => onChange({ errorCode: t.toUpperCase() })}
        placeholder="e.g. E1, H6, P1..."
        placeholderTextColor={tokens.colors.outline}
        maxLength={10}
        autoCapitalize="characters"
        style={[styles.errorInput, {
          backgroundColor: tokens.colors.surfaceContainerLow, color: tokens.colors.onSurface, fontFamily: font('mono', 500),
        }]}
      />
      <PressableScale
        style={styles.helperLink}
        onPress={() => router.push('/services/error-codes?from=wizard')}
      >
        <Info size={14} color={tokens.colors.secondaryInk} />
        <Text style={styles.helperLinkLabel} color="secondaryInk">View common error codes</Text>
      </PressableScale>

      {lookup && (
        <MotiView
          from={{ opacity: 0, translateY: 6 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 220 }}
          style={[styles.matchCard, { borderColor: tokens.colors.secondaryLight, backgroundColor: tokens.colors.secondarySoft }]}
        >
          <View style={styles.matchHead}>
            <View style={[styles.codePill, { backgroundColor: tokens.colors.secondary }]}>
              <Text style={[styles.codePillLabel, { color: tokens.colors.onSecondary }]}>{lookup.code}</Text>
            </View>
            <Text style={styles.matchTitle} color="onSurfaceStrong" numberOfLines={1}>{lookup.title}</Text>
          </View>
          <View style={styles.severityRow}>
            <View style={[styles.severityDot, { backgroundColor: lookup.severity === 'TECH' ? tokens.colors.error : tokens.colors.warning }]} />
            <Text style={styles.severityLabel} color={lookup.severity === 'TECH' ? 'error' : 'warning'}>
              {lookup.severity === 'TECH' ? 'Requires Tech' : 'Try Reset First'}
            </Text>
          </View>
          <Text style={styles.matchDesc} color="onSurfaceVariant">{lookup.desc}</Text>
          <View style={[styles.tipBox, { backgroundColor: tokens.colors.surfaceContainerLowest }]}>
            <Sparkles size={14} color={tokens.colors.secondaryInk} />
            <Text style={styles.tipText} color="onSurface">{lookup.tip}</Text>
          </View>
        </MotiView>
      )}

      <FieldLabel style={{ marginTop: space[5] }}>How long has this been happening?</FieldLabel>
      <View style={styles.durationRow}>
        {DURATIONS.map((d) => {
          const selected = value.duration === d;
          return (
            <PressableScale
              key={d}
              scaleTo={0.96}
              onPress={() => { haptics.selection(); onChange({ duration: selected ? '' : d }); }}
              style={[styles.durationChip, { backgroundColor: selected ? tokens.colors.secondary : tokens.colors.surfaceContainer }]}
            >
              <Text style={[styles.durationLabel, { color: selected ? tokens.colors.onSecondary : tokens.colors.onSurfaceVariant }]}>{d}</Text>
            </PressableScale>
          );
        })}
      </View>

      <View style={styles.fieldLabelRow}>
        <FieldLabel style={{ marginTop: space[5], marginBottom: 0 }}>Additional Details</FieldLabel>
        <Text variant="bodySm" color="onSurfaceVariant">{`${value.description?.length || 0}/1500`}</Text>
      </View>
      <TextInput
        multiline
        textAlignVertical="top"
        value={value.description}
        onChangeText={(t) => onChange({ description: t })}
        maxLength={1500}
        placeholder="Describe any specific noises, smells or patterns you have noticed..."
        placeholderTextColor={tokens.colors.outline}
        style={[styles.textarea, { backgroundColor: tokens.colors.surfaceContainerLow, color: tokens.colors.onSurface }]}
      />

      <View style={styles.fieldLabelRow}>
        <FieldLabel style={{ marginTop: space[5], marginBottom: 0 }}>Attach Photos (Optional)</FieldLabel>
        <Text variant="bodySm" color="onSurfaceVariant">{`${photoCount}/4`}</Text>
      </View>
      <View style={styles.photoGrid}>
        {(value.photoUrls || []).map((src, i) => (
          <MotiView
            key={src}
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 220 }}
            style={styles.photoTile}
          >
            <Image source={{ uri: src }} style={styles.photoImg} />
            <PressableScale
              onPress={() => removePhoto(i)}
              accessibilityLabel="Remove photo"
              style={[styles.photoRemove, { backgroundColor: 'rgba(11,26,44,0.75)' }]}
            >
              <X size={13} color="#ffffff" />
            </PressableScale>
          </MotiView>
        ))}
        {Array.from({ length: uploadingCount }).map((_, i) => (
          <View key={`up-${i}`} style={[styles.photoTile, styles.photoUploading, { backgroundColor: tokens.colors.surfaceContainer }]}>
            <Spinner size="sm" />
          </View>
        ))}
        {photoCount + uploadingCount < 4 && (
          <PressableScale
            style={[styles.photoAdd, { borderColor: tokens.colors.outlineVariant, backgroundColor: tokens.colors.surfaceContainerLow }]}
            onPress={() => photoSheetRef.current?.present()}
          >
            <Camera size={20} color={tokens.colors.onSurfaceVariant} />
            <Text style={styles.photoAddLabel} color="onSurfaceVariant">Add Photo</Text>
          </PressableScale>
        )}
      </View>

      <Sheet ref={photoSheetRef} title="Add a photo">
        <View style={{ paddingHorizontal: space[5], paddingBottom: space[8], gap: space[2] }}>
          <PressableScale
            style={[styles.sourceRow, { backgroundColor: tokens.colors.surfaceContainerLow }]}
            onPress={() => pickAndUpload('camera')}
          >
            <Camera size={18} color={tokens.colors.primaryDark} />
            <Text variant="bodyMd" color="onSurface">Take a photo</Text>
          </PressableScale>
          <PressableScale
            style={[styles.sourceRow, { backgroundColor: tokens.colors.surfaceContainerLow }]}
            onPress={() => pickAndUpload('library')}
          >
            <Images size={18} color={tokens.colors.primaryDark} />
            <Text variant="bodyMd" color="onSurface">Choose from library</Text>
          </PressableScale>
        </View>
      </Sheet>
    </View>
  );
}

function FieldLabel({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <Text
      style={[{
        fontFamily: font('body', 600), fontSize: 12, letterSpacing: 0.06 * 12, textTransform: 'uppercase', marginBottom: space[2],
      }, style]}
      color="onSurfaceVariant"
    >
      {children}
    </Text>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  contextStrip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[2],
    padding: space[3],
    borderRadius: radius.md,
    marginBottom: space[4],
  },
  contextText: {
    flex: 1,
    fontFamily: font('body', 400),
    fontSize: 12,
  },
  contextStrong: {
    fontFamily: font('body', 700),
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between' as const,
    rowGap: space[2],
  },
  tile: {
    width: '23%' as const,
    aspectRatio: 0.95,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    padding: space[1],
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    position: 'relative' as const,
  },
  tileTick: {
    position: 'absolute' as const,
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm + 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  tileLabel: {
    fontFamily: font('body', 600),
    fontSize: 10.5,
    lineHeight: 13,
  },
  divider: {
    height: 1,
    marginVertical: space[5],
  },
  errorInput: {
    height: 48,
    paddingHorizontal: space[4],
    borderRadius: radius.sm,
    fontSize: 15,
    letterSpacing: 0.5,
  },
  helperLink: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: 6,
    marginTop: space[2],
  },
  helperLinkLabel: {
    fontFamily: font('body', 600),
    fontSize: 12,
  },
  matchCard: {
    marginTop: space[3],
    padding: space[4],
    borderWidth: 1,
    borderRadius: radius.md,
    gap: space[2],
  },
  matchHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[2],
  },
  codePill: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: radius.sm,
  },
  codePillLabel: {
    fontFamily: font('mono', 600),
    fontSize: 12,
    letterSpacing: 0.5,
  },
  matchTitle: {
    flex: 1,
    fontFamily: font('body', 700),
    fontSize: 14,
  },
  severityRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  severityDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
  },
  severityLabel: {
    fontFamily: font('body', 700),
    fontSize: 11,
    letterSpacing: 0.04 * 11,
    textTransform: 'uppercase' as const,
  },
  matchDesc: {
    fontFamily: font('body', 400),
    fontSize: 13,
    lineHeight: 19,
  },
  tipBox: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: space[2],
    padding: space[3],
    borderRadius: radius.sm,
  },
  tipText: {
    flex: 1,
    fontFamily: font('body', 400),
    fontSize: 12,
    lineHeight: 17,
  },
  durationRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: space[2],
  },
  durationChip: {
    paddingVertical: space[2],
    paddingHorizontal: 14,
    borderRadius: radius.full,
  },
  durationLabel: {
    fontFamily: font('body', 600),
    fontSize: 13,
  },
  fieldLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  textarea: {
    minHeight: 100,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.sm,
    fontFamily: font('body', 400),
    fontSize: 15,
    lineHeight: 22,
  },
  photoGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: space[2],
  },
  photoTile: {
    width: '48%' as const,
    height: 96,
    borderRadius: radius.sm,
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  photoImg: {
    width: '100%' as const,
    height: '100%' as const,
  },
  photoUploading: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  photoRemove: {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  photoAdd: {
    width: '48%' as const,
    height: 96,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
  },
  photoAddLabel: {
    fontFamily: font('body', 600),
    fontSize: 10,
  },
  sourceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[3],
    padding: space[4],
    borderRadius: radius.md,
  },
});
