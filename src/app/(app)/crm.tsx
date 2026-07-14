import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Linking, Pressable, RefreshControl, TextInput, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { FlashList, ListRenderItemInfo } from '@shopify/flash-list';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  Inbox, ListChecks, AlertTriangle, CheckCircle2,
  Phone, Check, ArrowUp, Wrench, Filter, Search,
  X, MapPin, User, Send, PackageSearch, Package, Clock, Timer,
  FileText, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp,
  Hash, Layers, AlertCircle, DollarSign, ClipboardList, RefreshCw,
  Sparkles, UserPlus, Users,
} from 'lucide-react-native';

import { AppShell } from '@/components/shell/AppShell';
import {
  Text, Button, Skeleton, PressableScale, Chip,
} from '@/components/primitives';
import { Input, TextArea } from '@/components/primitives/Input';
import { Sheet, SelectSheet, SheetRef, SelectOption } from '@/components/primitives/Sheet';
import { PriorityBadge, PriorityDot } from '@/components/ui/PriorityBadge';
import { SlaCountdown } from '@/components/ui/SlaCountdown';
import { DayPicker } from '@/components/ui/DayPicker';
import { ShiftToggle } from '@/components/ui/ShiftToggle';
import { PulseView } from '@/components/primitives/PulseView';
import useSlaCountdown from '@/hooks/useSlaCountdown';
import useStompTopic from '@/hooks/useStompTopic';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useHaptics } from '@/hooks/useHaptics';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  tickets as ticketsApi,
  ticketActions,
  dashboard as dashboardApi,
  offers as offersApi,
  parts as partsApi,
  quotes as quotesApi,
  workload as workloadApi,
  crmPool as crmPoolApi,
} from '@/lib/api';
import type {
  ServiceTicket, AssignmentOffer, PartRequest, Quote, CrmTeam, EngineerAvailability,
  CrmDashboardResponse, CustomerSearchHit, Property, TimeSlot,
} from '@/types/api';

// Ported from ../../aes-frontend/src/app/crm/page.js + crm.module.css. The
// web is a wide multi-column dashboard; here the VIEWS become a
// horizontally-scrolling segmented tab bar (phone) / wrapping tab bar
// (tablet, matching /tickets' established breakpoint convention — the web's
// own .frame has no real 2-column grid for this screen, only its ticket
// list wraps at 50% width on wide viewports, so that's what tablet restores
// here too). Every action, guard and toast string below is copied verbatim.

type ViewKey = 'pool' | 'inbox' | 'create' | 'parts' | 'quotes' | 'all' | 'escalated' | 'resolved' | 'offers';

const VIEWS: { key: ViewKey; label: string; icon: typeof Sparkles }[] = [
  { key: 'pool', label: "Today's Pool", icon: Sparkles },
  { key: 'inbox', label: 'My Tickets', icon: Inbox },
  { key: 'create', label: 'Create Ticket', icon: UserPlus },
  { key: 'parts', label: 'Parts Approval', icon: PackageSearch },
  { key: 'quotes', label: 'My Quotes', icon: FileText },
  { key: 'all', label: 'All Tickets', icon: ListChecks },
  { key: 'escalated', label: 'Escalated', icon: AlertTriangle },
  { key: 'resolved', label: 'Resolved Today', icon: CheckCircle2 },
];

const PRIORITY_FILTERS = ['All', 'P1', 'P2', 'P3'] as const;
type PriorityFilter = typeof PRIORITY_FILTERS[number];

const SORT_OPTIONS: { key: 'sla' | 'newest' | 'oldest'; label: string }[] = [
  { key: 'sla', label: 'SLA Critical' },
  { key: 'newest', label: 'Newest First' },
  { key: 'oldest', label: 'Oldest First' },
];

const PROBLEM_LABEL: Record<string, string> = {
  NOT_COOLING: 'AC Not Cooling',
  NOISE: 'Loud Noise',
  LEAKING: 'Water Leak',
  NOT_TURNING_ON: 'Not Turning On',
  NO_AIRFLOW: 'No Airflow',
  REMOTE_WIFI: 'Remote / Wi-Fi Issue',
  OTHER: 'Other Issue',
};

function ticketTitle(t: ServiceTicket): string {
  const issue = PROBLEM_LABEL[t.problemCategory] || t.problemCategory || 'Service';
  return `${issue} — ${t.acUnitRoom || ''}`;
}

