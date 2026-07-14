import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  BackHandler, KeyboardAvoidingView, Platform, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import {
  ServiceProvider, useService, PRIORITY_INFO, priorityFromServiceStatus, AcUnitMeta,
} from '@/store/serviceStore';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { PaymentModal, PaymentModalRef } from '@/components/ui/PaymentModal';
import { LocationPicker, LocationPickerRef, isPlaceholderAddress } from '@/components/ui/LocationPicker';
import { DayAvailability } from '@/components/ui/DayPicker';
import {
  properties as propertiesApi, acUnits as acUnitsApi, tickets as ticketsApi, pricing as pricingApi, slots as slotsApi,
} from '@/lib/api';
import type { AcUnit, Property, ServiceTicket } from '@/types/api';
import type { PriceQuote } from '@/types/api';
import { StepPriority } from '@/components/ticket/StepPriority';
import { StepSelectAc, SelectableAcUnit } from '@/components/ticket/StepSelectAc';
import { StepProblem } from '@/components/ticket/StepProblem';
import { StepSchedule } from '@/components/ticket/StepSchedule';
import { TicketSuccessScreen } from '@/components/ticket/SuccessScreen';

// Service-ticket wizard — 4 steps + payment + success. Ported from
// ../../aes-frontend/src/app/services/ticket/page.js (1837 lines) +
// ticket.module.css. Same `focused` AppShell shell + wizard nav + hero +
// <StepIndicator> pattern as the installation wizard (Phase 10).
const TOTAL_STEPS = 4;

const STEP_TITLES = [
  { eyebrow: 'Step 1 of 4', title: 'How urgent is this?', sub: 'We use this to route your ticket to the right team in real time.' },
  { eyebrow: 'Step 2 of 4', title: 'Which AC needs attention?', sub: 'Pick the unit from your saved properties — or add a new one.' },
  { eyebrow: 'Step 3 of 4', title: 'Tell us what’s wrong', sub: 'A few details help us send the right engineer with the right parts.' },
  { eyebrow: 'Step 4 of 4', title: 'Schedule the visit', sub: 'Pick the date and slot that suits you best.' },
] as const;

const COUPON_DEBOUNCE_MS = 500;

export default function ServiceTicketWizardScreen() {
  return (
    <ServiceProvider>
      <ServiceTicketWizard />
    </ServiceProvider>
  );
}

