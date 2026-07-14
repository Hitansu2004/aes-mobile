import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  BackHandler, KeyboardAvoidingView, Platform, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatePresence, MotiView } from 'moti';
import {
  ArrowLeft, ArrowRight, Home, X,
} from 'lucide-react-native';

import { AppShell } from '@/components/shell/AppShell';
import { Splash } from '@/components/shell/Splash';
import { Text } from '@/components/primitives/Text';
import { Button } from '@/components/primitives/Button';
import { PressableScale } from '@/components/primitives/PressableScale';
import { ShakeView } from '@/components/primitives/ShakeView';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useHaptics } from '@/hooks/useHaptics';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { InstallationProvider, useInstall } from '@/store/installationStore';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { properties as propertiesApi, installations as installationsApi } from '@/lib/api';
import type { Property, InstallationRequest } from '@/types/api';
import { StepSpace } from '@/components/installation/StepSpace';
import { StepAcType } from '@/components/installation/StepAcType';
import { StepBrandModel } from '@/components/installation/StepBrandModel';
import { StepPropertyRooms } from '@/components/installation/StepPropertyRooms';
import { StepSchedule } from '@/components/installation/StepSchedule';
import { InstallationSuccessScreen } from '@/components/installation/SuccessScreen';

// Installation wizard — 5 steps + a success screen. Ported from
// ../../aes-frontend/src/app/services/installation/page.js +
// installation.module.css. See CLAUDE.md: this is a `focused` AppShell
// screen (no sidebar/top bar/bottom nav) that renders its own nav row +
// hero + <StepIndicator>. The web syncs steps to window.history so browser
// Back steps back through the wizard; on Android we mirror that with
// BackHandler (hardware back → previous step, only exits from step 1).
const TOTAL_STEPS = 5;

const STEP_TITLES = [
  { eyebrow: 'Step 1 of 5', title: 'Plan a new installation', sub: 'Tell us about the space — we tailor the kit and crew to match.' },
  { eyebrow: 'Step 2 of 5', title: 'Pick your AC type', sub: 'Choose the system that suits your layout and load.' },
  { eyebrow: 'Step 3 of 5', title: 'Pick a brand and model', sub: 'Authorised dealer for India’s top OEMs.' },
  { eyebrow: 'Step 4 of 5', title: 'Where and what rooms?', sub: 'Tell us about the site so we can prep the team.' },
  { eyebrow: 'Step 5 of 5', title: 'Schedule the site survey', sub: 'Pick a date and slot that works best for you.' },
] as const;

export default function InstallationWizardScreen() {
  return (
    <InstallationProvider>
      <InstallationWizard />
    </InstallationProvider>
  );
}