function relMin(stamp?: string | null): string {
  if (!stamp) return '';
  const ms = Date.now() - new Date(stamp).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type BusyMap = Record<string, string>;
type Styles = ReturnType<typeof makeStyles>;
type Tokens = ReturnType<typeof useTheme>['tokens'];

export default function CrmScreen() {
  const router = useRouter();
  const { user, loading: authLoading, fetchUser } = useAuth();
  const toast = useToast();
  const haptics = useHaptics();
  const { tokens } = useTheme();
  const { isPhone } = useBreakpoint();
  const styles = useThemedStyles(makeStyles);

  const [view, setView] = useState<ViewKey>('pool');
  const [hasAutoSwitched, setHasAutoSwitched] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All');
  const [sortBy, setSortBy] = useState<'sla' | 'newest' | 'oldest'>('sla');
  const [ticketList, setTicketList] = useState<ServiceTicket[]>([]);
  const [stats, setStats] = useState<CrmDashboardResponse | null>(null);
  const [offerList, setOfferList] = useState<AssignmentOffer[]>([]);
  const [partsQueue, setPartsQueue] = useState<PartRequest[]>([]);
  const [myQuotes, setMyQuotes] = useState<Quote[]>([]);
  const [opsEngineers, setOpsEngineers] = useState<EngineerAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<BusyMap>({});
  const [showResolve, setShowResolve] = useState<ServiceTicket | null>(null);
  const [showAssign, setShowAssign] = useState<ServiceTicket | null>(null);
  const [search, setSearch] = useState('');

  const [pool, setPool] = useState<ServiceTicket[]>([]);
  const [poolMeta, setPoolMeta] = useState({ currentLoad: 0, cap: 30, remaining: 30 });
  const [teams, setTeams] = useState<CrmTeam[]>([]);

  const resolveSheetRef = useRef<SheetRef>(null);
  const assignSheetRef = useRef<SheetRef>(null);

  // Auth guard — Ops Manager + Super Admin can also use the pool view.
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    const allowed = ['CRM_AGENT', 'ADMIN', 'SERVICE_MANAGER', 'OPS_MANAGER', 'SUPER_ADMIN'];
    if (!allowed.includes(user.role)) router.replace(defaultRouteForRole(user.role));
  }, [user, authLoading, router]);

  const fetchAll = useCallback(async () => {
    const [list, dash, mine, queue, qs, engs, poolRes, teamRes] = await Promise.allSettled([
      ticketsApi.list(),
      dashboardApi.crm(),
      offersApi.mine(),
      partsApi.queue(),
      quotesApi.queue().catch(() => []),
      workloadApi.engineers().catch(() => []),
      crmPoolApi.list(),
      crmPoolApi.teams(),
    ]);
    if (list.status === 'fulfilled') {
      const arr = Array.isArray(list.value) ? list.value : (list.value as { content?: ServiceTicket[] })?.content || [];
      setTicketList(arr);
    }
    if (dash.status === 'fulfilled') setStats(dash.value || null);
    if (mine.status === 'fulfilled') setOfferList(Array.isArray(mine.value) ? mine.value : []);
    if (queue.status === 'fulfilled') setPartsQueue(Array.isArray(queue.value) ? queue.value : []);
    if (qs.status === 'fulfilled') setMyQuotes(Array.isArray(qs.value) ? qs.value : []);
    if (engs.status === 'fulfilled') setOpsEngineers(Array.isArray(engs.value) ? engs.value : []);
    if (poolRes.status === 'fulfilled') {
      const v = poolRes.value;
      setPool(Array.isArray(v?.tickets) ? v.tickets : []);
      setPoolMeta({
        currentLoad: Number(v?.currentLoad || 0),
        cap: Number(v?.cap || 30),
        remaining: Number(v?.remaining ?? 30),
      });
    }
    if (teamRes.status === 'fulfilled') setTeams(Array.isArray(teamRes.value) ? teamRes.value : []);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      await fetchAll();
      if (!cancelled) setLoading(false);
    })();
    const id = setInterval(fetchAll, 20000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user, fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  // V14 — Pool is the new home page; no real auto-switch needed, but the
  // flag itself is ported verbatim from the web for parity.
  useEffect(() => {
    if (loading || hasAutoSwitched) return;
    setHasAutoSwitched(true);
  }, [loading, hasAutoSwitched]);

  // Live: new tickets land in the inbox immediately.
  useStompTopic(
    user?.role === 'CRM_AGENT' || user?.role === 'ADMIN' ? '/topic/crm/inbox' : null,
    (msg) => {
      const m = msg as { event?: string; ticketNumber?: string; priority?: string } | null;
      if (m?.event === 'NEW_TICKET') {
        toast.info(`New ticket ${m.ticketNumber} • ${m.priority}`);
      }
      fetchAll();
    },
    [fetchAll],
  );

  const visibleTickets = useMemo(() => {
    let list = ticketList.slice();
    if (view === 'inbox') {
      list = list.filter((t) => (t.currentLevel || 1) === 1
        && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status));
    } else if (view === 'escalated') {
      list = list.filter((t) => (t.currentLevel || 1) > 1
        && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status));
    } else if (view === 'resolved') {
      list = list.filter((t) => {
        if (!['RESOLVED', 'CLOSED'].includes(t.status)) return false;
        const stamp = t.resolvedAt || t.updatedAt;
        if (!stamp) return false;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return new Date(stamp) >= today;
      });
    }
    if (priorityFilter !== 'All') {
      list = list.filter((t) => t.priority === priorityFilter);
    }
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      list = list.filter((t) => (t.ticketNumber || '').toLowerCase().includes(needle)
        || (t.customerName || '').toLowerCase().includes(needle)
        || (t.acUnitRoom || '').toLowerCase().includes(needle)
        || (PROBLEM_LABEL[t.problemCategory] || '').toLowerCase().includes(needle));
    }
    if (sortBy === 'sla') {
      list.sort((a, b) => {
        const aRem = a.slaRemainingSecondsL1 ?? a.slaRemainingSecondsL2 ?? a.slaRemainingSecondsFinal ?? Infinity;
        const bRem = b.slaRemainingSecondsL1 ?? b.slaRemainingSecondsL2 ?? b.slaRemainingSecondsFinal ?? Infinity;
        return aRem - bRem;
      });
    } else if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else {
      list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    }
    return list;
  }, [ticketList, view, priorityFilter, sortBy, search]);

  const breachAlert = useMemo(() => ticketList
    .filter((t) => ['OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status)
      && t.slaRemainingSecondsL1 != null
      && t.slaRemainingSecondsL1 < 900
      && t.slaRemainingSecondsL1 > 0
      && (t.currentLevel || 1) === 1
      && !t.acknowledgedAt)
    .sort((a, b) => (a.slaRemainingSecondsL1 || 0) - (b.slaRemainingSecondsL1 || 0))[0], [ticketList]);

  const counts = useMemo(() => {
    const inbox = ticketList.filter((t) => (t.currentLevel || 1) === 1
      && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status)).length;
    const escalated = ticketList.filter((t) => (t.currentLevel || 1) > 1
      && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status)).length;
    const resolvedToday = ticketList.filter((t) => {
      if (!['RESOLVED', 'CLOSED'].includes(t.status)) return false;
      const stamp = t.resolvedAt || t.updatedAt;
      if (!stamp) return false;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      return new Date(stamp) >= today;
    }).length;
    return {
      inbox, escalated, resolvedToday,
      offers: offerList.length, parts: partsQueue.length, quotes: myQuotes.length, pool: pool.length,
    };
  }, [ticketList, offerList, partsQueue, myQuotes, pool]);

  const setBusyFor = (num: string, label: string) => setBusy((b) => ({ ...b, [num]: label }));
  const clearBusy = (num: string) => setBusy((b) => { const { [num]: _drop, ...rest } = b; return rest; });

  const pickTicket = async (t: ServiceTicket) => {
    setBusyFor(t.ticketNumber, 'pick');
    try {
      await crmPoolApi.pick(t.ticketNumber);
      haptics.success();
      toast.success(`Picked ${t.ticketNumber} — moved to My Tickets.`);
      await fetchAll();
      setView('inbox');
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Could not pick ticket');
    } finally {
      clearBusy(t.ticketNumber);
    }
  };

  const assignTeam = async (t: ServiceTicket, teamName: string) => {
    if (!teamName || teamName === t.assignedTeamName) return;
    setBusyFor(t.ticketNumber, 'team');
    try {
      await crmPoolApi.assignTeam(t.ticketNumber, teamName);
      haptics.success();
      toast.success(`${t.ticketNumber} → ${teamName}`);
      await fetchAll();
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Could not assign team');
    } finally {
      clearBusy(t.ticketNumber);
    }
  };

  const assignEngineerDirect = async (t: ServiceTicket, engineerId: string) => {
    if (!engineerId) return;
    setBusyFor(t.ticketNumber, 'engineer');
    try {
      await crmPoolApi.assignEngineer(t.ticketNumber, engineerId);
      haptics.success();
      toast.success(`Engineer assigned to ${t.ticketNumber}.`);
      await fetchAll();
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Could not assign engineer');
    } finally {
      clearBusy(t.ticketNumber);
    }
  };

  const handleAcknowledge = async (t: ServiceTicket) => {
    setBusyFor(t.ticketNumber, 'ack');
    try {
      await ticketActions.acknowledge(t.ticketNumber);
      haptics.success();
      toast.success(`${t.ticketNumber} acknowledged.`);
      await fetchAll();
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Could not acknowledge ticket.');
    } finally {
      clearBusy(t.ticketNumber);
    }
  };

  const handleEscalate = async (t: ServiceTicket) => {
    setBusyFor(t.ticketNumber, 'escalate');
    try {
      await ticketActions.escalate(t.ticketNumber, { reason: 'Manual escalation by CRM' });
      haptics.warning();
      toast.success(`${t.ticketNumber} escalated to L2.`);
      await fetchAll();
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Could not escalate ticket.');
    } finally {
      clearBusy(t.ticketNumber);
    }
  };

  const submitResolve = async (payload: { resolutionNotes: string; finalCharge: number | null }) => {
    if (!showResolve) return;
    const number = showResolve.ticketNumber;
    setBusyFor(number, 'resolve');
    try {
      await ticketActions.resolve(number, payload);
      haptics.success();
      toast.success(`${number} marked resolved.`);
      resolveSheetRef.current?.dismiss();
      setShowResolve(null);
      await fetchAll();
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Could not resolve ticket.');
    } finally {
      clearBusy(number);
    }
  };

  const submitAssign = async (payload: { engineerId: string; notes: string | null; mode: string }) => {
    if (!showAssign) return;
    const number = showAssign.ticketNumber;
    setBusyFor(number, 'assign');
    try {
      await ticketActions.dispatchEngineer(number, {
        engineerId: payload.engineerId, mode: payload.mode || 'DIRECT', note: payload.notes,
      });
      haptics.success();
      toast.success(`Dispatch offer sent for ${number}.`);
      assignSheetRef.current?.dismiss();
      setShowAssign(null);
      await fetchAll();
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Could not dispatch engineer.');
    } finally {
      clearBusy(number);
    }
  };

  const acceptOffer = async (o: AssignmentOffer) => {
    setBusyFor(`offer-${o.id}`, 'accept');
    try {
      await offersApi.accept(o.id);
      const ref = o.ticketNumber || o.installRequestNumber;
      haptics.success();
      toast.success(`${ref} accepted — moved to My Tickets.`);
      await fetchAll();
      setView('inbox');
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Could not accept');
    } finally {
      clearBusy(`offer-${o.id}`);
    }
  };

  const declineOffer = async (o: AssignmentOffer, reason: string) => {
    setBusyFor(`offer-${o.id}`, 'decline');
    try {
      await offersApi.decline(o.id, { reason, comment: reason });
      haptics.tapMedium();
      toast.success('Declined. Bounced to Ops.');
      await fetchAll();
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Could not decline');
    } finally {
      clearBusy(`offer-${o.id}`);
    }
  };

  const approvePart = async (p: PartRequest) => {
    setBusyFor(`part-${p.id}`, 'approve');
    try {
      await partsApi.approve(p.id);
      haptics.success();
      toast.success('Approved');
      await fetchAll();
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Could not approve');
    } finally {
      clearBusy(`part-${p.id}`);
    }
  };

  const rejectPart = async (p: PartRequest, reason: string) => {
    setBusyFor(`part-${p.id}`, 'reject');
    try {
      await partsApi.reject(p.id, reason);
      haptics.tapMedium();
      toast.success('Rejected');
      await fetchAll();
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Could not reject');
    } finally {
      clearBusy(`part-${p.id}`);
    }
  };

  const openResolve = (t: ServiceTicket) => { setShowResolve(t); resolveSheetRef.current?.present(); };
  const openAssign = (t: ServiceTicket) => { setShowAssign(t); assignSheetRef.current?.present(); };

  const sidebarLabel = user?.role === 'CRM_AGENT'
    ? 'Level 1 · CRM Pool'
    : user?.role === 'SERVICE_MANAGER'
      ? 'Service Managers · L2'
      : 'Admin · All Tickets';

  const sortSelectOptions: SelectOption[] = SORT_OPTIONS.map((s) => ({ label: s.label, value: s.key }));

  const hero = (
    <View style={styles.heroBlock}>
      <View style={[styles.heroRow, isPhone && styles.heroRowPhone]}>
        <View style={styles.heroText}>
          <Text style={[styles.heroEyebrow, { color: tokens.colors.secondaryInk }]}>{sidebarLabel}</Text>
          <Text variant="headlineXl" color="onSurfaceStrong">Today&apos;s Pool</Text>
          <Text variant="bodyLg" color="onSurfaceVariant">
            Live ticket queue — pick from the pool, manage your inbox, run parts and quote approvals.
          </Text>
        </View>
        <View style={[styles.heroSide, isPhone && styles.heroSidePhone]}>
          <View style={[styles.searchBox, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
            <Search size={14} color={tokens.colors.onSurfaceVariant} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search ticket, customer, room…"
              placeholderTextColor={tokens.colors.outline}
              style={styles.searchInput}
            />
          </View>
          <ShiftToggle
            onShift={!!user?.onShift}
            activeWork={{ tickets: counts.inbox, offers: counts.offers }}
            onChange={() => { fetchUser(); fetchAll(); }}
          />
        </View>
      </View>

      <ViewTabs
        view={view}
        onChange={setView}
        counts={counts}
        isPhone={isPhone}
        styles={styles}
        tokens={tokens}
      />
    </View>
  );

  if (authLoading || !user) {
    return (
      <AppShell hero={hero}>
        <View style={styles.list}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={124} radius={16} />)}
        </View>
      </AppShell>
    );
  }

  const isListView = view === 'pool' || view === 'inbox' || view === 'all' || view === 'escalated' || view === 'resolved';

  return (
    <AppShell
      hero={hero}
      disableScroll={isListView}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.secondary} />}
    >
      {breachAlert ? (
        <MotiView
          from={{ translateY: -16, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          exit={{ translateY: -16, opacity: 0 }}
          style={[styles.breachBanner, { backgroundColor: tokens.colors.error }]}
        >
          <AlertTriangle size={18} color={tokens.colors.onError} />
          <Text style={[styles.breachText, { color: tokens.colors.onError }]}>{breachAlert.ticketNumber}</Text>
          <Text style={{ color: tokens.colors.onError }}>—</Text>
          <BreachCountdown deadlineISO={breachAlert.slaDeadlineL1} styles={styles} tokens={tokens} />
          <Text style={[styles.breachText, { color: tokens.colors.onError, fontFamily: font('body', 600) }]}>
            {' '}to SLA breach! Respond immediately.
          </Text>
        </MotiView>
      ) : null}

      {stats ? (
        <View style={styles.statsRow}>
          <StatTile label="My Inbox" value={stats.myInboxCount} accent={tokens.colors.secondary} styles={styles} />
          <StatTile label="Critical SLA" value={stats.criticalCount} accent={tokens.colors.warning} styles={styles} />
          <StatTile label="SLA Breaches" value={stats.slaBreachCount} accent={tokens.colors.error} styles={styles} />
          <StatTile label="Resolved Today" value={stats.resolvedToday} accent={tokens.colors.success} styles={styles} />
          <StatTile label="Avg Response" value={`${Math.round(stats.avgResponseMinutes || 0)}m`} accent={tokens.colors.outline} styles={styles} />
        </View>
      ) : null}

      <View style={[styles.filterRow, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
        <View style={styles.filterGroup}>
          <Text style={[styles.filterLabel, { color: tokens.colors.onSurfaceVariant }]}>Filter:</Text>
          {PRIORITY_FILTERS.map((p) => (
            <PriorityFilterChip
              key={p}
              priority={p}
              selected={priorityFilter === p}
              onPress={() => setPriorityFilter(p)}
            />
          ))}
        </View>
        <SortPicker value={sortBy} options={sortSelectOptions} onChange={(v) => setSortBy(v as typeof sortBy)} styles={styles} tokens={tokens} />
      </View>

      {view === 'pool' ? (
        <PoolPanel
          pool={pool}
          meta={poolMeta}
          busyMap={busy}
          onPick={pickTicket}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          styles={styles}
          tokens={tokens}
        />
      ) : null}

      {view === 'create' ? (
        <CreateOnBehalfPanel
          onCreated={(ticketNumber) => {
            toast.success(`Created ${ticketNumber} on behalf of customer.`);
            fetchAll();
            setView('inbox');
          }}
          styles={styles}
          tokens={tokens}
        />
      ) : null}

      {view === 'offers' ? (
        <OfferInboxPanel
          offers={offerList}
          busyMap={busy}
          onAccept={acceptOffer}
          onDecline={declineOffer}
          inboxCount={counts.inbox}
          onGoToInbox={() => setView('inbox')}
          styles={styles}
          tokens={tokens}
        />
      ) : null}

      {view === 'parts' ? (
        <PartsApprovalPanel
          parts={partsQueue}
          busyMap={busy}
          onApprove={approvePart}
          onReject={rejectPart}
          styles={styles}
          tokens={tokens}
        />
      ) : null}

      {view === 'quotes' ? (
        <MyQuotesPanel quotes={myQuotes} styles={styles} tokens={tokens} />
      ) : null}

      {(view === 'inbox' || view === 'all' || view === 'escalated' || view === 'resolved') ? (
        loading ? (
          <View style={styles.list}>
            {[0, 1, 2].map((i) => <Skeleton key={i} height={168} radius={16} />)}
          </View>
        ) : visibleTickets.length === 0 ? (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            style={[styles.empty, { borderColor: tokens.colors.outlineVariant }]}
          >
            <Inbox size={28} color={tokens.colors.onSurfaceVariant} />
            <Text variant="headlineSm" align="center">Nothing here</Text>
            <Text variant="bodyMd" color="onSurfaceVariant" align="center">
              {view === 'inbox' ? 'No active tickets owned by you.' : 'No tickets match the current filters.'}
            </Text>
          </MotiView>
        ) : (
          <View style={{ flex: 1 }}>
            <FlashList
              key={isPhone ? 'phone' : 'tablet'}
              data={visibleTickets}
              extraData={{ busy, teams }}
              keyExtractor={(t) => String(t.id || t.ticketNumber)}
              numColumns={isPhone ? 1 : 2}
              contentContainerStyle={{ paddingBottom: space[10] }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.secondary} />}
              renderItem={({ item: t, index }: ListRenderItemInfo<ServiceTicket>) => (
                <CrmRowEntering index={index} tablet={!isPhone} styles={styles}>
                  <CrmTicketCard
                    ticket={t}
                    busyAction={busy[t.ticketNumber]}
                    teams={teams}
                    onTeamChange={(name) => assignTeam(t, name)}
                    onEngineerChange={(id) => assignEngineerDirect(t, id)}
                    onAcknowledge={() => handleAcknowledge(t)}
                    onEscalate={() => handleEscalate(t)}
                    onAssign={() => openAssign(t)}
                    onResolve={() => openResolve(t)}
                    styles={styles}
                    tokens={tokens}
                  />
                </CrmRowEntering>
              )}
            />
          </View>
        )
      ) : null}

      <Sheet ref={resolveSheetRef} snapPoints={['55%']} onDismiss={() => setShowResolve(null)}>
        {showResolve ? (
          <ResolveSheetContent
            ticket={showResolve}
            onSubmit={submitResolve}
            styles={styles}
            tokens={tokens}
          />
        ) : null}
      </Sheet>

      <Sheet ref={assignSheetRef} snapPoints={['80%']} onDismiss={() => setShowAssign(null)}>
        {showAssign ? (
          <DispatchSheetContent
            ticket={showAssign}
            engineers={opsEngineers}
            onSubmit={submitAssign}
            styles={styles}
            tokens={tokens}
          />
        ) : null}
      </Sheet>
    </AppShell>
  );
}

/* ─── Cell wrapper: fade+rise entrance, staggered up to the first 10 rows,
 * plain (no motion) when Reduce Motion is on — see CLAUDE.md Phase 20. */
const CrmRowEntering = React.memo(function CrmRowEntering({
  index, tablet, styles, children,
}: { index: number; tablet: boolean; styles: Styles; children: React.ReactNode }) {
  const reduceMotion = useReduceMotion();
  return (
    <Animated.View
      entering={reduceMotion ? FadeInDown.duration(1) : FadeInDown.delay(Math.min(index, 10) * 60).springify().damping(18)}
      style={tablet ? styles.listItemTablet : styles.listItemPhone}
    >
      {children}
    </Animated.View>
  );
});

/* ─── View tabs — horizontally-scrolling segmented control ────────────── */
function ViewTabs({
  view, onChange, counts, isPhone, styles, tokens,
}: {
  view: ViewKey;
  onChange: (v: ViewKey) => void;
  counts: { pool: number; inbox: number; parts: number; quotes: number; escalated: number; resolvedToday: number };
  isPhone: boolean;
  styles: Styles;
  tokens: Tokens;
}) {
  const countFor = (key: ViewKey): number | null => {
    if (key === 'pool') return counts.pool;
    if (key === 'inbox') return counts.inbox;
    if (key === 'parts') return counts.parts;
    if (key === 'quotes') return counts.quotes;
    if (key === 'escalated') return counts.escalated;
    if (key === 'resolved') return counts.resolvedToday;
    return null;
  };

  const tabs = VIEWS.map(({ key, label, icon: Icon }) => {
    const count = countFor(key);
    const active = view === key;
    const isAlert = key === 'escalated' || key === 'pool';
    return (
      <PressableScale
        key={key}
        scaleTo={0.96}
        onPress={() => onChange(key)}
        style={[styles.viewTab, active && { backgroundColor: tokens.colors.secondary }]}
      >
        <Icon size={14} color={active ? tokens.colors.onSecondary : tokens.colors.onSurfaceVariant} strokeWidth={active ? 2.2 : 1.8} />
        <Text style={[styles.viewTabLabel, { color: active ? tokens.colors.onSecondary : tokens.colors.onSurfaceVariant }]}>
          {label}
        </Text>
        {count != null && count > 0 ? (
          <View
            style={[
              styles.viewBadge,
              { backgroundColor: active ? 'rgba(255,255,255,0.20)' : tokens.colors.surfaceContainer },
              isAlert && { backgroundColor: active ? tokens.colors.onSecondary : tokens.colors.error },
            ]}
          >
            <Text
              style={[
                styles.viewBadgeLabel,
                { color: active ? tokens.colors.onSecondary : tokens.colors.onSurface },
                isAlert && { color: active ? tokens.colors.secondaryInk : tokens.colors.onError },
              ]}
            >
              {count}
            </Text>
          </View>
        ) : null}
      </PressableScale>
    );
  });

  return (
    <View style={[styles.viewTabs, { backgroundColor: tokens.colors.surfaceContainerLowest }, isPhone && styles.viewTabsPhone]}>
      {tabs}
    </View>
  );
}

/* ─── Priority filter chip (adds the PriorityDot the shared Chip lacks) ── */
function PriorityFilterChip({
  priority, selected, onPress,
}: { priority: PriorityFilter; selected: boolean; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <PressableScale
      scaleTo={0.96}
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: space[2], paddingHorizontal: 14,
        borderRadius: radius.full, backgroundColor: selected ? tokens.colors.secondary : tokens.colors.surfaceContainer,
      }}
    >
      {priority !== 'All' ? <PriorityDot priority={priority} /> : null}
      <Text style={{
        fontFamily: font('body', 600), fontSize: 13, color: selected ? tokens.colors.onSecondary : tokens.colors.onSurfaceVariant,
      }}
      >
        {priority}
      </Text>
    </PressableScale>
  );
}