function ServiceTicketWizard() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ step?: string; code?: string }>();
  const { user, loading: authLoading } = useAuth();
  const {
    state, set, reset, hydrated,
  } = useService();
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
  const [propertiesList, setPropertiesList] = useState<Property[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<ServiceTicket | null>(null);

  // Dynamic pricing + payment (P3)
  const [priceQuote, setPriceQuote] = useState<PriceQuote | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [debouncedCoupon, setDebouncedCoupon] = useState('');
  const [pendingTicketPayload, setPendingTicketPayload] = useState<Record<string, unknown> | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);

  // BookMyShow-style slot availability, keyed by ISO date.
  const [slotAvailability, setSlotAvailability] = useState<Record<string, DayAvailability & { slots?: Record<string, { available: number; full: boolean }>; busyReason?: string | null }>>({});
  const [dayCapacity, setDayCapacity] = useState(30);

  const paymentModalRef = useRef<PaymentModalRef>(null);
  const locationPickerRef = useRef<LocationPickerRef>(null);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/services/ticket'); return; }
    if (user.role !== 'CUSTOMER') router.replace(defaultRouteForRole(user.role) as never);
  }, [user, authLoading, router]);

  const reloadProperties = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!user || user.role !== 'CUSTOMER') return [];
    if (!opts.silent) setPropertiesLoading(true);
    try {
      const list = await propertiesApi.list();
      const arr = Array.isArray(list) ? list : [];
      setPropertiesList(arr);
      return arr;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load your properties.');
      return [];
    } finally {
      setPropertiesLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!user || user.role !== 'CUSTOMER') return;
    let cancelled = false;
    (async () => {
      const arr = await reloadProperties();
      if (cancelled) return;
      const firstWithUnits = arr.find((p) => (p.acUnits?.length ?? 0) > 0);
      const initial = firstWithUnits || arr[0];
      if (initial) setActivePropertyId(initial.id);
      if (state.acUnitId) {
        const found = arr
          .flatMap((p) => (p.acUnits || []).map((u) => ({ ...u, propertyLabel: p.label, propertyId: p.id })))
          .find((u) => u.id === state.acUnitId);
        if (found) {
          set({
            acUnitMeta: {
              roomLabel: found.roomLabel,
              brand: found.brand,
              modelNumber: found.modelNumber,
              acType: found.acType,
              tonnage: found.tonnage,
              serviceStatus: found.serviceStatus,
              propertyId: found.propertyId,
              propertyLabel: found.propertyLabel,
            },
          });
          setActivePropertyId(found.propertyId);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleAddAcUnitInline = useCallback(async ({
    propertyId, payload, autoSelect,
  }: { propertyId: string; payload: Record<string, unknown>; autoSelect: boolean }) => {
    try {
      const created = await acUnitsApi.create(propertyId, payload);
      const arr = await reloadProperties({ silent: true });
      const prop = arr.find((p) => p.id === propertyId);
      const unit = (prop?.acUnits || []).find((u) => u.id === created.id) || created;
      setActivePropertyId(propertyId);
      if (autoSelect) {
        set({
          acUnitId: unit.id,
          acUnitMeta: {
            roomLabel: unit.roomLabel,
            brand: unit.brand,
            modelNumber: unit.modelNumber,
            acType: unit.acType,
            tonnage: unit.tonnage,
            serviceStatus: unit.serviceStatus,
            propertyId,
            propertyLabel: prop?.label,
          },
          priorityHint: priorityFromServiceStatus(unit.serviceStatus) || state.priorityHint,
        });
      }
      toast.success(`AC "${unit.roomLabel}" added.`);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add AC unit.');
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadProperties, set, state.priorityHint, toast]);

  // Honour ?step=N&code=XX when returning from the error-code guide.
  useEffect(() => {
    if (!hydrated) return;
    const stepParam = searchParams.step;
    const codeParam = searchParams.code;
    if (!stepParam && !codeParam) return;
    if (codeParam) set({ errorCode: String(codeParam).toUpperCase() });
    const n = Number(stepParam);
    if (stepParam && n >= 1 && n <= TOTAL_STEPS) {
      setDirection(n > step ? 1 : -1);
      setStep(n);
    }
    router.setParams({ step: undefined, code: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, searchParams.step, searchParams.code]);

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

  const goNext = useCallback(() => goToStep(stepRef.current + 1), [goToStep]);
  const goPrev = useCallback(() => goToStep(stepRef.current - 1), [goToStep]);

  const homeHref = defaultRouteForRole(user?.role) || '/dashboard';
  const goBack = useCallback(() => {
    if (stepRef.current > 1) goPrev();
    else router.push(homeHref as never);
  }, [goPrev, router, homeHref]);
  const goHome = useCallback(() => router.push(homeHref as never), [router, homeHref]);

  // Android hardware back steps back through the wizard.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (submittedTicket) return false;
      if (stepRef.current > 1) { goPrev(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [goPrev, submittedTicket]);

  // Validation per step
  const step1Valid = !!state.priorityHint;
  const step2Valid = !!state.acUnitId;
  const step3Valid = !!state.problemCategory;
  const step4Valid = !!state.scheduledDate && !!state.scheduledSlot;
  const stepValid = [step1Valid, step2Valid, step3Valid, step4Valid][step - 1];

  const effectivePriority = (state.acUnitMeta && priorityFromServiceStatus(state.acUnitMeta.serviceStatus)) || state.priorityHint;

  const allACs = useMemo<SelectableAcUnit[]>(() => {
    const out: SelectableAcUnit[] = [];
    propertiesList.forEach((p) => {
      (p.acUnits || []).forEach((u) => out.push({ ...u, propertyId: p.id, propertyLabel: p.label }));
    });
    return out;
  }, [propertiesList]);

  const selectAcUnit = useCallback((unit: AcUnit & { propertyLabel?: string }) => {
    if (!unit) return;
    set({
      acUnitId: unit.id,
      acUnitMeta: {
        brand: unit.brand,
        modelNumber: unit.modelNumber,
        tonnage: unit.tonnage,
        acType: unit.acType,
        roomLabel: unit.roomLabel,
        propertyLabel: unit.propertyLabel,
        propertyId: unit.propertyId,
        serviceStatus: unit.serviceStatus,
      },
    });
    setActivePropertyId(unit.propertyId);
  }, [set]);

  const acUnitsForActiveProperty = useMemo(
    () => (activePropertyId ? allACs.filter((u) => u.propertyId === activePropertyId) : []),
    [allACs, activePropertyId],
  );

  const activeProperty = useMemo(
    () => propertiesList.find((p) => p.id === activePropertyId) || null,
    [propertiesList, activePropertyId],
  );

  const ticketProperty = useMemo(() => {
    if (!state.acUnitMeta?.propertyId) return activeProperty;
    return propertiesList.find((p) => p.id === state.acUnitMeta?.propertyId) || activeProperty;
  }, [propertiesList, state.acUnitMeta, activeProperty]);

  // Slot availability — fetched once the customer reaches step 4.
  useEffect(() => {
    if (step !== 4) return undefined;
    let cancelled = false;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    slotsApi.availability({ from: `${yyyy}-${mm}-${dd}`, days: 14 })
      .then((resp) => {
        if (cancelled) return;
        const lookup: typeof slotAvailability = {};
        (resp?.days || []).forEach((d) => { lookup[d.date as unknown as string] = d as never; });
        setSlotAvailability(lookup);
        if (resp?.dayCapacity) setDayCapacity(resp.dayCapacity);
      })
      .catch(() => { /* silent — picker degrades to unrestricted mode */ });
    return () => { cancelled = true; };
  }, [step]);

  // Debounce the coupon re-fetch — never fire the pricing quote on every
  // keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCoupon(couponInput.trim()), COUPON_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [couponInput]);

  // Re-quote whenever we have the inputs needed for a P3 paid ticket. We
  // deliberately bail out on placeholder/office-default coordinates —
  // otherwise the API would happily return "0.0 km · Free".
  useEffect(() => {
    if (effectivePriority !== 'P3') { setPriceQuote(null); return undefined; }
    if (!state.acUnitMeta?.acType) return undefined;
    if (!ticketProperty || isPlaceholderAddress(ticketProperty)) { setPriceQuote(null); return undefined; }
    let cancelled = false;
    setPricingLoading(true);
    pricingApi.quote({
      acType: state.acUnitMeta.acType,
      lat: ticketProperty.latitude as number,
      lng: ticketProperty.longitude as number,
      couponCode: debouncedCoupon || undefined,
    })
      .then((q) => { if (!cancelled) setPriceQuote(q); })
      .catch(() => { if (!cancelled) setPriceQuote(null); })
      .finally(() => { if (!cancelled) setPricingLoading(false); });
    return () => { cancelled = true; };
  }, [effectivePriority, state.acUnitMeta, ticketProperty, debouncedCoupon]);

  const buildPayload = useCallback((paymentId: string | null = null) => {
    const description = [
      state.duration ? `Duration: ${state.duration}` : null,
      state.description?.trim() ? state.description.trim() : null,
    ].filter(Boolean).join('\n');
    return {
      acUnitId: state.acUnitId,
      problemCategory: state.problemCategory,
      errorCode: state.errorCode?.trim() ? state.errorCode.trim().toUpperCase() : null,
      problemDescription: description || null,
      photoUrls: state.photoUrls?.length ? state.photoUrls : [],
      scheduledDate: state.scheduledDate,
      scheduledSlot: state.scheduledSlot,
      serviceLat: ticketProperty?.latitude ?? null,
      serviceLng: ticketProperty?.longitude ?? null,
      serviceAddress: ticketProperty?.formattedAddress
        ?? [ticketProperty?.addressLine1, ticketProperty?.city].filter(Boolean).join(', '),
      landmark: ticketProperty?.landmark ?? null,
      secondaryPhone: ticketProperty?.secondaryPhone ?? null,
      discountCode: priceQuote?.couponCode ?? (couponInput.trim() || null),
      paymentId,
    };
  }, [state, ticketProperty, priceQuote, couponInput]);

  const createTicketWithPayload = useCallback(async (payload: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const res = await ticketsApi.create(payload);
      setSubmittedTicket(res);
      reset();
      setPriceQuote(null);
      setCouponInput('');
      haptics.success();
      toast.success('Service ticket raised.');
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Could not raise ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [reset, haptics, toast]);

  const handleSubmit = useCallback(async () => {
    if (!step4Valid || !state.acUnitId) return;
    if (effectivePriority === 'P3') {
      if (isPlaceholderAddress(ticketProperty)) {
        haptics.warning();
        toast.error('Please set your visit address first — distance affects the price.');
        locationPickerRef.current?.present();
        return;
      }
      if (!priceQuote || pricingLoading) {
        haptics.warning();
        toast.error('We are still calculating the price — try again in a moment.');
        return;
      }
      setPendingTicketPayload(buildPayload(null));
      paymentModalRef.current?.present();
      return;
    }
    await createTicketWithPayload(buildPayload(null));
  }, [step4Valid, state.acUnitId, effectivePriority, ticketProperty, priceQuote, pricingLoading, buildPayload, createTicketWithPayload, haptics, toast]);

  const handlePaymentSuccess = useCallback(async ({ paymentId }: { paymentId: string }) => {
    if (!pendingTicketPayload) return;
    await createTicketWithPayload({ ...pendingTicketPayload, paymentId });
    setPendingTicketPayload(null);
  }, [pendingTicketPayload, createTicketWithPayload]);

  const handleLocationSave = useCallback(async (loc: {
    lat: number; lng: number; formattedAddress: string; googlePlaceId: string | null;
    landmark: string; secondaryPhone: string; city: string; pincode: string;
  }) => {
    if (!ticketProperty?.id) return;
    setSavingLocation(true);
    try {
      const updated = await propertiesApi.update(ticketProperty.id, {
        latitude: loc.lat,
        longitude: loc.lng,
        formattedAddress: loc.formattedAddress,
        googlePlaceId: loc.googlePlaceId || undefined,
        landmark: loc.landmark,
        secondaryPhone: loc.secondaryPhone,
        addressLine1: loc.formattedAddress,
        ...(loc.city ? { city: loc.city } : {}),
        ...(loc.pincode ? { pincode: loc.pincode } : {}),
      });
      setPropertiesList((prev) => prev.map((p) => (p.id === ticketProperty.id ? { ...p, ...updated } : p)));
      locationPickerRef.current?.dismiss();
      toast.success('Address saved — recalculating price…');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save address');
    } finally {
      setSavingLocation(false);
    }
  }, [ticketProperty, toast]);

  if (authLoading || !user || !hydrated) {
    return <Splash message="Loading service request…" />;
  }

  if (submittedTicket) {
    return (
      <AppShell focused bare>
        <TicketSuccessScreen
          ticket={submittedTicket}
          onTrack={() => router.replace(`/tickets/${submittedTicket.ticketNumber}` as never)}
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
        <View style={{ alignItems: isPhone ? 'flex-start' : 'flex-end', gap: space[2] }}>
          {effectivePriority ? <PriorityBadge priority={effectivePriority} dense /> : null}
          <StepIndicator current={step} total={TOTAL_STEPS} />
        </View>
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
              <StepPriority value={state.priorityHint} onChange={(v) => set({ priorityHint: v })} />
            )}
            {step === 2 && (
              <StepSelectAc
                loading={propertiesLoading}
                properties={propertiesList}
                activeProperty={activeProperty}
                acUnits={acUnitsForActiveProperty}
                onPickProperty={setActivePropertyId}
                onAddAcUnit={handleAddAcUnitInline}
                selectedId={state.acUnitId}
                onSelect={(unit) => {
                  set({
                    acUnitId: unit.id,
                    acUnitMeta: {
                      roomLabel: unit.roomLabel,
                      brand: unit.brand,
                      modelNumber: unit.modelNumber,
                      acType: unit.acType,
                      tonnage: unit.tonnage,
                      serviceStatus: unit.serviceStatus,
                      propertyId: unit.propertyId,
                      propertyLabel: unit.propertyLabel,
                    },
                    priorityHint: priorityFromServiceStatus(unit.serviceStatus) || state.priorityHint,
                  });
                  goNext();
                }}
              />
            )}
            {step === 3 && (
              <StepProblem
                priority={effectivePriority}
                acMeta={state.acUnitMeta}
                value={state}
                onChange={set}
              />
            )}
            {step === 4 && (
              <StepSchedule
                priority={effectivePriority}
                acMeta={state.acUnitMeta}
                state={state}
                set={set}
                priceQuote={priceQuote}
                pricingLoading={pricingLoading}
                couponInput={couponInput}
                onCouponChange={setCouponInput}
                ticketProperty={ticketProperty}
                addressMissing={isPlaceholderAddress(ticketProperty)}
                onPickAddress={() => locationPickerRef.current?.present()}
                propertiesList={propertiesList}
                acUnitsForActiveProperty={acUnitsForActiveProperty}
                activePropertyId={activePropertyId}
                slotAvailability={slotAvailability}
                dayCapacity={dayCapacity}
                onChangeProperty={(propertyId) => {
                  setActivePropertyId(propertyId);
                  const acsInNewProp = allACs.filter((u) => u.propertyId === propertyId);
                  const currentStillValid = state.acUnitMeta?.propertyId === propertyId;
                  if (!currentStillValid) {
                    if (acsInNewProp.length > 0) selectAcUnit(acsInNewProp[0]);
                    else set({ acUnitId: '', acUnitMeta: null as unknown as AcUnitMeta });
                  }
                }}
                onChangeAcUnit={(acUnitId) => {
                  const unit = allACs.find((u) => u.id === acUnitId);
                  if (unit) selectAcUnit(unit);
                }}
              />
            )}
            </ShakeView>
          </MotiView>
        </AnimatePresence>
      </AppShell>

      <PaymentModal
        ref={paymentModalRef}
        amount={priceQuote?.total ?? 0}
        description={state.acUnitMeta ? `${state.acUnitMeta.acType} service · ${state.acUnitMeta.roomLabel}` : 'AES service charge'}
        customerName={user?.name}
        customerPhone={user?.phoneNumber}
        onSuccess={handlePaymentSuccess}
      />

      <LocationPicker
        key={ticketProperty?.id || 'no-property'}
        ref={locationPickerRef}
        initial={ticketProperty ? {
          lat: isPlaceholderAddress(ticketProperty) ? undefined : ticketProperty.latitude,
          lng: isPlaceholderAddress(ticketProperty) ? undefined : ticketProperty.longitude,
          formattedAddress: isPlaceholderAddress(ticketProperty) ? '' : (ticketProperty.formattedAddress || ''),
          landmark: ticketProperty.landmark || '',
          secondaryPhone: ticketProperty.secondaryPhone || user?.phoneNumber || '',
        } : undefined}
        onSave={handleLocationSave}
        saving={savingLocation}
      />

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + space[3], borderTopColor: tokens.colors.outlineVariant, backgroundColor: tokens.colors.surface }]}>
        <View style={styles.actionInner}>
          {step > 1 && (
            <Button variant="outline" pill onPress={goBack} disabled={submitting} leftIcon={<ArrowLeft size={16} color={tokens.colors.primary} />}>
              Back
            </Button>
          )}
          <View style={{ flex: 1 }}>
            {step === 4 ? (
              <Button
                pill
                variant="primary"
                fullWidth
                disabled={!step4Valid || submitting || (effectivePriority === 'P3' && (pricingLoading || isPlaceholderAddress(ticketProperty)))}
                loading={submitting}
                onPress={handleSubmit}
                rightIcon={!submitting ? <ArrowRight size={16} color={tokens.colors.onSecondary} /> : undefined}
              >
                {effectivePriority === 'P3'
                  ? (isPlaceholderAddress(ticketProperty)
                    ? 'Add your address to continue'
                    : `Continue to Payment${priceQuote ? ` · ₹${priceQuote.total.toLocaleString('en-IN')}` : ''}`)
                  : 'Raise Service Ticket'}
              </Button>
            ) : step === 2 ? (
              <Text variant="bodySm" color="onSurfaceVariant" align="center">Tap an AC unit to continue</Text>
            ) : (
              <Button
                pill
                variant="primary"
                fullWidth
                disabled={!stepValid}
                onPress={goNext}
                rightIcon={<ArrowRight size={16} color={tokens.colors.onSecondary} />}
              >
                Continue
              </Button>
            )}
            {/* Invisible tap-catcher over a blocked Continue/Submit button —
                a disabled Pressable swallows touches silently, so mashing an
                incomplete step should still shake + buzz (CLAUDE.md Phase 20,
                FEEDBACK). Step 2 has no button here (auto-advances on tap). */}
            {step !== 2 && (
              step === 4
                ? (!step4Valid || (effectivePriority === 'P3' && (pricingLoading || isPlaceholderAddress(ticketProperty)))) && (
                  <PressableScale
                    style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    }}
                    onPress={() => { haptics.error(); setBlockedShake((k) => (k ?? 0) + 1); }}
                  />
                )
                : !stepValid && (
                  <PressableScale
                    style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    }}
                    onPress={() => { haptics.error(); setBlockedShake((k) => (k ?? 0) + 1); }}
                  />
                )
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