function InstallationWizard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const {
    state, set, reset, addRoom, updateRoom, removeRoom, hydrated,
  } = useInstall();
  const toast = useToast();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const reduceMotion = useReduceMotion();
  const { isPhone } = useBreakpoint();
  const styles = useThemedStyles(makeStyles);

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [blockedShake, setBlockedShake] = useState<number | null>(null);
  const [propertyList, setPropertyList] = useState<Property[]>([]);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState<InstallationRequest | null>(null);

  // Auth guard — customer-only flow, ported from the web's redirect.
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/services/installation'); return; }
    if (user.role !== 'CUSTOMER') router.replace(defaultRouteForRole(user.role));
  }, [user, authLoading, router]);

  // Pre-load properties for step 4, auto-selecting the first one if none set.
  useEffect(() => {
    if (!user || user.role !== 'CUSTOMER') return undefined;
    let cancelled = false;
    propertiesApi.list().then((res) => {
      if (cancelled) return;
      const arr = Array.isArray(res) ? res : [];
      setPropertyList(arr);
      if (arr.length > 0 && !state.propertyId && !state.propertyAddress) {
        set({ propertyId: arr[0].id });
      }
    }).catch(() => { /* silent — property list is a convenience, not required */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  const goToStep = useCallback((n: number) => {
    const target = Math.min(Math.max(n, 1), TOTAL_STEPS);
    setStep((s) => {
      if (target === s) return s;
      setDirection(target > s ? 1 : -1);
      return target;
    });
  }, []);

  const goNextStep = useCallback(() => goToStep(stepRef.current + 1), [goToStep]);
  const goPrevStep = useCallback(() => goToStep(stepRef.current - 1), [goToStep]);

  const homeHref = defaultRouteForRole(user?.role) || '/dashboard';

  const goBack = useCallback(() => {
    if (stepRef.current > 1) goPrevStep();
    else router.push(homeHref);
  }, [goPrevStep, router, homeHref]);

  const goHome = useCallback(() => router.push(homeHref), [router, homeHref]);

  // Android hardware back steps back through the wizard instead of exiting
  // it. The web's equivalent is syncing wizard steps to window.history;
  // AppShell explicitly skips its own BackHandler when `focused`, so this
  // screen owns hardware back entirely while mounted.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (submittedRequest) return false;
      if (stepRef.current > 1) { goPrevStep(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [goPrevStep, submittedRequest]);

  // ─── Validations per step ──────────────────────────────
  const step1Valid = !!state.buildingType;
  const step2Valid = !!state.acType;
  const step3Valid = !!state.brand;
  const step4Valid = useMemo(() => {
    if (!state.propertyId && !state.propertyAddress?.trim()) return false;
    if (state.rooms.length === 0) return false;
    return state.rooms.every((r) => r.roomType && r.acType && r.sizeSqft && Number(r.sizeSqft) > 0);
  }, [state]);
  const step5Valid = !!state.scheduledDate && !!state.scheduledSlot;

  const stepValid = [step1Valid, step2Valid, step3Valid, step4Valid, step5Valid][step - 1];

  // ─── Submit ────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!step5Valid) return;
    setSubmitting(true);
    try {
      const payload = {
        propertyId: state.propertyId || null,
        propertyAddress: !state.propertyId ? state.propertyAddress?.trim() || null : null,
        propertyType: state.buildingType || null,
        acType: state.acType,
        brand: state.brand || null,
        modelNumber: state.modelNumber || null,
        tonnage: state.tonnage ? Number(state.tonnage) : null,
        energyRating: state.energyRating ? Number(state.energyRating) : null,
        rooms: state.rooms.map((r) => ({
          roomType: r.roomType,
          sizeSqft: Number(r.sizeSqft),
          acType: r.acType || state.acType,
        })),
        notes: state.notes?.trim() || null,
        scheduledDate: state.scheduledDate,
        scheduledSlot: state.scheduledSlot,
      };
      const res = await installationsApi.create(payload);
      haptics.success();
      setSubmittedRequest(res);
      reset();
      toast.success('Installation request submitted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit request.');
    } finally {
      setSubmitting(false);
    }
  }, [step5Valid, state, reset, haptics, toast]);

  if (authLoading || !user || !hydrated) {
    return <Splash message="Loading installation planner…" />;
  }

  if (submittedRequest) {
    return (
      <AppShell focused bare>
        <InstallationSuccessScreen
          request={submittedRequest}
          onTrack={() => router.replace('/installations')}
          onHome={() => router.replace('/dashboard')}
        />
      </AppShell>
    );
  }

  const stepHero = STEP_TITLES[step - 1];

  const hero = (
    <View style={{ gap: space[5] }}>
      <View style={styles.wizardNav}>
        {step > 1 ? (
          <PressableScale style={[styles.navBtn, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]} onPress={goBack}>
            <ArrowLeft size={16} color={tokens.colors.onSurfaceStrong} />
            <Text style={styles.navBtnLabel} color="onSurfaceStrong">Back</Text>
          </PressableScale>
        ) : (
          <PressableScale style={[styles.navBtn, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]} onPress={goHome}>
            <Home size={16} color={tokens.colors.onSurfaceStrong} />
            <Text style={styles.navBtnLabel} color="onSurfaceStrong">Home</Text>
          </PressableScale>
        )}
        <Text style={styles.brand} color="onSurfaceStrong" numberOfLines={1}>ARIAL ENGINEERING</Text>
        <PressableScale
          style={[styles.navClose, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
          onPress={goHome}
          accessibilityLabel="Exit to home"
        >
          <X size={18} color={tokens.colors.onSurfaceVariant} />
        </PressableScale>
      </View>

      <View style={[styles.heroRow, isPhone && styles.heroRowPhone]}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.eyebrow} color="secondaryInk">{stepHero.eyebrow}</Text>
          <Text variant="headlineLg" color="onSurfaceStrong">{stepHero.title}</Text>
          <Text variant="bodyMd" color="onSurfaceVariant">{stepHero.sub}</Text>
        </View>
        <StepIndicator current={step} total={TOTAL_STEPS} />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppShell hero={hero} focused contentStyle={{ paddingBottom: 108 + insets.bottom }}>
        <AnimatePresence exitBeforeEnter>
          <MotiView
            key={step}
            from={reduceMotion ? { opacity: 0 } : { opacity: 0, translateX: direction > 0 ? 24 : -24, scale: 0.98 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, translateX: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, translateX: direction > 0 ? -24 : 24, scale: 0.98 }}
            transition={{ type: 'timing', duration: 220 }}
            exitTransition={{ type: 'timing', duration: 180 }}
          >
            <ShakeView shakeKey={blockedShake}>
              {step === 1 && (
                <StepSpace value={state.buildingType} onChange={(v) => set({ buildingType: v })} />
              )}
              {step === 2 && (
                <StepAcType value={state.acType} buildingType={state.buildingType} onChange={(v) => set({ acType: v })} />
              )}
              {step === 3 && (
                <StepBrandModel
                  brand={state.brand}
                  tonnage={state.tonnage}
                  energyRating={state.energyRating}
                  modelNumber={state.modelNumber}
                  onChange={set}
                />
              )}
              {step === 4 && (
                <StepPropertyRooms
                  propertyId={state.propertyId}
                  propertyAddress={state.propertyAddress}
                  rooms={state.rooms}
                  notes={state.notes}
                  acType={state.acType}
                  propertyList={propertyList}
                  showAddAddress={showAddAddress}
                  setShowAddAddress={setShowAddAddress}
                  set={set}
                  addRoom={addRoom}
                  updateRoom={updateRoom}
                  removeRoom={removeRoom}
                />
              )}
              {step === 5 && (
                <StepSchedule state={state} set={set} propertyList={propertyList} onEdit={goToStep} />
              )}
            </ShakeView>
          </MotiView>
        </AnimatePresence>
      </AppShell>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + space[3], borderTopColor: tokens.colors.outlineVariant, backgroundColor: tokens.colors.surface }]}>
        <View style={styles.actionInner}>
          {step > 1 && (
            <Button variant="outline" pill onPress={goBack} disabled={submitting} leftIcon={<ArrowLeft size={16} color={tokens.colors.primary} />}>
              Back
            </Button>
          )}
          <View style={{ flex: 1 }}>
            {step === TOTAL_STEPS ? (
              <Button
                pill
                variant="primary"
                fullWidth
                disabled={!step5Valid}
                loading={submitting}
                onPress={handleSubmit}
                rightIcon={!submitting ? <ArrowRight size={16} color={tokens.colors.onSecondary} /> : undefined}
              >
                Submit Request
              </Button>
            ) : (
              <Button
                pill
                variant="primary"
                fullWidth
                disabled={!stepValid}
                onPress={goNextStep}
                rightIcon={<ArrowRight size={16} color={tokens.colors.onSecondary} />}
              >
                Continue
              </Button>
            )}
            {/* Invisible tap-catcher over the disabled Continue/Submit button —
                a disabled Pressable swallows touches silently, so without this
                a user mashing an incomplete step gets no feedback at all
                (CLAUDE.md Phase 20, FEEDBACK). Only mounted while blocked. */}
            {!(step === TOTAL_STEPS ? step5Valid : stepValid) && (
              <PressableScale
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                }}
                onPress={() => { haptics.error(); setBlockedShake((k) => (k ?? 0) + 1); }}
              />
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  wizardNav: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: space[3],
  },
  navBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    height: 38,
    paddingHorizontal: space[3] + 2,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  navBtnLabel: {
    fontFamily: font('body', 600),
    fontSize: 13,
  },
  brand: {
    flex: 1,
    textAlign: 'center' as const,
    fontFamily: font('mono', 600),
    fontSize: 12,
    letterSpacing: 0.18 * 12,
    textTransform: 'uppercase' as const,
  },
  navClose: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  heroRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'space-between' as const,
    gap: space[6],
  },
  heroRowPhone: {
    flexDirection: 'column' as const,
    alignItems: 'flex-start' as const,
    gap: space[3],
  },
  eyebrow: {
    fontFamily: font('mono', 600),
    fontSize: 11,
    letterSpacing: 0.10 * 11,
    textTransform: 'uppercase' as const,
  },
  actionBar: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: space[3],
    paddingHorizontal: space[4],
    borderTopWidth: 1,
  },
  actionInner: {
    flexDirection: 'row' as const,
    gap: space[3],
    maxWidth: 720,
    width: '100%' as const,
    alignSelf: 'center' as const,
  },
});