/* ─── Sort picker (compact select, drives SORT_OPTIONS) ────────────────── */
function SortPicker({
  value, options, onChange, styles, tokens,
}: { value: string; options: SelectOption[]; onChange: (v: string) => void; styles: Styles; tokens: Tokens }) {
  const sheetRef = useRef<SheetRef>(null);
  const selected = options.find((o) => o.value === value);
  return (
    <>
      <Pressable onPress={() => sheetRef.current?.present()} style={styles.sortGroup}>
        <Filter size={14} color={tokens.colors.onSurfaceVariant} />
        <Text style={[styles.filterLabel, { color: tokens.colors.onSurfaceVariant }]}>Sort:</Text>
        <Text style={{ fontFamily: font('body', 600), fontSize: 13, color: tokens.colors.onSurface }}>
          {selected?.label}
        </Text>
        <ChevronDown size={14} color={tokens.colors.onSurfaceVariant} />
      </Pressable>
      <SelectSheet ref={sheetRef} label="Sort by" options={options} value={value} onChange={onChange} />
    </>
  );
}

/* ─── Stat tile ─────────────────────────────────────────────────────────── */
function StatTile({
  label, value, accent, styles,
}: { label: string; value: number | string | undefined; accent: string; styles: Styles }) {
  return (
    <View style={[styles.statTile, { borderLeftColor: accent }]}>
      <Text style={styles.statValue}>{value ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BreachCountdown({ deadlineISO, styles, tokens }: { deadlineISO?: string; styles: Styles; tokens: Tokens }) {
  const { displayText } = useSlaCountdown(deadlineISO);
  return (
    <Text style={[styles.breachTime, { color: tokens.colors.onError, backgroundColor: 'rgba(255,255,255,0.20)' }]}>
      {displayText}
    </Text>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * V14 — Today's Pool (FIFO stockbroker-style)
 * ──────────────────────────────────────────────────────────────────────── */
const POOL_PROBLEM_LABEL: Record<string, string> = {
  ...PROBLEM_LABEL,
  SMELL_BURNING: 'Burning Smell',
};

function PoolPanel({
  pool, meta, busyMap, onPick, loading, refreshing, onRefresh, styles, tokens,
}: {
  pool: ServiceTicket[];
  meta: { currentLoad: number; cap: number; remaining: number };
  busyMap: BusyMap;
  onPick: (t: ServiceTicket) => void;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  styles: Styles;
  tokens: Tokens;
}) {
  const pctFull = Math.min(100, Math.round((meta.currentLoad / Math.max(1, meta.cap)) * 100));
  const barColor = pctFull >= 100 ? tokens.colors.error : pctFull >= 75 ? tokens.colors.warning : tokens.colors.primary;

  return (
    <View style={{ flex: 1, gap: 14 }}>
      <View style={[styles.capacityCard, { backgroundColor: tokens.colors.primaryContainer, borderColor: tokens.colors.borderLight }]}>
        <View style={styles.capacityRow}>
          <View style={styles.capacityRowLeft}>
            <Sparkles size={18} color={tokens.colors.onPrimaryContainer} />
            <View>
              <Text style={{ fontFamily: font('body', 700), fontSize: 14, color: tokens.colors.onPrimaryContainer }}>
                Today&apos;s Pool
              </Text>
              <Text style={{ fontSize: 12, color: tokens.colors.onSurfaceVariant }}>
                {pool.length} waiting · pick the top one first
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 12, color: tokens.colors.onSurfaceVariant }}>You today</Text>
            <Text style={{ fontFamily: font('body', 700), fontSize: 14, color: tokens.colors.onPrimaryContainer }}>
              {meta.currentLoad} / {meta.cap}
              {meta.remaining <= 0 ? (
                <Text style={{ color: tokens.colors.error, fontSize: 11 }}> · cap reached</Text>
              ) : null}
            </Text>
          </View>
        </View>
        <View style={{ height: 6, borderRadius: 999, backgroundColor: tokens.colors.surfaceContainer, overflow: 'hidden' }}>
          <MotiView
            animate={{ width: `${pctFull}%` }}
            transition={{ type: 'timing', duration: 220 }}
            style={{ height: '100%', backgroundColor: barColor }}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={88} radius={14} />)}
        </View>
      ) : pool.length === 0 ? (
        <View style={[styles.empty, { borderColor: tokens.colors.outlineVariant }]}>
          <CheckCircle2 size={28} color={tokens.colors.onSurfaceVariant} />
          <Text variant="headlineSm" align="center">Pool is clear</Text>
          <Text variant="bodyMd" color="onSurfaceVariant" align="center">
            Every ticket for today has been picked up. Keep an eye out for new ones.
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlashList
            data={pool}
            keyExtractor={(t) => t.ticketNumber}
            extraData={busyMap}
            contentContainerStyle={{ paddingBottom: space[10] }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.secondary} />}
            renderItem={({ item: t, index: idx }: ListRenderItemInfo<ServiceTicket>) => (
              <PoolRow
                ticket={t}
                index={idx}
                busy={!!busyMap[t.ticketNumber]}
                capReached={meta.remaining <= 0}
                onPick={() => onPick(t)}
                styles={styles}
                tokens={tokens}
              />
            )}
          />
        </View>
      )}
    </View>
  );
}

