import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Linking, RefreshControl, ScrollView, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import Animated, {
  Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import {
  Bell, Briefcase, Car, MapPin, CheckCircle2, AlertTriangle, Timer, Hammer, House,
  HandHelping, PackagePlus, Phone, ChevronRight, ShieldAlert, RefreshCw, Clock, Navigation,
} from 'lucide-react-native';

import { AppShell } from '@/components/shell/AppShell';
import {
  Text, Button, Skeleton, PressableScale, EmptyState,
} from '@/components/primitives';
import { Input, TextArea, Select } from '@/components/primitives/Input';
import { Sheet, SheetRef, SelectOption } from '@/components/primitives/Sheet';
import { ShiftToggle } from '@/components/ui/ShiftToggle';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useHaptics } from '@/hooks/useHaptics';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import useStompTopic from '@/hooks/useStompTopic';
import {
  engineer as engineerApi, offers as offersApi, parts as partsApi, maps as mapsApi,
} from '@/lib/api';
import type { AssignmentOffer, EngineerDashboardResponse, EngineerJobDto } from '@/types/api';

// Ported from ../../aes-frontend/src/app/engineer/page.js +
// engineer.module.css. THE MOST MOBILE-NATIVE SCREEN IN THE PRODUCT — a
// field engineer uses this one-handed, on a rooftop, in the sun, on 4G.
// Every string, section and status-machine rule below is copied verbatim;
// MOBILE-ONLY additions (Navigate/Call buttons, 48px touch targets,
// high-contrast tones, strong haptics, the pulsing/haptic countdown ring)
// are called out inline.

const PROBLEM_LABEL: Record<string, string> = {
  NOT_COOLING: 'AC Not Cooling',
  NOISE: 'Loud Noise',
  LEAKING: 'Water Leak',
  NOT_TURNING_ON: 'Not Turning On',
  NO_AIRFLOW: 'No Airflow',
  REMOTE_WIFI: 'Remote / Wi-Fi',
  OTHER: 'Other',
};

const STATUS_LABEL: Record<string, string> = {
  ACKNOWLEDGED: 'AWAITING DISPATCH',
  ASSIGNED: 'ASSIGNED',
  EN_ROUTE: 'EN ROUTE',
  ON_SITE: 'ON SITE',
  IN_PROGRESS: 'WORKING',
  WAITING_PART: 'WAITING PART',
  RESOLVED: 'RESOLVED',
};

const CANNOT_ATTEND_REASONS: SelectOption[] = [
  { label: 'Vehicle breakdown', value: 'Vehicle breakdown' },
  { label: 'Illness', value: 'Illness' },
  { label: 'Family emergency', value: 'Family emergency' },
  { label: 'Overlapping job ran long', value: 'Overlapping job ran long' },
  { label: 'Other', value: 'Other' },
];
const NEED_HELP_REASONS: SelectOption[] = [
  { label: 'Complex VRF system', value: 'Complex VRF system' },
  { label: 'Need a second pair of hands', value: 'Need a second pair of hands' },
  { label: 'Unsafe access / height work', value: 'Unsafe access / height work' },
  { label: 'Customer dispute', value: 'Customer dispute' },
  { label: 'Other', value: 'Other' },
];
const URGENCY_OPTIONS: SelectOption[] = [
  { label: 'NORMAL', value: 'NORMAL' },
  { label: 'HIGH', value: 'HIGH' },
  { label: 'EMERGENCY', value: 'EMERGENCY' },
];

// Ported verbatim from ../../aes-frontend/src/app/engineer/page.js.
function expirySec(s: number | null | undefined): string {
  if (s == null) return '—';
  if (s <= 0) return 'expired';
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
function timeOf(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

type BusyMap = Record<string, string>;
type Styles = ReturnType<typeof makeStyles>;
type Tokens = ReturnType<typeof useTheme>['tokens'];
type SheetKind = 'cannot' | 'help' | 'part' | 'decline';

export default function EngineerScreen() {
  const router = useRouter();
  const toast = useToast();
  const haptics = useHaptics();
  const { user, loading: authLoading, fetchUser } = useAuth();
  const { tokens } = useTheme();
  const { isPhone } = useBreakpoint();
  const styles = useThemedStyles(makeStyles);

  const [data, setData] = useState<EngineerDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<BusyMap>({});

  const [activeSheet, setActiveSheet] = useState<SheetKind | null>(null);
  const [activeJob, setActiveJob] = useState<EngineerJobDto | null>(null);
  const [activeOffer, setActiveOffer] = useState<AssignmentOffer | null>(null);
  const sheetRef = useRef<SheetRef>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (!['SITE_ENGINEER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      router.replace(defaultRouteForRole(user.role));
    }
  }, [user, authLoading, router]);

  const fetchAll = useCallback(async (silent = false) => {
    try {
      const d = await engineerApi.dashboard() as EngineerDashboardResponse;
      setData(d);
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : 'Could not load dashboard');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!user) return;
    fetchAll();
    const id = setInterval(() => fetchAll(true), 12000);
    return () => clearInterval(id);
  }, [user, fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll(true);
    setRefreshing(false);
  }, [fetchAll]);

  useStompTopic(user ? `/topic/user/${user.id}/offers` : null, () => fetchAll(true));

  const setBusyFor = (key: string, label: string) => setBusy((b) => ({ ...b, [key]: label }));
  const clearBusy = (key: string) => setBusy((b) => { const { [key]: _drop, ...rest } = b; return rest; });

  const acceptOffer = async (o: AssignmentOffer) => {
    setBusyFor(`offer-${o.id}`, 'accept');
    try {
      await offersApi.accept(o.id);
      haptics.success();
      toast.success(`Accepted ${o.ticketNumber}`);
      await fetchAll();
    } catch (e) {
      haptics.error();
      toast.error(e instanceof Error ? e.message : 'Could not accept.');
    } finally {
      clearBusy(`offer-${o.id}`);
    }
  };

  const openDecline = (o: AssignmentOffer) => { setActiveOffer(o); setActiveSheet('decline'); sheetRef.current?.present(); };

  const submitDecline = async (reason: string) => {
    if (!activeOffer) return;
    const o = activeOffer;
    setBusyFor(`offer-${o.id}`, 'decline');
    try {
      await offersApi.decline(o.id, { reason, comment: reason });
      haptics.tapMedium();
      toast.success('Declined');
      closeSheet();
      await fetchAll();
    } catch (e) {
      haptics.error();
      toast.error(e instanceof Error ? e.message : 'Could not decline.');
    } finally {
      clearBusy(`offer-${o.id}`);
    }
  };

  const mark = async (job: EngineerJobDto, action: 'en-route' | 'on-site' | 'in-progress') => {
    setBusyFor(`job-${job.ticketNumber}`, action);
    try {
      if (action === 'en-route') await engineerApi.enRoute(job.ticketNumber);
      if (action === 'on-site') await engineerApi.onSite(job.ticketNumber);
      if (action === 'in-progress') await engineerApi.inProgress(job.ticketNumber);
      haptics.tapMedium();
      toast.success(`${job.ticketNumber} marked ${action.replace('-', ' ')}`);
      await fetchAll();
    } catch (e) {
      haptics.error();
      toast.error(e instanceof Error ? e.message : `Could not mark ${action}`);
    } finally {
      clearBusy(`job-${job.ticketNumber}`);
    }
  };

  const closeSheet = () => { sheetRef.current?.dismiss(); };
  const onSheetDismiss = () => { setActiveSheet(null); setActiveJob(null); setActiveOffer(null); };

  const openCannotAttend = (job: EngineerJobDto) => { setActiveJob(job); setActiveSheet('cannot'); sheetRef.current?.present(); };
  const openNeedHelp = (job: EngineerJobDto) => { setActiveJob(job); setActiveSheet('help'); sheetRef.current?.present(); };
  const openRaisePart = (job: EngineerJobDto) => { setActiveJob(job); setActiveSheet('part'); sheetRef.current?.present(); };

  const submitCannotAttend = async (reason: string, details: string) => {
    if (!activeJob) return;
    const job = activeJob;
    try {
      await engineerApi.cannotAttend(job.ticketNumber, { reason, details });
      haptics.warning();
      toast.success(`Reported on ${job.ticketNumber}. CRM is being notified.`);
      closeSheet();
      await fetchAll();
    } catch (e) {
      haptics.error();
      toast.error(e instanceof Error ? e.message : 'Could not submit.');
    }
  };

  const submitNeedHelp = async (reason: string, details: string) => {
    if (!activeJob) return;
    const job = activeJob;
    try {
      await engineerApi.needHelp(job.ticketNumber, { reason, details });
      haptics.tapMedium();
      toast.success('Service Manager is being looped in.');
      closeSheet();
      await fetchAll();
    } catch (e) {
      haptics.error();
      toast.error(e instanceof Error ? e.message : 'Could not submit.');
    }
  };

  const submitRaisePart = async (payload: {
    name: string; qty: number; unitCost: number; urgency: string; notes: string;
  }) => {
    if (!activeJob) return;
    const job = activeJob;
    try {
      await partsApi.raise(job.ticketNumber, {
        partName: payload.name,
        quantity: payload.qty,
        unitCost: payload.unitCost,
        urgency: payload.urgency,
        notes: payload.notes,
      });
      haptics.success();
      toast.success('Part request raised. CRM / SM will approve.');
      closeSheet();
      await fetchAll();
    } catch (e) {
      haptics.error();
      toast.error(e instanceof Error ? e.message : 'Could not raise part.');
    }
  };

  const openRoute = async (job: EngineerJobDto) => {
    haptics.tapLight();
    try {
      const res = await mapsApi.route(job.ticketNumber);
      const url = res?.directionsUrl
        || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.locality || job.propertyLabel || '')}`;
      await Linking.openURL(url);
    } catch {
      await Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.locality || job.propertyLabel || '')}`,
      );
    }
  };

  const callCustomer = (phone?: string) => {
    if (!phone) return;
    haptics.tapLight();
    Linking.openURL(`tel:${phone}`);
  };

  const hero = (
    <View style={[styles.heroRow, isPhone && styles.heroRowPhone]}>
      <View style={styles.heroText}>
        <Text variant="headlineXl" color="onSurfaceStrong">Today&apos;s Pool</Text>
        <Text variant="bodyLg" color="onSurfaceVariant">
          Manage your assignments and dispatch offers.
        </Text>
      </View>
      <View style={styles.heroActions}>
        <ShiftToggle
          onShift={!!user?.onShift}
          compact
          activeWork={{ tickets: data?.activeJobs ?? 0, offers: data?.pendingOffers ?? 0 }}
          onChange={() => { fetchUser(); fetchAll(); }}
        />
        <PressableScale
          scaleTo={0.9}
          onPress={() => { haptics.tapLight(); fetchAll(); }}
          style={[styles.refreshBtn, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
        >
          <RefreshCw size={18} color={tokens.colors.onSurfaceVariant} />
        </PressableScale>
      </View>
    </View>
  );

  if (authLoading || !user || (loading && !data)) {
    return (
      <AppShell hero={hero} focused>
        <View style={{ gap: space[4] }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={140} radius={16} />)}
        </View>
      </AppShell>
    );
  }

  const tiles: { key: string; label: string; value: number; icon: typeof Bell; featured?: boolean }[] = [
    {
      key: 'offers', label: 'Offers', value: data?.pendingOffers ?? 0, icon: Bell, featured: (data?.pendingOffers ?? 0) > 0,
    },
    { key: 'my_jobs', label: 'My Jobs', value: data?.activeJobs ?? 0, icon: Briefcase },
    { key: 'en_route', label: 'En Route', value: data?.enRoute ?? 0, icon: Car },
    { key: 'on_site', label: 'On Site', value: data?.onSite ?? 0, icon: MapPin },
    { key: 'done_today', label: 'Done Today', value: data?.resolvedToday ?? 0, icon: CheckCircle2 },
  ];

  return (
    <AppShell
      hero={hero}
      focused
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.secondary} />}
    >
      {/* ── Stat tiles ─────────────────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tilesRow}>
        {tiles.map((t) => (
          <View
            key={t.key}
            style={[
              styles.tile,
              { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant },
              t.featured && { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },
            ]}
          >
            <View style={styles.tileHead}>
              <Text style={[styles.tileLabel, { color: t.featured ? 'rgba(247,244,238,0.72)' : tokens.colors.onSurfaceVariant }]}>
                {t.label}
              </Text>
              <t.icon size={18} strokeWidth={2} color={t.featured ? '#F7F4EE' : tokens.colors.onSurfaceVariant} />
            </View>
            <Text style={[styles.tileValue, { color: t.featured ? '#F7F4EE' : tokens.colors.onSurfaceStrong }]}>
              {t.value}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* ── Pending dispatch offers ────────────────────────────────── */}
      <View style={styles.section}>
        <SectionHead icon={Bell} title="Pending Dispatch Offers" tokens={tokens} styles={styles} />
        {(data?.offers ?? []).length === 0 ? (
          <View style={[styles.empty, { borderColor: tokens.colors.outlineVariant }]}>
            <CheckCircle2 size={28} color={tokens.colors.onSurfaceVariant} strokeWidth={1.5} />
            <Text variant="bodyMd" color="onSurfaceVariant" align="center">
              No pending offers. CRM will route new work here.
            </Text>
          </View>
        ) : (
          <View style={{ gap: space[4] }}>
            <AnimatePresence>
              {(data?.offers ?? []).map((o) => (
                <MotiView
                  key={o.id}
                  from={{ opacity: 0, translateY: -12, scale: 0.97 }}
                  animate={{ opacity: 1, translateY: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'timing', duration: 240 }}
                >
                  <OfferCard
                    offer={o}
                    busy={busy[`offer-${o.id}`]}
                    onAccept={() => acceptOffer(o)}
                    onDecline={() => openDecline(o)}
                    styles={styles}
                    tokens={tokens}
                    haptics={haptics}
                  />
                </MotiView>
              ))}
            </AnimatePresence>
          </View>
        )}
      </View>

      {/* ── Resolved today ──────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionHead
          icon={CheckCircle2}
          title="Resolved Today"
          count={(data?.resolvedTodayList ?? []).length || undefined}
          tokens={tokens}
          styles={styles}
        />
        {(data?.resolvedTodayList ?? []).length === 0 ? (
          <Text variant="bodySm" color="onSurfaceVariant">No resolutions yet today.</Text>
        ) : (
          <View style={[styles.resolvedCard, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
            {(data?.resolvedTodayList ?? []).slice(0, 6).map((j) => (
              <PressableScale
                key={j.ticketNumber}
                scaleTo={0.98}
                onPress={() => router.push(`/tickets/${j.ticketNumber}`)}
                style={styles.resolvedRow}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: font('body', 600), fontSize: 14, color: tokens.colors.onSurface }}>
                    {PROBLEM_LABEL[j.problemCategory] || j.problemCategory || 'Service'}
                  </Text>
                  <Text style={{ fontFamily: font('mono', 500), fontSize: 10, letterSpacing: 0.08 * 10, color: tokens.colors.onSurfaceVariant }}>
                    #{j.ticketNumber} · {timeOf(j.resolvedAt)}
                  </Text>
                </View>
                <ChevronRight size={16} color={tokens.colors.onSurfaceVariant} />
              </PressableScale>
            ))}
          </View>
        )}
      </View>

      {/* ── My active jobs ──────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionHead
          icon={Briefcase}
          title="My Active Jobs"
          count={(data?.jobs ?? []).length || undefined}
          tokens={tokens}
          styles={styles}
        />
        {(data?.jobs ?? []).length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={28} color={tokens.colors.primary} strokeWidth={1.5} />}
            headline="Nothing active"
            body="No active jobs. Take a breather — new work will appear here."
          />
        ) : (
          <View style={{ gap: space[4] }}>
            <AnimatePresence>
              {(data?.jobs ?? []).map((j, i) => (
                <MotiView
                  key={j.ticketNumber}
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'timing', duration: 220, delay: i * 50 }}
                >
                  <JobCard
                    job={j}
                    busy={busy[`job-${j.ticketNumber}`]}
                    onMark={(action) => mark(j, action)}
                    onCannotAttend={() => openCannotAttend(j)}
                    onNeedHelp={() => openNeedHelp(j)}
                    onRaisePart={() => openRaisePart(j)}
                    onNavigate={() => openRoute(j)}
                    onCall={() => callCustomer(j.customerPhone)}
                    onDetail={() => router.push(`/tickets/${j.ticketNumber}`)}
                    styles={styles}
                    tokens={tokens}
                  />
                </MotiView>
              ))}
            </AnimatePresence>
          </View>
        )}
      </View>

      <Sheet ref={sheetRef} snapPoints={activeSheet === 'decline' ? ['45%'] : ['70%']} onDismiss={onSheetDismiss}>
        {activeSheet === 'cannot' && activeJob ? (
          <ReasonSheetContent
            icon={AlertTriangle}
            title={`Cannot attend ${activeJob.ticketNumber}`}
            reasonLabel="Reason*"
            reasonPlaceholder="Tell us why so the CRM can re-route."
            reasonOptions={CANNOT_ATTEND_REASONS}
            submitLabel="Submit"
            submitVariant="danger"
            onCancel={closeSheet}
            onSubmit={submitCannotAttend}
            styles={styles}
            tokens={tokens}
          />
        ) : null}
        {activeSheet === 'help' && activeJob ? (
          <ReasonSheetContent
            icon={ShieldAlert}
            title={`Need help on ${activeJob.ticketNumber}`}
            subtitle="A senior engineer / Service Manager will get a notification. You remain assigned to the ticket."
            reasonLabel="Reason*"
            reasonPlaceholder="Add a short reason."
            reasonOptions={NEED_HELP_REASONS}
            submitLabel="Request help"
            submitVariant="primary"
            onCancel={closeSheet}
            onSubmit={submitNeedHelp}
            styles={styles}
            tokens={tokens}
          />
        ) : null}
        {activeSheet === 'part' && activeJob ? (
          <RaisePartSheetContent
            ticketNumber={activeJob.ticketNumber}
            onCancel={closeSheet}
            onSubmit={submitRaisePart}
            styles={styles}
            tokens={tokens}
          />
        ) : null}
        {activeSheet === 'decline' && activeOffer ? (
          <DeclineOfferSheetContent
            ticketNumber={activeOffer.ticketNumber || ''}
            onCancel={closeSheet}
            onSubmit={submitDecline}
            styles={styles}
            tokens={tokens}
          />
        ) : null}
      </Sheet>
    </AppShell>
  );
}

/* ─── Section head ───────────────────────────────────────────────────── */
function SectionHead({
  icon: Icon, title, count, tokens, styles,
}: { icon: typeof Bell; title: string; count?: number; tokens: Tokens; styles: Styles }) {
  return (
    <View style={[styles.sectionHead, { borderBottomColor: tokens.colors.outlineVariant }]}>
      <View style={styles.sectionTitleRow}>
        <Icon size={18} color={tokens.colors.secondaryInk} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {count != null ? (
        <View style={[styles.countPill, { backgroundColor: tokens.colors.secondarySoft }]}>
          <Text style={{ fontFamily: font('mono', 600), fontSize: 11, color: tokens.colors.secondaryInk }}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ─── Offer countdown ring — MOBILE ADDITION ───────────────────────────
 * Depletes smoothly against the seconds snapshot the API returned on the
 * last poll; pulses under 60s and fires a single Warning haptic crossing
 * the 30s mark (per the phase brief). Re-anchors whenever a fresh
 * `secondsUntilExpiry` arrives from a poll/STOMP refresh. */
const RING_R = 17;
const RING_C = 2 * Math.PI * RING_R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function OfferCountdownRing({
  seconds, tokens, haptics,
}: { seconds: number | null | undefined; tokens: Tokens; haptics: ReturnType<typeof useHaptics> }) {
  const targetMs = useMemo(() => (seconds != null ? Date.now() + seconds * 1000 : null), [seconds]);
  const initialRef = useRef<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const warnedRef = useRef(false);

  useEffect(() => {
    if (targetMs == null) return undefined;
    if (initialRef.current == null || seconds != null) initialRef.current = seconds ?? initialRef.current;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs, seconds]);

  const remaining = targetMs != null ? Math.max(0, (targetMs - now) / 1000) : null;
  const total = initialRef.current && initialRef.current > 0 ? initialRef.current : 120;
  const fraction = remaining != null ? Math.max(0, Math.min(1, remaining / total)) : 1;

  const progress = useSharedValue(fraction);
  useEffect(() => {
    progress.value = withTiming(fraction, { duration: 900, easing: Easing.linear });
  }, [fraction, progress]);

  const critical = remaining != null && remaining > 0 && remaining < 60;

  useEffect(() => {
    if (remaining != null && remaining <= 30 && remaining > 0) {
      if (!warnedRef.current) { warnedRef.current = true; haptics.warning(); }
    } else if (remaining != null && remaining > 30) {
      warnedRef.current = false;
    }
  }, [remaining, haptics]);

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);
  useEffect(() => {
    if (critical) {
      pulseScale.value = withRepeat(
        withSequence(withTiming(1.08, { duration: 500 }), withTiming(1, { duration: 500 })),
        -1,
        true,
      );
      pulseOpacity.value = withRepeat(
        withSequence(withTiming(0.55, { duration: 500 }), withTiming(1, { duration: 500 })),
        -1,
        true,
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 150 });
      pulseOpacity.value = withTiming(1, { duration: 150 });
    }
  }, [critical, pulseScale, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_C * (1 - progress.value),
  }));

  const ringColor = critical ? tokens.colors.error : tokens.colors.secondaryInk;

  return (
    <Animated.View style={[{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, pulseStyle]}>
      <Svg width={40} height={40} style={{ position: 'absolute' }}>
        <Circle cx={20} cy={20} r={RING_R} stroke={tokens.colors.outlineVariant} strokeWidth={3} fill="none" />
        <AnimatedCircle
          cx={20}
          cy={20}
          r={RING_R}
          stroke={ringColor}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${RING_C} ${RING_C}`}
          animatedProps={animatedProps}
          fill="none"
          rotation={-90}
          origin="20, 20"
        />
      </Svg>
      <Text style={{ fontFamily: font('mono', 700), fontSize: 9, color: ringColor }}>
        {expirySec(remaining)}
      </Text>
    </Animated.View>
  );
}

/* ─── Offer card ─────────────────────────────────────────────────────── */
function OfferCard({
  offer, busy, onAccept, onDecline, styles, tokens, haptics,
}: {
  offer: AssignmentOffer; busy?: string; onAccept: () => void; onDecline: () => void;
  styles: Styles; tokens: Tokens; haptics: ReturnType<typeof useHaptics>;
}) {
  return (
    <View style={[styles.offerCard, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
      <View style={styles.offerHead}>
        <View style={styles.offerTags}>
          <PriorityChip priority={offer.ticketPriority} styles={styles} tokens={tokens} />
          <View style={[styles.dispatchTag, { backgroundColor: tokens.colors.surfaceContainer }]}>
            <Text style={{ fontFamily: font('mono', 600), fontSize: 10, letterSpacing: 0.12 * 10, color: tokens.colors.secondaryInk }}>
              DISPATCH
            </Text>
          </View>
        </View>
        <OfferCountdownRing seconds={offer.secondsUntilExpiry} tokens={tokens} haptics={haptics} />
      </View>

      <Text style={{ fontFamily: font('display', 600), fontSize: 19, color: tokens.colors.onSurface }}>
        {PROBLEM_LABEL[offer.ticketProblemCategory || ''] || offer.ticketProblemCategory || 'Service'}
      </Text>
      <Text style={{ fontFamily: font('mono', 500), fontSize: 11, letterSpacing: 0.10 * 11, color: tokens.colors.onSurfaceVariant }}>
        #{offer.ticketNumber}
      </Text>

      <View style={styles.offerMetaRow}>
        <Briefcase size={12} color={tokens.colors.onSurfaceVariant} />
        <Text style={{ fontSize: 13, color: tokens.colors.onSurfaceVariant }}>Property TBD</Text>
      </View>

      {offer.note ? (
        <View style={[styles.offerNote, { backgroundColor: tokens.colors.surfaceContainerLow, borderLeftColor: tokens.colors.secondaryLight }]}>
          <Text style={{ fontFamily: font('body', 400), fontSize: 13, fontStyle: 'italic', color: tokens.colors.onSurfaceVariant }}>
            &quot;{offer.note}&quot;
          </Text>
        </View>
      ) : null}

      <View style={[styles.offerFootRow, { borderTopColor: tokens.colors.outlineVariant }]}>
        <Text style={{ fontFamily: font('mono', 500), fontSize: 11, letterSpacing: 0.08 * 11, color: tokens.colors.onSurfaceVariant }}>
          From {offer.offeredByName} ({offer.offeredByRole})
        </Text>
      </View>

      <View style={styles.offerActions}>
        <View style={{ flex: 1 }}>
          <Button
            variant="outline"
            fullWidth
            size="lg"
            disabled={!!busy}
            onPress={onDecline}
          >
            Decline
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button
            variant="primary"
            fullWidth
            size="lg"
            disabled={!!busy}
            loading={busy === 'accept'}
            leftIcon={<CheckCircle2 size={16} color={tokens.colors.onSecondary} />}
            onPress={onAccept}
          >
            Accept Job
          </Button>
        </View>
      </View>
    </View>
  );
}

function PriorityChip({ priority, styles, tokens }: { priority?: string; styles: Styles; tokens: Tokens }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    P1: { label: 'P1 · URGENT', bg: tokens.colors.secondarySoft, fg: tokens.colors.secondaryInk },
    P2: { label: 'P2 · HIGH', bg: tokens.colors.tertiarySoft, fg: tokens.colors.tertiaryStrong },
    P3: { label: 'P3 · STANDARD', bg: tokens.colors.surfaceContainer, fg: tokens.colors.secondaryInk },
  };
  const m = (priority && map[priority]) || { label: priority || 'STANDARD', bg: tokens.colors.surfaceContainer, fg: tokens.colors.secondaryInk };
  return (
    <View style={[styles.priChip, { backgroundColor: m.bg }]}>
      <Text style={{ fontFamily: font('mono', 700), fontSize: 10, letterSpacing: 0.12 * 10, color: m.fg }}>{m.label}</Text>
    </View>
  );
}

function StatusPill({ status, styles, tokens }: { status: string; styles: Styles; tokens: Tokens }) {
  const label = STATUS_LABEL[status] || status || '—';
  // High-contrast solid fills — this screen gets used in direct sunlight.
  const tone = status === 'EN_ROUTE' || status === 'ON_SITE' || status === 'IN_PROGRESS'
    ? { bg: tokens.colors.primary, fg: tokens.colors.onPrimary }
    : status === 'RESOLVED'
      ? { bg: tokens.colors.success, fg: '#ffffff' }
      : { bg: tokens.colors.secondary, fg: tokens.colors.onSecondary };
  return (
    <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
      <Text style={{ fontFamily: font('mono', 700), fontSize: 10, letterSpacing: 0.12 * 10, color: tone.fg }}>{label}</Text>
    </View>
  );
}

/* ─── Status progress track — MOTION: animates on transition ──────────── */
const JOB_STEPS = ['ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS'] as const;
function JobProgressTrack({ status, tokens }: { status: string; tokens: Tokens }) {
  const stepIndex = Math.max(0, JOB_STEPS.indexOf(status as typeof JOB_STEPS[number]));
  const pct = status === 'RESOLVED' ? 100 : ((stepIndex + 1) / JOB_STEPS.length) * 100;
  const width = useSharedValue(pct);
  useEffect(() => {
    width.value = withTiming(pct, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [pct, width]);
  const barStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return (
    <View style={{ height: 4, borderRadius: radius.full, backgroundColor: tokens.colors.surfaceContainer, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', backgroundColor: tokens.colors.secondary, borderRadius: radius.full }, barStyle]} />
    </View>
  );
}

/* ─── Job card ────────────────────────────────────────────────────────── */
function JobCard({
  job, busy, onMark, onCannotAttend, onNeedHelp, onRaisePart, onNavigate, onCall, onDetail, styles, tokens,
}: {
  job: EngineerJobDto; busy?: string;
  onMark: (action: 'en-route' | 'on-site' | 'in-progress') => void;
  onCannotAttend: () => void; onNeedHelp: () => void; onRaisePart: () => void;
  onNavigate: () => void; onCall: () => void; onDetail: () => void;
  styles: Styles; tokens: Tokens;
}) {
  const stage = job.status;
  const canEnRoute = stage === 'ASSIGNED';
  const canOnSite = stage === 'ASSIGNED' || stage === 'EN_ROUTE';
  const canStart = stage === 'ASSIGNED' || stage === 'EN_ROUTE' || stage === 'ON_SITE';

  return (
    <View style={[styles.jobCard, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
      <View style={[styles.jobAccent, { backgroundColor: tokens.colors.secondary }]} />
      <View style={styles.jobHead}>
        <View style={styles.jobTags}>
          <StatusPill status={job.status} styles={styles} tokens={tokens} />
          <Text style={{ fontFamily: font('mono', 500), fontSize: 11, letterSpacing: 0.08 * 11, color: tokens.colors.onSurfaceVariant }}>
            #{job.ticketNumber}
          </Text>
        </View>
        {job.scheduledDate ? (
          <View style={styles.jobScheduled}>
            <Clock size={12} color={tokens.colors.onSurfaceVariant} />
            <Text style={{ fontFamily: font('mono', 400), fontSize: 11, letterSpacing: 0.06 * 11, color: tokens.colors.onSurfaceVariant }}>
              {job.scheduledDate}{job.scheduledSlot ? ` · ${job.scheduledSlot}` : ''}
            </Text>
          </View>
        ) : null}
      </View>

      <JobProgressTrack status={job.status} tokens={tokens} />

      <Text style={{ fontFamily: font('display', 600), fontSize: 20, color: tokens.colors.onSurface }}>
        {PROBLEM_LABEL[job.problemCategory] || job.problemCategory || 'Service'}
      </Text>

      <View style={{ gap: space[1] }}>
        {job.propertyLabel ? (
          <View style={styles.jobMetaLine}>
            <MapPin size={12} color={tokens.colors.onSurfaceVariant} />
            <Text style={{ fontSize: 13, color: tokens.colors.onSurfaceVariant }}>{job.propertyLabel}</Text>
          </View>
        ) : null}
        {job.acRoomLabel ? (
          <View style={styles.jobMetaLine}>
            <Hammer size={12} color={tokens.colors.onSurfaceVariant} />
            <Text style={{ fontSize: 13, color: tokens.colors.onSurfaceVariant }}>
              {job.acBrand} {job.acModel} · {job.acRoomLabel}
            </Text>
          </View>
        ) : null}
        {job.customerName ? (
          <View style={styles.jobMetaLine}>
            <Briefcase size={12} color={tokens.colors.onSurfaceVariant} />
            <Text style={{ fontSize: 13, color: tokens.colors.onSurfaceVariant }}>{job.customerName}</Text>
          </View>
        ) : null}
      </View>

      {job.problemDescription ? (
        <Text style={[styles.jobBody, { backgroundColor: tokens.colors.surfaceContainerLow, color: tokens.colors.onSurfaceVariant }]}>
          {job.problemDescription}
        </Text>
      ) : null}

      {/* MOBILE-ONLY: big Call / Navigate touch targets, min 48×48. */}
      <View style={styles.quickRow}>
        {job.customerPhone ? (
          <PressableScale
            scaleTo={0.92}
            onPress={onCall}
            style={[styles.iconChipBig, { backgroundColor: tokens.colors.success }]}
            accessibilityRole="button"
            accessibilityLabel="Call customer"
          >
            <Phone size={20} color="#ffffff" />
          </PressableScale>
        ) : null}
        <PressableScale
          scaleTo={0.92}
          onPress={onNavigate}
          style={[styles.iconChipBig, { backgroundColor: tokens.colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Navigate"
        >
          <Navigation size={20} color={tokens.colors.onPrimary} />
        </PressableScale>
        <PressableScale scaleTo={0.98} onPress={onDetail} style={styles.detailLink}>
          <Text style={{ fontFamily: font('body', 600), fontSize: 13, color: tokens.colors.secondaryInk }}>Detail</Text>
          <ChevronRight size={14} color={tokens.colors.secondaryInk} />
        </PressableScale>
      </View>

      <View style={[styles.jobActions, { borderTopColor: tokens.colors.outlineVariant }]}>
        {canEnRoute ? (
          <View style={styles.actionBtn}>
            <Button
              variant="primary"
              fullWidth
              disabled={!!busy}
              loading={busy === 'en-route'}
              leftIcon={<Car size={16} color={tokens.colors.onSecondary} />}
              onPress={() => onMark('en-route')}
            >
              En Route
            </Button>
          </View>
        ) : null}
        {canOnSite ? (
          <View style={styles.actionBtn}>
            <Button
              variant="primary"
              fullWidth
              disabled={!!busy}
              loading={busy === 'on-site'}
              leftIcon={<House size={16} color={tokens.colors.onSecondary} />}
              onPress={() => onMark('on-site')}
            >
              {stage === 'EN_ROUTE' ? 'Arrived' : 'On Site'}
            </Button>
          </View>
        ) : null}
        {canStart ? (
          <View style={styles.actionBtn}>
            <Button
              variant="primary"
              fullWidth
              disabled={!!busy}
              loading={busy === 'in-progress'}
              leftIcon={<Hammer size={16} color={tokens.colors.onSecondary} />}
              onPress={() => onMark('in-progress')}
            >
              Start Work
            </Button>
          </View>
        ) : null}
        <View style={styles.actionBtn}>
          <Button variant="soft" fullWidth leftIcon={<PackagePlus size={16} color={tokens.colors.primary} />} onPress={onRaisePart}>
            Need Part
          </Button>
        </View>
        <View style={styles.actionBtn}>
          <Button variant="soft" fullWidth leftIcon={<HandHelping size={16} color={tokens.colors.primary} />} onPress={onNeedHelp}>
            Need Help
          </Button>
        </View>
        <View style={styles.actionBtn}>
          <Button
            variant="outline"
            fullWidth
            leftIcon={<AlertTriangle size={16} color={tokens.colors.error} />}
            onPress={onCannotAttend}
          >
            <Text style={{ fontFamily: font('body', 600), fontSize: 13, color: tokens.colors.error }}>Can&apos;t Attend</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}

/* ─── Reason sheets — Cannot Attend / Need Help ─────────────────────────
 * Ported verbatim: same reason/details fields, same validation. The web's
 * free-text reason input is offered here as a quick-pick list (RN has no
 * datalist) plus a free-text fallback via "Other". */
function ReasonSheetContent({
  icon: Icon, title, subtitle, reasonLabel, reasonPlaceholder, reasonOptions, submitLabel, submitVariant, onCancel, onSubmit, styles, tokens,
}: {
  icon: typeof AlertTriangle; title: string; subtitle?: string; reasonLabel: string; reasonPlaceholder: string;
  reasonOptions: SelectOption[]; submitLabel: string; submitVariant: 'primary' | 'danger';
  onCancel: () => void; onSubmit: (reason: string, details: string) => Promise<void>;
  styles: Styles; tokens: Tokens;
}) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const finalReason = reason === 'Other' ? customReason.trim() : reason;
    if (!finalReason) { toast.warning('Pick or enter a reason so the CRM can act.'); return; }
    setBusy(true);
    try {
      await onSubmit(finalReason, details);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.sheetBody}>
      <View style={styles.sheetHead}>
        <Icon size={18} color={tokens.colors.secondaryInk} />
        <Text variant="headlineSm">{title}</Text>
      </View>
      {subtitle ? <Text variant="bodySm" color="onSurfaceVariant">{subtitle}</Text> : null}

      <Text style={styles.formLabel}>{reasonLabel}</Text>
      <View style={styles.chipWrap}>
        {reasonOptions.map((o) => (
          <PressableScale
            key={o.value}
            scaleTo={0.96}
            onPress={() => setReason(o.value)}
            style={[
              styles.reasonChip,
              { backgroundColor: reason === o.value ? tokens.colors.secondary : tokens.colors.surfaceContainer },
            ]}
          >
            <Text style={{
              fontFamily: font('body', 600), fontSize: 13, color: reason === o.value ? tokens.colors.onSecondary : tokens.colors.onSurfaceVariant,
            }}
            >
              {o.label}
            </Text>
          </PressableScale>
        ))}
      </View>
      {reason === 'Other' ? (
        <Input placeholder={reasonPlaceholder} value={customReason} onChangeText={setCustomReason} />
      ) : null}

      <TextArea label="Details (optional)" minHeight={72} value={details} onChangeText={setDetails} multiline />

      <View style={styles.sheetFoot}>
        <View style={{ flex: 1 }}>
          <Button variant="outline" fullWidth size="lg" onPress={onCancel} disabled={busy}>Cancel</Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button variant={submitVariant} fullWidth size="lg" onPress={submit} loading={busy}>{submitLabel}</Button>
        </View>
      </View>
    </View>
  );
}

/* ─── Raise part sheet ──────────────────────────────────────────────── */
function RaisePartSheetContent({
  ticketNumber, onCancel, onSubmit, styles, tokens,
}: {
  ticketNumber: string;
  onCancel: () => void;
  onSubmit: (payload: { name: string; qty: number; unitCost: number; urgency: string; notes: string }) => Promise<void>;
  styles: Styles; tokens: Tokens;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [urgency, setUrgency] = useState('NORMAL');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const total = (Number(qty) || 0) * (Number(unitCost) || 0);

  const submit = async () => {
    if (!name.trim()) { toast.warning('Part name is required.'); return; }
    if (Number(unitCost) <= 0) { toast.warning('Enter a unit cost.'); return; }
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(), qty: Number(qty) || 1, unitCost: Number(unitCost), urgency, notes,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.sheetBody}>
      <View style={styles.sheetHead}>
        <PackagePlus size={18} color={tokens.colors.secondaryInk} />
        <Text variant="headlineSm">Raise part — {ticketNumber}</Text>
      </View>

      <Input label="Part name*" placeholder="Capacitor 35µF" value={name} onChangeText={setName} />
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <View style={{ flex: 1 }}>
          <Input label="Quantity" keyboardType="numeric" value={qty} onChangeText={(v) => setQty(v.replace(/[^0-9]/g, ''))} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Unit cost (₹)*" keyboardType="numeric" value={unitCost} onChangeText={(v) => setUnitCost(v.replace(/[^0-9]/g, ''))} />
        </View>
      </View>
      <Select label="Urgency" options={URGENCY_OPTIONS} value={urgency} onChange={setUrgency} />
      <TextArea label="Notes" minHeight={56} value={notes} onChangeText={setNotes} multiline />

      <View style={[styles.bandHint, { backgroundColor: tokens.colors.surfaceContainerLow }]}>
        <Text style={{ fontSize: 12.5, color: tokens.colors.onSurfaceVariant }}>
          Total <Text style={{ fontFamily: font('body', 700), color: tokens.colors.secondaryInk }}>₹{total.toLocaleString('en-IN')}</Text>
          {' '}— bands: ≤₹5k CRM · ≤₹50k Service Manager · &gt;₹50k Admin.
        </Text>
      </View>

      <View style={styles.sheetFoot}>
        <View style={{ flex: 1 }}>
          <Button variant="outline" fullWidth size="lg" onPress={onCancel} disabled={busy}>Cancel</Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button variant="primary" fullWidth size="lg" onPress={submit} loading={busy}>Submit request</Button>
        </View>
      </View>
    </View>
  );
}

/* ─── Decline offer sheet — MOBILE CHANGE from the web's window.prompt(),
 * which does not exist in React Native. Same optional-reason semantics. ── */
function DeclineOfferSheetContent({
  ticketNumber, onCancel, onSubmit, styles, tokens,
}: {
  ticketNumber: string; onCancel: () => void; onSubmit: (reason: string) => Promise<void>;
  styles: Styles; tokens: Tokens;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit(reason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.sheetBody}>
      <View style={styles.sheetHead}>
        <AlertTriangle size={18} color={tokens.colors.secondaryInk} />
        <Text variant="headlineSm">Decline {ticketNumber}?</Text>
      </View>
      <TextArea label="Reason (optional)" minHeight={72} value={reason} onChangeText={setReason} multiline />
      <View style={styles.sheetFoot}>
        <View style={{ flex: 1 }}>
          <Button variant="outline" fullWidth size="lg" onPress={onCancel} disabled={busy}>Cancel</Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button variant="danger" fullWidth size="lg" onPress={submit} loading={busy}>Decline</Button>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (tokens: Tokens) => ({
  heroRow: {
    flexDirection: 'row' as const, alignItems: 'flex-end' as const, justifyContent: 'space-between' as const, gap: space[6], flexWrap: 'wrap' as const,
  },
  heroRowPhone: { flexDirection: 'column' as const, alignItems: 'stretch' as const, gap: space[3] },
  heroText: { gap: space[2], flex: 1 },
  heroActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[3] },
  refreshBtn: {
    width: 44, height: 44, borderRadius: radius.full, borderWidth: 1, alignItems: 'center' as const, justifyContent: 'center' as const,
  },

  tilesRow: { gap: space[3], paddingBottom: space[2] },
  tile: {
    width: 140, minHeight: 110, borderRadius: radius.lg, borderWidth: 1, padding: space[4], justifyContent: 'space-between' as const, ...shadow('sm'),
  },
  tileHead: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  tileLabel: {
    fontFamily: font('mono', 500), fontSize: 10, letterSpacing: 0.14 * 10, textTransform: 'uppercase' as const,
  },
  tileValue: { fontFamily: font('display', 700), fontSize: 30, letterSpacing: -0.02 * 30 },

  section: { marginTop: space[7], gap: space[4] },
  sectionHead: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingBottom: space[2], borderBottomWidth: 1,
  },
  sectionTitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[2] },
  sectionTitle: { fontFamily: font('display', 600), fontSize: 19, color: tokens.colors.onSurface },
  countPill: {
    minWidth: 24, height: 24, paddingHorizontal: space[2], borderRadius: radius.full, alignItems: 'center' as const, justifyContent: 'center' as const,
  },

  empty: {
    alignItems: 'center' as const, gap: space[3], padding: space[7], borderWidth: 1, borderStyle: 'dashed' as const, borderRadius: radius.lg,
  },

  offerCard: {
    gap: space[3], padding: space[5], borderWidth: 1, borderRadius: radius.lg, ...shadow('sm'),
  },
  offerHead: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  offerTags: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[2], flexShrink: 1, flexWrap: 'wrap' as const,
  },
  dispatchTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  offerMetaRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  offerNote: {
    padding: space[3], borderRadius: radius.xs, borderLeftWidth: 3,
  },
  offerFootRow: { paddingTop: space[3], borderTopWidth: 1, borderStyle: 'dashed' as const },
  offerActions: { flexDirection: 'row' as const, gap: space[3], marginTop: space[1] },
  priChip: {
    alignSelf: 'flex-start' as const, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
  },

  resolvedCard: { borderWidth: 1, borderRadius: radius.lg, padding: space[2], gap: 2 },
  resolvedRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: space[3], padding: space[3], minHeight: 48,
  },

  jobCard: {
    position: 'relative' as const, gap: space[3], padding: space[5], paddingLeft: space[6], borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' as const, ...shadow('sm'),
  },
  jobAccent: { position: 'absolute' as const, top: 0, bottom: 0, left: 0, width: 4 },
  jobHead: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, flexWrap: 'wrap' as const, gap: space[2] },
  jobTags: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[2] },
  jobScheduled: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  jobMetaLine: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  jobBody: {
    fontSize: 13, lineHeight: 19.5, padding: space[3], borderRadius: radius.sm,
  },
  quickRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[3], marginTop: space[1] },
  iconChipBig: {
    width: 48, height: 48, borderRadius: radius.full, alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  detailLink: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, marginLeft: 'auto' as const, paddingHorizontal: space[3], paddingVertical: space[2], minHeight: 48,
  },
  jobActions: {
    flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space[2], marginTop: space[2], paddingTop: space[4], borderTopWidth: 1, borderStyle: 'dashed' as const,
  },
  actionBtn: { minHeight: 48, flexGrow: 1, flexBasis: '47%' as const },

  statusPill: {
    alignSelf: 'flex-start' as const, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
  },

  sheetBody: { paddingHorizontal: space[5], paddingBottom: space[8], gap: space[4] },
  sheetHead: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[2] },
  sheetFoot: { flexDirection: 'row' as const, gap: space[3], paddingTop: space[2] },
  formLabel: {
    fontFamily: font('mono', 600), fontSize: 10, letterSpacing: 0.14 * 10, textTransform: 'uppercase' as const, color: tokens.colors.onSurfaceVariant,
  },
  chipWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space[2] },
  reasonChip: { paddingHorizontal: 14, paddingVertical: space[2], borderRadius: radius.full },
  bandHint: { padding: space[3], borderRadius: radius.sm },
});