const PoolRow = React.memo(function PoolRow({
  ticket: t, index: idx, busy, capReached, onPick, styles, tokens,
}: {
  ticket: ServiceTicket; index: number; busy: boolean; capReached: boolean; onPick: () => void; styles: Styles; tokens: Tokens;
}) {
  const reduceMotion = useReduceMotion();
  return (
    <Animated.View
      entering={reduceMotion ? FadeInDown.duration(1) : FadeInDown.delay(Math.min(idx, 10) * 60).springify().damping(18)}
      style={{ marginBottom: 10 }}
    >
      <PulseView pulseKey={`${t.status}-${t.updatedAt || t.createdAt}`} radius={14} style={[styles.poolRow, { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.borderLight }]}>
        <View style={[styles.poolIndex, { backgroundColor: tokens.colors.surfaceContainerLow }]}>
          <Text style={{ fontFamily: font('body', 700), fontSize: 13, color: tokens.colors.onSurfaceVariant }}>
            {idx + 1}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <View style={styles.poolLineTop}>
            <PriorityBadge priority={t.priority} dense />
            <Text style={{ fontFamily: font('body', 700), fontSize: 14, color: tokens.colors.onSurface }}>
              {t.ticketNumber}
            </Text>
            {t.carriedForward ? <CarryOverPill /> : null}
            <Text style={{ fontSize: 12, color: tokens.colors.onSurfaceVariant }}>· {relMin(t.createdAt)}</Text>
          </View>
          <Text style={{ fontSize: 13, color: tokens.colors.onSurface }}>
            {POOL_PROBLEM_LABEL[t.problemCategory] || t.problemCategory || 'Service'} — {t.acUnitRoom || ''}
          </Text>
          <View style={styles.poolLineMeta}>
            <Text style={styles.poolMetaText}><User size={11} color={tokens.colors.onSurfaceVariant} /> {t.customerName || 'Customer'}</Text>
            <Text style={styles.poolMetaText}><MapPin size={11} color={tokens.colors.onSurfaceVariant} /> {t.propertyLabel || '—'}</Text>
            {t.scheduledDate ? (
              <Text style={styles.poolMetaText}><Clock size={11} color={tokens.colors.onSurfaceVariant} /> {t.scheduledDate} {t.scheduledSlot || ''}</Text>
            ) : null}
          </View>
        </View>
        <Button
          variant="primary"
          size="sm"
          disabled={busy || capReached}
          loading={busy}
          leftIcon={<ThumbsUp size={14} color={tokens.colors.onSecondary} />}
          onPress={onPick}
        >
          Pick
        </Button>
      </PulseView>
    </Animated.View>
  );
});

function CarryOverPill() {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2,
      borderRadius: 999, backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a',
    }}
    >
      <RefreshCw size={10} color="#92400e" />
      <Text style={{ fontSize: 10, fontFamily: font('body', 700), letterSpacing: 0.3, color: '#92400e', textTransform: 'uppercase' }}>
        Carry-over
      </Text>
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * V14 — Create ticket on behalf of a customer
 * ──────────────────────────────────────────────────────────────────────── */
const SERVICE_TYPE_OPTIONS: SelectOption[] = [
  { label: 'Paid (P3 · 24h SLA)', value: 'PAID' },
  { label: 'In-Warranty (P2 · 8h SLA)', value: 'WARRANTY' },
  { label: 'AMC (P1 · 4h SLA)', value: 'AMC' },
];
const PROBLEM_OPTIONS: SelectOption[] = [
  { label: 'AC Not Cooling', value: 'NOT_COOLING' },
  { label: 'Loud Noise', value: 'NOISE' },
  { label: 'Water Leak', value: 'LEAKING' },
  { label: 'Not Turning On', value: 'NOT_TURNING_ON' },
  { label: 'No Airflow', value: 'NO_AIRFLOW' },
  { label: 'Remote / Wi-Fi', value: 'REMOTE_WIFI' },
  { label: 'Burning Smell', value: 'SMELL_BURNING' },
  { label: 'Other', value: 'OTHER' },
];
const SLOT_OPTIONS: SelectOption[] = [
  { label: 'Anytime (general shift)', value: 'EARLY' },
  { label: 'Morning 9 AM – 12 PM', value: 'MORNING' },
  { label: 'Afternoon 12 PM – 4 PM', value: 'AFTERNOON' },
  { label: 'Evening 4 PM – 7 PM', value: 'EVENING' },
];

function CreateOnBehalfPanel({
  onCreated, styles, tokens,
}: { onCreated: (ticketNumber: string) => void; styles: Styles; tokens: Tokens }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<CustomerSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<CustomerSearchHit | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [acUnitId, setAcUnitId] = useState('');
  const [problem, setProblem] = useState('NOT_COOLING');
  const [serviceType, setServiceType] = useState('PAID');
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [scheduledSlot, setScheduledSlot] = useState<TimeSlot>('MORNING');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return undefined; }
    let cancelled = false;
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await crmPoolApi.searchCustomers(q.trim());
        if (!cancelled) setHits(Array.isArray(res) ? res : []);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(id); };
  }, [q]);

  useEffect(() => {
    if (!picked) { setProperties([]); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const res = await crmPoolApi.customerProperties(picked.id);
        if (!cancelled) {
          const arr = Array.isArray(res) ? res : [];
          setProperties(arr);
          if (arr.length === 1) setPropertyId(arr[0].id);
        }
      } catch {
        if (!cancelled) setProperties([]);
      }
    })();
    return () => { cancelled = true; };
  }, [picked]);

  const activeProperty = properties.find((p) => p.id === propertyId);
  const acUnits = activeProperty?.acUnits || [];

  useEffect(() => {
    if (acUnits.length === 1) setAcUnitId(acUnits[0].id);
  }, [propertyId, acUnits]);

  const submit = async () => {
    setErr('');
    if (!picked || !propertyId || !acUnitId) {
      setErr('Pick a customer, property and AC unit.'); return;
    }
    if (!scheduledDate) {
      setErr('Pick a date — the slot capacity guard needs one.'); return;
    }
    setSaving(true);
    try {
      const body = {
        propertyId, acUnitId,
        serviceType,
        problemCategory: problem,
        problemDescription: description || 'Raised by CRM on behalf of customer',
        priority: serviceType === 'AMC' ? 'P1' : serviceType === 'WARRANTY' ? 'P2' : 'P3',
        scheduledDate,
        scheduledSlot,
      };
      const res = await crmPoolApi.createOnBehalf(picked.id, body);
      onCreated((res as ServiceTicket)?.ticketNumber || 'AES-NEW');
      setPicked(null); setQ(''); setHits([]); setProperties([]);
      setPropertyId(''); setAcUnitId(''); setDescription('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create the ticket.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={[styles.formCard, { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.borderLight }]}>
        <Text variant="headlineMd">① Find the customer</Text>
        <Text variant="bodySm" color="onSurfaceVariant" style={{ marginTop: 4, marginBottom: 12 }}>
          Search by name, phone or email. Helpful when the customer can&apos;t self-serve.
        </Text>
        <Input
          placeholder="e.g. 9876543210, Hitansu, hitan@example.com…"
          value={q}
          onChangeText={(v) => { setQ(v); setPicked(null); }}
        />
        {searching ? <Text variant="bodySm" color="onSurfaceVariant">Searching…</Text> : null}
        {!picked && hits.length > 0 ? (
          <View style={[styles.searchHits, { borderColor: tokens.colors.borderLight }]}>
            {hits.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setPicked(c)}
                style={[styles.searchHitRow, { borderBottomColor: tokens.colors.borderLight }]}
              >
                <Text style={{ fontFamily: font('body', 600), fontSize: 14 }}>{c.name}</Text>
                <Text style={{ fontSize: 12, color: tokens.colors.onSurfaceVariant }}>
                  {c.phoneNumber}{c.email ? ` · ${c.email}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {picked ? (
          <View style={[styles.pickedCustomer, { backgroundColor: tokens.colors.primaryContainer }]}>
            <View>
              <Text style={{ fontFamily: font('body', 700), color: tokens.colors.onPrimaryContainer }}>{picked.name}</Text>
              <Text style={{ fontSize: 12, color: tokens.colors.onPrimaryContainer }}>{picked.phoneNumber}</Text>
            </View>
            <Button variant="soft" size="sm" leftIcon={<X size={14} color={tokens.colors.primary} />} onPress={() => { setPicked(null); setProperties([]); }}>
              Change
            </Button>
          </View>
        ) : null}
      </View>

      {picked ? (
        <View style={[styles.formCard, { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.borderLight }]}>
          <Text variant="headlineMd" style={{ marginBottom: 12 }}>② Raise the ticket</Text>

          {properties.length === 0 ? (
            <Text variant="bodySm" color="onSurfaceVariant">Loading {picked.name}&apos;s properties…</Text>
          ) : (
            <View style={{ gap: 12 }}>
              <SheetSelectField
                label="Property"
                placeholder="Choose a property"
                options={properties.map((p) => ({ label: `${p.label} — ${p.formattedAddress || p.addressLine1 || ''}`, value: p.id }))}
                value={propertyId}
                onChange={(v) => { setPropertyId(v); setAcUnitId(''); }}
              />
              <SheetSelectField
                label="AC unit"
                placeholder="Choose an AC"
                options={acUnits.map((a) => ({ label: `${a.roomLabel || 'AC'} · ${a.brand || ''} ${a.modelNumber || ''}`, value: a.id }))}
                value={acUnitId}
                onChange={setAcUnitId}
              />
              <SheetSelectField
                label="Service type"
                options={SERVICE_TYPE_OPTIONS}
                value={serviceType}
                onChange={setServiceType}
              />
              <SheetSelectField
                label="Problem"
                options={PROBLEM_OPTIONS}
                value={problem}
                onChange={setProblem}
              />
              <View>
                <Text style={styles.fieldLabel}>Preferred date</Text>
                <DayPicker value={scheduledDate} onChange={setScheduledDate} days={14} />
              </View>
              <SheetSelectField
                label="Slot"
                options={SLOT_OPTIONS}
                value={scheduledSlot}
                onChange={(v) => setScheduledSlot(v as TimeSlot)}
              />
              <TextArea
                label="What did the customer describe? (optional)"
                minHeight={80}
                placeholder="Indoor unit started leaking after rain last night…"
                value={description}
                onChangeText={setDescription}
              />
            </View>
          )}

          {err ? (
            <View style={[styles.errorBanner, { backgroundColor: tokens.colors.errorContainer }]}>
              <AlertCircle size={14} color={tokens.colors.error} />
              <Text style={{ color: tokens.colors.error, fontSize: 13 }}>{err}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: 14 }}>
            <Button
              variant="primary"
              fullWidth
              size="lg"
              disabled={saving || !propertyId || !acUnitId}
              loading={saving}
              leftIcon={<Send size={16} color={tokens.colors.onSecondary} />}
              onPress={submit}
            >
              Create ticket &amp; pick it for me
            </Button>
          </View>
          <Text variant="bodySm" color="onSurfaceVariant" style={{ marginTop: 8 }}>
            Tip: the new ticket is auto-claimed by you. Open it from My Tickets to assign a team / engineer.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function SheetSelectField({
  label, placeholder = 'Select…', options, value, onChange,
}: { label: string; placeholder?: string; options: SelectOption[]; value: string; onChange: (v: string) => void }) {
  const sheetRef = useRef<SheetRef>(null);
  const { tokens } = useTheme();
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{
        fontFamily: font('body', 600), fontSize: 12, letterSpacing: 0.72, textTransform: 'uppercase', color: tokens.colors.onSurfaceVariant,
      }}
      >
        {label}
      </Text>
      <Pressable
        onPress={() => sheetRef.current?.present()}
        style={{
          height: 52, paddingHorizontal: space[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: tokens.colors.surfaceContainerLow, borderRadius: radius.sm,
        }}
      >
        <Text style={{ fontSize: 15, color: selected ? tokens.colors.onSurface : tokens.colors.onSurfaceVariant }}>
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown size={18} color={tokens.colors.onSurfaceVariant} />
      </Pressable>
      <SelectSheet ref={sheetRef} label={label} options={options} value={value} onChange={onChange} />
    </View>
  );
}

/* ─── Legacy offers panel (kept for parity — no tab currently opens it,
 * matching the web's own VIEWS array which no longer lists an 'offers' key) */
function OfferInboxPanel({
  offers, busyMap, onAccept, onDecline, inboxCount, onGoToInbox, styles, tokens,
}: {
  offers: AssignmentOffer[];
  busyMap: BusyMap;
  onAccept: (o: AssignmentOffer) => void;
  onDecline: (o: AssignmentOffer, reason: string) => void;
  inboxCount: number;
  onGoToInbox: () => void;
  styles: Styles;
  tokens: Tokens;
}) {
  const [declining, setDeclining] = useState<AssignmentOffer | null>(null);
  const [reason, setReason] = useState('');

  if (!offers.length) {
    return (
      <View style={[styles.empty, { borderColor: tokens.colors.outlineVariant }]}>
        <Send size={28} color={tokens.colors.onSurfaceVariant} />
        <Text variant="headlineSm" align="center">No offers right now</Text>
        <Text variant="bodyMd" color="onSurfaceVariant" align="center">
          When the Ops Manager pushes a ticket to you, it will appear here. You have 15 minutes to accept.
        </Text>
        {inboxCount > 0 ? (
          <View style={{ marginTop: 14 }}>
            <Button variant="primary" size="sm" leftIcon={<Inbox size={14} color={tokens.colors.onSecondary} />} onPress={onGoToInbox}>
              {`View your ${inboxCount} ticket${inboxCount === 1 ? '' : 's'} in My Tickets`}
            </Button>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {offers.map((o) => (
        <View key={o.id} style={[styles.offerCard, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.warning }]}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadLeft}>
              <PriorityBadge priority={o.ticketPriority || 'P2'} />
              <Text style={[styles.cardNumber, { color: tokens.colors.secondaryInk }]}>
                {o.ticketNumber || o.installRequestNumber}
              </Text>
              <Text style={styles.cardAge}>· offered by {o.offeredByName}</Text>
            </View>
            <View style={[styles.offerTimer, { backgroundColor: tokens.colors.warningLight }]}>
              <Timer size={12} color={tokens.colors.warning} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.colors.warning }}>
                {Math.max(0, Math.round((o.secondsUntilExpiry || 0) / 60))}m left
              </Text>
            </View>
          </View>
          <Text variant="headlineSm" style={{ marginTop: 6 }}>
            {o.customerName} — {(o.ticketProblemCategory || '').replace(/_/g, ' ')}
          </Text>
          {o.note ? <Text variant="bodySm" color="onSurfaceVariant">&quot;{o.note}&quot;</Text> : null}
          <View style={styles.cardActions}>
            <Button
              variant="soft"
              size="sm"
              disabled={!!busyMap[`offer-${o.id}`]}
              leftIcon={<ThumbsDown size={14} color={tokens.colors.primary} />}
              onPress={() => setDeclining(o)}
            >
              Decline
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!!busyMap[`offer-${o.id}`]}
              loading={busyMap[`offer-${o.id}`] === 'accept'}
              leftIcon={<ThumbsUp size={14} color={tokens.colors.onSecondary} />}
              onPress={() => onAccept(o)}
            >
              Accept
            </Button>
          </View>
          {declining?.id === o.id ? (
            <View style={{ gap: 8, marginTop: 10 }}>
              <TextArea placeholder="Decline reason (e.g. on another job)?" minHeight={56} value={reason} onChangeText={setReason} />
              <Button
                variant="danger"
                size="sm"
                disabled={!reason.trim()}
                onPress={() => { onDecline(o, reason.trim()); setDeclining(null); setReason(''); }}
              >
                Confirm decline
              </Button>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Parts approval panel
 * ──────────────────────────────────────────────────────────────────────── */
const URGENCY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  URGENT: { bg: '#fef2f2', color: '#b91c1c', label: 'Urgent' },
  HIGH: { bg: '#fff7ed', color: '#c2410c', label: 'High' },
  NORMAL: { bg: '#f0fdf4', color: '#15803d', label: 'Normal' },
  LOW: { bg: '#f8fafc', color: '#475569', label: 'Low' },
};

function PartsApprovalPanel({
  parts, busyMap, onApprove, onReject, styles, tokens,
}: {
  parts: PartRequest[];
  busyMap: BusyMap;
  onApprove: (p: PartRequest) => void;
  onReject: (p: PartRequest, reason: string) => void;
  styles: Styles;
  tokens: Tokens;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PartRequest | null>(null);
  const [reason, setReason] = useState('');

  if (!parts.length) {
    return (
      <View style={[styles.empty, { borderColor: tokens.colors.outlineVariant }]}>
        <PackageSearch size={28} color={tokens.colors.onSurfaceVariant} />
        <Text variant="headlineSm" align="center">Approval queue is clear</Text>
        <Text variant="bodyMd" color="onSurfaceVariant" align="center">
          Part requests routed to you (CRM band ≤ ₹5k on your tickets) appear here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {parts.map((p) => {
        const busy = !!busyMap[`part-${p.id}`];
        const urgency = URGENCY_STYLE[p.urgency || 'NORMAL'] || URGENCY_STYLE.NORMAL;
        const cost = Number(p.totalCost || 0);
        const open = expandedId === p.id;
        return (
          <View key={p.id} style={[styles.partCard, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
            <View style={[styles.partAccent, { backgroundColor: urgency.color }]} />
            <View style={styles.partBody}>
              <View style={styles.partHead}>
                <View style={styles.partHeadLeft}>
                  <View style={[styles.partIconWrap, { backgroundColor: tokens.colors.surfaceContainer }]}>
                    <Package size={15} color={tokens.colors.onSurfaceVariant} />
                  </View>
                  <Text style={[styles.cardNumber, { color: tokens.colors.secondaryInk }]}>{p.ticketNumber}</Text>
                  <Text style={[styles.partBand, { backgroundColor: tokens.colors.surfaceContainer, color: tokens.colors.onSurfaceVariant }]}>
                    {p.requiredApprovalBand}
                  </Text>
                  <Text style={[styles.urgencyChip, { backgroundColor: urgency.bg, color: urgency.color }]}>
                    {urgency.label}
                  </Text>
                </View>
                <Text style={styles.partCost}>{cost === 0 ? 'Quote pending' : `₹${cost.toLocaleString('en-IN')}`}</Text>
              </View>

              <Text style={styles.partName}>{p.partName}<Text style={styles.partQty}> × {p.quantity}</Text></Text>

              {(p.requestedByName || p.notes) ? (
                <Text style={styles.partNote}>
                  <Text style={{ fontFamily: font('body', 700), color: tokens.colors.onSurface }}>{p.requestedByName || 'Engineer'}</Text>
                  {p.notes ? <Text style={{ fontStyle: 'italic' }}> — &quot;{p.notes}&quot;</Text> : null}
                </Text>
              ) : null}

              {open ? (
                <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={[styles.partDetails, { backgroundColor: tokens.colors.surfaceContainer, borderColor: tokens.colors.outlineVariant }]}>
                  <View style={[styles.partDetailsGrid]}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={styles.detailSectionLabel}>Part details</Text>
                      <DetailRow icon={<Hash size={13} color={tokens.colors.outline} />} label="Part name" value={p.partName} />
                      <DetailRow icon={<Layers size={13} color={tokens.colors.outline} />} label="Quantity" value={`${p.quantity} unit${p.quantity !== 1 ? 's' : ''}`} />
                      <DetailRow icon={<DollarSign size={13} color={tokens.colors.outline} />} label="Unit cost" value={cost > 0 ? `₹${(cost / (p.quantity || 1)).toLocaleString('en-IN')} / unit` : 'Quote pending'} />
                      <DetailRow icon={<DollarSign size={13} color={tokens.colors.outline} />} label="Total cost" value={cost > 0 ? `₹${cost.toLocaleString('en-IN')}` : 'Quote pending'} highlight />
                      <DetailRow icon={<AlertCircle size={13} color={tokens.colors.outline} />} label="Urgency" value={urgency.label} />
                      <DetailRow icon={<ClipboardList size={13} color={tokens.colors.outline} />} label="Approval band" value={p.requiredApprovalBand || '—'} />
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={styles.detailSectionLabel}>Ticket context</Text>
                      <DetailRow icon={<Hash size={13} color={tokens.colors.outline} />} label="Ticket" value={p.ticketNumber || '—'} />
                      <DetailRow icon={<User size={13} color={tokens.colors.outline} />} label="Requested by" value={p.requestedByName || '—'} />
                    </View>
                  </View>
                  {p.notes ? (
                    <View style={[styles.partNotesBlock, { backgroundColor: tokens.colors.surfaceContainerLowest, borderLeftColor: tokens.colors.outlineVariant }]}>
                      <Text style={styles.detailSectionLabel}>Engineer notes</Text>
                      <Text style={{ fontSize: 13, fontStyle: 'italic', color: tokens.colors.onSurfaceVariant, marginTop: 6 }}>
                        &quot;{p.notes}&quot;
                      </Text>
                    </View>
                  ) : null}
                </MotiView>
              ) : null}

              <View style={styles.partActions}>
                <Pressable
                  onPress={() => setExpandedId(open ? null : p.id)}
                  style={[styles.detailsToggleBtn, { borderColor: tokens.colors.outlineVariant }]}
                >
                  {open ? <ChevronUp size={14} color={tokens.colors.onSurfaceVariant} /> : <ChevronDown size={14} color={tokens.colors.onSurfaceVariant} />}
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: tokens.colors.onSurfaceVariant }}>
                    {open ? 'Hide details' : 'More details'}
                  </Text>
                </Pressable>
                <View style={{ flex: 1 }} />
                <Button variant="soft" size="sm" disabled={busy} leftIcon={<X size={14} color={tokens.colors.primary} />} onPress={() => setRejecting(p)}>
                  Reject
                </Button>
                <Button variant="secondary" size="sm" disabled={busy} loading={busy && busyMap[`part-${p.id}`] === 'approve'} leftIcon={<Check size={14} color={tokens.colors.onPrimary} />} onPress={() => onApprove(p)}>
                  Approve
                </Button>
              </View>

              {rejecting?.id === p.id ? (
                <View style={{ gap: 8, marginTop: 4 }}>
                  <TextArea placeholder="Reason for rejection?" minHeight={56} value={reason} onChangeText={setReason} />
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={!reason.trim()}
                    onPress={() => { onReject(p, reason.trim()); setRejecting(null); setReason(''); }}
                  >
                    Confirm rejection
                  </Button>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function DetailRow({
  icon, label, value, highlight,
}: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 22 }}>
      {icon}
      <Text style={{ fontSize: 12, color: tokens.colors.onSurfaceVariant, flex: 1 }}>{label}</Text>
      <Text
        style={{
          fontSize: highlight ? 14 : 12.5,
          fontWeight: highlight ? '800' : '600',
          color: highlight ? tokens.colors.primary : tokens.colors.onSurface,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/* ─── My quotes panel ───────────────────────────────────────────────────── */
function MyQuotesPanel({ quotes, styles, tokens }: { quotes: Quote[]; styles: Styles; tokens: Tokens }) {
  if (!quotes.length) {
    return (
      <View style={[styles.empty, { borderColor: tokens.colors.outlineVariant }]}>
        <FileText size={28} color={tokens.colors.onSurfaceVariant} />
        <Text variant="headlineSm" align="center">No quotes pending</Text>
        <Text variant="bodyMd" color="onSurfaceVariant" align="center">
          Submitted quotes waiting for SM/Admin approval appear here.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.list}>
      {quotes.map((q) => (
        <View key={q.id} style={[styles.card, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadLeft}>
              <FileText size={16} color={tokens.colors.onSurfaceVariant} />
              <Text style={styles.cardNumber}>{q.quoteNumber} v{q.version}</Text>
              <Text style={styles.cardAge}>· {q.requiredApprovalBand}</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: tokens.colors.onSurface }}>
              ₹{Number(q.total || 0).toLocaleString('en-IN')}
            </Text>
          </View>
          <Text variant="headlineSm" style={{ marginTop: 6 }}>
            {q.installNumber || q.ticketNumber} — {q.customerName || ''}
          </Text>
          <Text variant="bodySm" color="onSurfaceVariant">
            Status: <Text style={{ fontWeight: '700' }}>{q.status}</Text> · Prepared by {q.preparedByName}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * CRM ticket card — team/engineer assignment, ack/assign/resolve, escalate
 * ──────────────────────────────────────────────────────────────────────── */
type Tone = 'critical' | 'warning' | 'normal' | 'ack' | 'esc';

const CrmTicketCard = React.memo(function CrmTicketCard({
  ticket, busyAction, teams, onTeamChange, onEngineerChange, onAcknowledge, onEscalate, onAssign, onResolve, styles, tokens,
}: {
  ticket: ServiceTicket;
  busyAction?: string;
  teams: CrmTeam[];
  onTeamChange: (name: string) => void;
  onEngineerChange: (id: string) => void;
  onAcknowledge: () => void;
  onEscalate: () => void;
  onAssign: () => void;
  onResolve: () => void;
  styles: Styles;
  tokens: Tokens;
}) {
  const engineerOptions = useMemo(() => {
    if (!teams.length) return [];
    if (ticket.assignedTeamName) {
      const t = teams.find((tm) => tm.teamName === ticket.assignedTeamName);
      return t?.engineers || [];
    }
    return teams.flatMap((tm) => (tm.engineers || []).map((e) => ({ ...e, name: `${e.name} · ${tm.teamName}` })));
  }, [teams, ticket.assignedTeamName]);

  const acked = !!ticket.acknowledgedAt;
  const escalated = (ticket.currentLevel || 1) > 1;
  const resolved = ['RESOLVED', 'CLOSED'].includes(ticket.status);

  const tone: Tone = escalated
    ? 'esc'
    : acked
      ? 'ack'
      : (ticket.slaRemainingSecondsL1 ?? Infinity) < 900
        ? 'critical'
        : (ticket.slaRemainingSecondsL1 ?? Infinity) < 1500
          ? 'warning'
          : 'normal';

  const accentColor: Record<Tone, string> = {
    critical: tokens.colors.error,
    warning: tokens.colors.warning,
    normal: tokens.colors.secondary,
    ack: tokens.colors.success,
    esc: tokens.colors.warning,
  };

  const teamOptions: SelectOption[] = teams.map((tm) => ({
    label: `${tm.teamName}${tm.lead ? ` · ${tm.lead.name}` : ''} (${tm.engineers?.length || 0} eng)`,
    value: tm.teamName,
  }));
  const engineerSelectOptions: SelectOption[] = engineerOptions.map((e) => ({ label: e.name, value: e.id }));

  return (
    <PulseView pulseKey={`${ticket.status}-${ticket.currentLevel}-${ticket.updatedAt || ticket.acknowledgedAt || ''}`} radius={radius.md} style={[styles.card, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
      <View style={[styles.cardAccentBar, { backgroundColor: accentColor[tone] }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <View style={styles.cardHeadLeft}>
            <PriorityBadge priority={ticket.priority} />
            <Text style={[styles.cardNumber, { color: tokens.colors.secondaryInk }]}>{ticket.ticketNumber}</Text>
            {ticket.carriedForward ? <CarryOverPill /> : null}
            <Text style={styles.cardAge}>· {relMin(ticket.createdAt)}</Text>
          </View>
          <View style={styles.cardHeadRight}>
            {acked && !resolved && !escalated ? (
              <View style={[styles.ackPill, { backgroundColor: tokens.colors.successLight }]}>
                <Check size={14} color={tokens.colors.success} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: tokens.colors.success }}>Acknowledged</Text>
              </View>
            ) : escalated ? (
              <View style={[styles.escPill, { backgroundColor: tokens.colors.warningLight }]}>
                <ArrowUp size={12} color={tokens.colors.warning} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: tokens.colors.warning }}>Level {ticket.currentLevel}</Text>
              </View>
            ) : (
              <SlaCountdown deadlineISO={ticket.slaDeadlineL1} />
            )}
          </View>
        </View>

        <Text variant="headlineSm" color="onSurfaceStrong" numberOfLines={1}>{ticketTitle(ticket)}</Text>

        <View style={styles.cardMetaRow}>
          <Text style={styles.metaItem}><User size={14} color={tokens.colors.onSurfaceVariant} /> {ticket.customerName || 'Customer'}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaItem}><MapPin size={14} color={tokens.colors.onSurfaceVariant} /> {ticket.propertyLabel || '—'}</Text>
        </View>

        {!resolved ? (
          <View style={[styles.dispatchRow, { backgroundColor: tokens.colors.surfaceContainerLow, borderColor: tokens.colors.borderLight }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.dispatchLabel}>
                <Users size={13} color={tokens.colors.onSurfaceVariant} />
                <Text style={styles.dispatchLabelText}>Team</Text>
              </View>
              <InlinePicker
                placeholder="Pick a team…"
                value={ticket.assignedTeamName || ''}
                options={teamOptions}
                onChange={onTeamChange}
                disabled={busyAction === 'team'}
              />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.dispatchLabel}>
                <Wrench size={13} color={tokens.colors.onSurfaceVariant} />
                <Text style={styles.dispatchLabelText}>Engineer</Text>
              </View>
              <InlinePicker
                placeholder={engineerSelectOptions.length ? 'Pick an engineer…' : 'No engineers on this team'}
                value={ticket.engineerId || ''}
                options={engineerSelectOptions}
                onChange={onEngineerChange}
                disabled={busyAction === 'engineer' || engineerSelectOptions.length === 0}
              />
            </View>
            {ticket.engineerName ? (
              <Text style={{ fontSize: 12, color: tokens.colors.success, alignSelf: 'center' }}>
                <Check size={12} color={tokens.colors.success} /> Engineer: {ticket.engineerName}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.cardActions}>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Phone size={14} color={tokens.colors.onSecondary} />}
            onPress={() => Linking.openURL(`tel:${ticket.customerPhone || ''}`)}
          >
            Call
          </Button>
          {!acked && !resolved ? (
            <Button variant="soft" size="sm" disabled={busyAction === 'ack'} loading={busyAction === 'ack'} leftIcon={<Check size={14} color={tokens.colors.primary} />} onPress={onAcknowledge}>
              Acknowledge
            </Button>
          ) : null}
          {acked && !resolved ? (
            <Button variant="soft" size="sm" disabled={busyAction === 'assign'} loading={busyAction === 'assign'} leftIcon={<Wrench size={14} color={tokens.colors.primary} />} onPress={onAssign}>
              Assign Engineer
            </Button>
          ) : null}
          {acked && !resolved ? (
            <Button variant="outline" size="sm" disabled={busyAction === 'resolve'} loading={busyAction === 'resolve'} leftIcon={<CheckCircle2 size={14} color={tokens.colors.primary} />} onPress={onResolve}>
              Resolve
            </Button>
          ) : null}
          <View style={{ flex: 1 }} />
          {!resolved && !escalated ? (
            <PressableScale haptic disabled={busyAction === 'escalate'} onPress={onEscalate} style={styles.escalateLink}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: tokens.colors.onSurfaceVariant }}>
                {busyAction === 'escalate' ? 'Escalating...' : `Escalate to L${(ticket.currentLevel || 1) + 1}`}
              </Text>
              {busyAction !== 'escalate' ? <ArrowUp size={14} color={tokens.colors.onSurfaceVariant} /> : null}
            </PressableScale>
          ) : null}
        </View>
      </View>
    </PulseView>
  );
});

function InlinePicker({
  placeholder, value, options, onChange, disabled,
}: { placeholder: string; value: string; options: SelectOption[]; onChange: (v: string) => void; disabled?: boolean }) {
  const sheetRef = useRef<SheetRef>(null);
  const { tokens } = useTheme();
  const selected = options.find((o) => o.value === value);
  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => sheetRef.current?.present()}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10,
          borderRadius: radius.sm, backgroundColor: tokens.colors.surface, borderWidth: 1, borderColor: tokens.colors.borderLight,
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <Text numberOfLines={1} style={{ fontSize: 13, color: selected ? tokens.colors.onSurface : tokens.colors.onSurfaceVariant, flexShrink: 1 }}>
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown size={12} color={tokens.colors.onSurfaceVariant} />
      </Pressable>
      <SelectSheet ref={sheetRef} options={options} value={value} onChange={onChange} />
    </>
  );
}

/* ─── Resolve sheet ──────────────────────────────────────────────────────── */
function ResolveSheetContent({
  ticket, onSubmit, styles, tokens,
}: {
  ticket: ServiceTicket;
  onSubmit: (payload: { resolutionNotes: string; finalCharge: number | null }) => Promise<void>;
  styles: Styles;
  tokens: Tokens;
}) {
  const [notes, setNotes] = useState('');
  const [charge, setCharge] = useState('');
  const [saving, setSaving] = useState(false);
  const isPaid = ticket.priority === 'P3';

  const handle = async () => {
    if (!notes.trim()) return;
    setSaving(true);
    await onSubmit({
      resolutionNotes: notes.trim(),
      finalCharge: isPaid && charge ? Number(charge) : null,
    });
    setSaving(false);
  };

  return (
    <View style={{ paddingHorizontal: space[5], paddingBottom: space[8], gap: 14 }}>
      <Text variant="headlineMd">Resolve {ticket.ticketNumber}</Text>
      <Text variant="bodySm" color="onSurfaceVariant">Add resolution notes — these are visible to the customer.</Text>
      <TextArea
        minHeight={100}
        maxLength={2000}
        placeholder="What was done, parts replaced, follow-up needed..."
        value={notes}
        onChangeText={setNotes}
      />
      {isPaid ? (
        <Input
          label="Final charge (₹)"
          keyboardType="numeric"
          placeholder="e.g. 2400"
          value={charge}
          onChangeText={(v) => setCharge(v.replace(/[^0-9]/g, ''))}
        />
      ) : null}
      <Button variant="primary" fullWidth size="lg" disabled={!notes.trim() || saving} loading={saving} onPress={handle}>
        {'Mark as Resolved'}
      </Button>
    </View>
  );
}

/* ─── Dispatch sheet ─────────────────────────────────────────────────────── */
function DispatchSheetContent({
  ticket, engineers, onSubmit, styles, tokens,
}: {
  ticket: ServiceTicket;
  engineers: EngineerAvailability[];
  onSubmit: (payload: { engineerId: string; notes: string | null; mode: string }) => Promise<void>;
  styles: Styles;
  tokens: Tokens;
}) {
  const [pickedId, setPickedId] = useState('');
  const [mode, setMode] = useState<'DIRECT' | 'INVITE'>('DIRECT');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const haptics = useHaptics();

  const sorted = useMemo(() => engineers.slice().sort((a, b) => {
    if ((b.onShift ? 1 : 0) !== (a.onShift ? 1 : 0)) return (b.onShift ? 1 : 0) - (a.onShift ? 1 : 0);
    const la = (a.activeJobs || 0) + (a.pendingOffers || 0);
    const lb = (b.activeJobs || 0) + (b.pendingOffers || 0);
    if (la !== lb) return la - lb;
    return (b.csatScore || 0) - (a.csatScore || 0);
  }), [engineers]);

  const handle = async () => {
    if (!pickedId) return;
    setSaving(true);
    await onSubmit({ engineerId: pickedId, notes: notes.trim() || null, mode });
    setSaving(false);
  };

  return (
    <View style={{ flex: 1, gap: 12 }}>
      <View style={{ paddingHorizontal: space[5], gap: 4 }}>
        <Text variant="headlineMd">Dispatch Engineer</Text>
        <Text variant="bodySm" color="onSurfaceVariant">
          Sending offer for <Text style={{ fontWeight: '700' }}>{ticket.ticketNumber}</Text> — {ticket.customerName}. Engineer has 10 minutes to accept.
        </Text>
      </View>

      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: space[5], gap: 8 }}>
        {sorted.length === 0 ? (
          <View style={[styles.dispatchEmpty, { borderColor: tokens.colors.outlineVariant }]}>
            <Wrench size={20} color={tokens.colors.onSurfaceVariant} />
            <Text variant="bodySm" color="onSurfaceVariant" align="center">No engineers available right now.</Text>
            <Text variant="bodySm" color="onSurfaceVariant" align="center">
              Try escalating to L2 so a Service Manager can re-route.
            </Text>
          </View>
        ) : null}
        {sorted.map((e) => {
          const picked = e.userId === pickedId;
          const initials = (e.name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('');
          return (
            <Pressable
              key={e.userId}
              onPress={() => { haptics.selection(); setPickedId(e.userId); }}
              style={[
                styles.engineerRow,
                {
                  borderColor: picked ? tokens.colors.secondary : tokens.colors.outlineVariant,
                  backgroundColor: picked ? tokens.colors.secondarySoft : tokens.colors.surfaceContainerLowest,
                },
              ]}
            >
              <View style={[styles.engineerAvatar, { backgroundColor: tokens.colors.primaryContainer }]}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: tokens.colors.onPrimaryContainer }}>{initials}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.colors.onSurface }}>{e.name}</Text>
                  {!e.onShift ? <BadgeMini label="off-shift" tone={tokens.colors.outlineVariant} fg={tokens.colors.onSurfaceVariant} /> : null}
                  {e.overloaded ? <BadgeMini label="full" tone={tokens.colors.errorContainer} fg={tokens.colors.error} /> : null}
                </View>
                <Text style={{ fontSize: 11.5, color: tokens.colors.onSurfaceVariant, marginTop: 2 }}>
                  {`Jobs ${e.activeJobs} · Pending ${e.pendingOffers}`}
                  {e.csatScore != null ? ` · CSAT ${Number(e.csatScore).toFixed(1)}` : ''}
                  {(e.skills || []).slice(0, 2).map((s) => ` · ${s}`).join('')}
                </Text>
              </View>
              {picked ? <Check size={18} color={tokens.colors.secondaryInk} /> : null}
            </Pressable>
          );
        })}
      </BottomSheetScrollView>

      <View style={{ paddingHorizontal: space[5], gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['DIRECT', 'INVITE'] as const).map((m) => (
            <Chip key={m} label={m === 'DIRECT' ? 'Direct' : 'Invite (declinable)'} selected={mode === m} onPress={() => setMode(m)} />
          ))}
        </View>
        <TextArea
          label="Note (optional)"
          minHeight={56}
          maxLength={500}
          value={notes}
          onChangeText={setNotes}
          placeholder="VIP customer, prefer evening visit…"
        />
        <View style={{ marginBottom: space[6] }}>
          <Button variant="primary" fullWidth size="lg" disabled={!pickedId || saving} loading={saving} onPress={handle}>
            Send dispatch offer
          </Button>
        </View>
      </View>
    </View>
  );
}

function BadgeMini({ label, tone, fg }: { label: string; tone: string; fg: string }) {
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: tone }}>
      <Text style={{ fontSize: 9.5, fontWeight: '700', color: fg }}>{label}</Text>
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Styles
 * ──────────────────────────────────────────────────────────────────────── */
const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  heroBlock: { gap: 18 as const },
  heroRow: {
    flexDirection: 'row' as const, alignItems: 'flex-end' as const, justifyContent: 'space-between' as const, gap: space[6], flexWrap: 'wrap' as const,
  },
  heroRowPhone: { flexDirection: 'column' as const, alignItems: 'stretch' as const, gap: space[3] },
  heroText: { gap: space[2], maxWidth: 540 },
  heroEyebrow: {
    fontFamily: font('mono', 500), fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase' as const,
  },
  heroSide: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, flexWrap: 'wrap' as const },
  heroSidePhone: { flexDirection: 'column' as const, alignItems: 'stretch' as const, width: '100%' as const },
  searchBox: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, height: 40, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1, minWidth: 260,
  },
  searchInput: { flex: 1, fontFamily: font('body', 400), fontSize: 13.5 },

  viewTabs: {
    flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, padding: 8, borderRadius: radius.full, ...shadow('card'),
  },
  viewTabsPhone: { flexWrap: 'nowrap' as const },
  viewTab: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 7, paddingVertical: 9, paddingHorizontal: 16, borderRadius: radius.full,
  },
  viewTabLabel: { fontFamily: font('body', 500), fontSize: 13 },
  viewBadge: {
    minWidth: 18, height: 18, paddingHorizontal: 6, borderRadius: radius.full, alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  viewBadgeLabel: { fontFamily: font('mono', 700), fontSize: 10 },

  breachBanner: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, padding: 12, borderRadius: radius.md, flexWrap: 'wrap' as const, ...shadow('md'),
  },
  breachText: { fontSize: 14, fontFamily: font('body', 700) },
  breachTime: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, fontFamily: font('mono', 700), fontSize: 14 },

  statsRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10 },
  statTile: {
    flexGrow: 1, minWidth: 140, backgroundColor: tokens.colors.surfaceContainerLowest, borderWidth: 1, borderColor: tokens.colors.outlineVariant,
    borderRadius: radius.md, padding: 14, borderLeftWidth: 4, gap: 2,
  },
  statValue: { fontSize: 22, fontFamily: font('body', 800), color: tokens.colors.onSurface, letterSpacing: -0.2 },
  statLabel: { fontSize: 11.5, fontFamily: font('body', 700), letterSpacing: 0.7, textTransform: 'uppercase' as const, color: tokens.colors.onSurfaceVariant },

  filterRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 10, padding: 10, borderWidth: 1, borderRadius: radius.md, flexWrap: 'wrap' as const,
  },
  filterGroup: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, flexWrap: 'wrap' as const },
  filterLabel: { fontSize: 11, fontFamily: font('body', 700), textTransform: 'uppercase' as const, letterSpacing: 0.66 },
  sortGroup: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },

  list: { gap: 12 },
  listTablet: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, marginHorizontal: -7 },
  listItemTablet: { paddingHorizontal: 7, marginBottom: 12 },
  listItemPhone: { marginBottom: 12 },

  empty: {
    alignItems: 'center' as const, gap: 8, paddingVertical: 60, paddingHorizontal: 24, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed' as const,
  },

  capacityCard: { gap: 8, padding: 14, borderRadius: 14, borderWidth: 1 },
  capacityRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 12 },
  capacityRowLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },

  poolRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, padding: 12, borderRadius: 14, borderWidth: 1,
  },
  poolIndex: { width: 32, height: 32, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  poolLineTop: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'center' as const, gap: 8 },
  poolLineMeta: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10 },
  poolMetaText: { fontSize: 12, color: tokens.colors.onSurfaceVariant },

  formCard: { padding: 18, borderRadius: 16, borderWidth: 1, gap: 4 },
  fieldLabel: {
    fontFamily: font('body', 600), fontSize: 12, letterSpacing: 0.72, textTransform: 'uppercase' as const, color: tokens.colors.onSurfaceVariant, marginBottom: 6,
  },
  searchHits: { marginTop: 10, borderWidth: 1, borderRadius: 12, maxHeight: 260, overflow: 'hidden' as const },
  searchHitRow: { padding: 12, borderBottomWidth: 1 },
  pickedCustomer: {
    marginTop: 10, padding: 12, borderRadius: 12, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
  },
  errorBanner: { marginTop: 12, padding: 12, borderRadius: 10, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },

  offerCard: { padding: 16, borderRadius: radius.md, borderWidth: 1.5 },

  card: { position: 'relative' as const, flexDirection: 'row' as const, borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' as const, ...shadow('xs') },
  cardAccentBar: { width: 4 },
  cardBody: { flex: 1, padding: 16, gap: 8 },
  cardHead: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, justifyContent: 'space-between' as const, gap: 10, flexWrap: 'wrap' as const },
  cardHeadLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, flexWrap: 'wrap' as const },
  cardHeadRight: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  cardNumber: { fontFamily: font('mono', 700), fontSize: 14 },
  cardAge: { fontSize: 12, color: tokens.colors.onSurfaceVariant },
  ackPill: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  escPill: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  cardMetaRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, flexWrap: 'wrap' as const },
  metaItem: { fontSize: 13, color: tokens.colors.onSurfaceVariant },
  metaDot: { color: tokens.colors.outline },

  dispatchRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 4 },
  dispatchLabel: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  dispatchLabelText: { fontSize: 12, color: tokens.colors.onSurfaceVariant },

  cardActions: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, flexWrap: 'wrap' as const, marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: tokens.colors.surfaceContainer,
  },
  offerTimer: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  escalateLink: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },

  partCard: { flexDirection: 'row' as const, borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' as const, ...shadow('xs') },
  partAccent: { width: 4 },
  partBody: { flex: 1, padding: 16, gap: 8 },
  partHead: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 10, flexWrap: 'wrap' as const },
  partHeadLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, flexWrap: 'wrap' as const },
  partIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  partBand: { fontSize: 11, fontFamily: font('body', 700), textTransform: 'uppercase' as const, letterSpacing: 0.5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  urgencyChip: { fontSize: 11, fontFamily: font('body', 700), letterSpacing: 0.4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full },
  partCost: { fontSize: 17, fontFamily: font('body', 800), color: tokens.colors.onSurface },
  partName: { fontSize: 14.5, fontFamily: font('body', 700), color: tokens.colors.onSurface },
  partQty: { fontSize: 13, fontFamily: font('body', 500), color: tokens.colors.onSurfaceVariant },
  partNote: { fontSize: 12.5, color: tokens.colors.onSurfaceVariant },
  partDetails: { borderRadius: radius.sm, padding: 14, gap: 14, borderWidth: 1, marginVertical: 2 },
  partDetailsGrid: { flexDirection: 'row' as const, gap: 16, flexWrap: 'wrap' as const },
  detailSectionLabel: {
    fontSize: 10.5, fontFamily: font('body', 800), textTransform: 'uppercase' as const, letterSpacing: 1.05, color: tokens.colors.onSurfaceVariant, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: tokens.colors.outlineVariant,
  },
  partNotesBlock: { borderRadius: radius.sm, padding: 10, borderLeftWidth: 3 },
  partActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: tokens.colors.surfaceContainer },
  detailsToggleBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm, borderWidth: 1,
  },

  dispatchEmpty: {
    alignItems: 'center' as const, gap: 6, padding: 18, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed' as const,
  },
  engineerRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, padding: 12, borderRadius: 12, borderWidth: 1.5 },
  engineerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center' as const, justifyContent: 'center' as const },
});
