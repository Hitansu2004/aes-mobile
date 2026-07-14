import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  AppState, AppStateStatus, Pressable, RefreshControl, ScrollView, TextInput, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import {
  AlertTriangle, Timer, CheckCircle2, ShieldAlert, ArrowUp, Clock, RefreshCw, Search,
  Activity, Users, UserCheck, Headset, Wrench, Crown, Tag, FileText, Package,
  ThumbsUp, ThumbsDown, Send, X,
} from 'lucide-react-native';

import { AppShell } from '@/components/shell/AppShell';
import {
  Text, Button, Skeleton, PressableScale, CountUp, PulseView,
} from '@/components/primitives';
import { TextArea } from '@/components/primitives/Input';
import { Sheet, SheetRef } from '@/components/primitives/Sheet';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useHaptics } from '@/hooks/useHaptics';
import useStompTopic from '@/hooks/useStompTopic';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  dashboard as dashboardApi, ticketActions, parts as partsApi, quotes as quotesApi,
} from '@/lib/api';
import type {
  EscalationDashboardResponse, ServiceTicket, PartRequest, Quote, TeamWorkloadRow, EscalationLog, UserRole,
} from '@/types/api';

// Ported from ../../aes-frontend/src/app/admin/page.js + admin.module.css.
// The web's 3-column L1/L2/L3 board becomes a horizontally-scrolling
// segmented tab bar on a phone (same convention as /ops's TABS and /crm's
// ViewTabs) and a 2-col grid on a tablet — the web itself only ever
// 3-columns at >=1024px. minutesSince/describeAge/timeShort/
// isFinalBreached/levelLabel/initialsOf/roleMeta are ported verbatim below.
type ColKey = 'l1' | 'l2' | 'l3';
const COLUMNS: { level: number; key: ColKey; title: string }[] = [
  { level: 1, key: 'l1', title: 'L1 (CRM)' },
  { level: 2, key: 'l2', title: 'L2 (Managers)' },
  { level: 3, key: 'l3', title: 'L3 (Management)' },
];

function minutesSince(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}
function describeAge(iso?: string | null): string {
  const m = minutesSince(iso);
  if (m == null) return '';
  if (m < 60) return `${m}m old`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 24) return `${h}h ${rem || ''}${rem ? 'm' : ''} old`.trim();
  return `${Math.floor(h / 24)}d old`;
}
function timeShort(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}
function isFinalBreached(t: ServiceTicket | undefined | null, now: number): boolean {
  if (!t) return false;
  if (t.isFinalBreached) return true;
  if (!t.slaDeadlineFinal) return false;
  return new Date(t.slaDeadlineFinal).getTime() < now;
}
function levelLabel(lvl: number): string {
  return ({ 1: 'L1 (CRM)', 2: 'L2 (Manager)', 3: 'L3 (Mgmt)' } as Record<number, string>)[lvl] || `L${lvl}`;
}
function initialsOf(name?: string | null): string {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}
function roleMeta(role?: UserRole | string): { label: string; short: string; icon: typeof Headset } {
  switch (role) {
    case 'CRM_AGENT': return { label: 'CRM Agent', short: 'L1', icon: Headset };
    case 'SERVICE_MANAGER': return { label: 'Service Manager', short: 'L2', icon: Wrench };
    case 'ADMIN': return { label: 'Management', short: 'L3', icon: Crown };
    default: return { label: role || '—', short: '', icon: UserCheck };
  }
}

export default function AdminEscalationScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const haptics = useHaptics();
  const { tokens } = useTheme();
  const { isPhone, isTablet } = useBreakpoint();
  const styles = useThemedStyles(makeStyles);

  const [data, setData] = useState<EscalationDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [pulse, setPulse] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [quoteQueue, setQuoteQueue] = useState<Quote[]>([]);
  const [partQueue, setPartQueue] = useState<PartRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<ColKey>('l1');

  const rejectSheetRef = useRef<SheetRef>(null);
  const [rejectTarget, setRejectTarget] = useState<{ kind: 'quote' | 'part'; item: Quote | PartRequest } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/admin'); return; }
    if (!['SERVICE_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      router.replace(defaultRouteForRole(user.role));
    }
  }, [user, authLoading, router]);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [res, qq, pq] = await Promise.allSettled([
        dashboardApi.escalation(),
        quotesApi.queue().catch(() => []),
        partsApi.queue().catch(() => []),
      ]);
      if (res.status === 'fulfilled') setData(res.value);
      if (qq.status === 'fulfilled') setQuoteQueue(Array.isArray(qq.value) ? qq.value : []);
      if (pq.status === 'fulfilled') setPartQueue(Array.isArray(pq.value) ? pq.value : []);
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : 'Could not refresh dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!user) return;
    fetchData();
    const interval = setInterval(() => fetchData(true), 25000);
    return () => clearInterval(interval);
  }, [user, fetchData]);

  // `now` tick, paused while the app is backgrounded (see useSlaCountdown for
  // the same AppState pattern).
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id) return;
      setNow(Date.now());
      id = setInterval(() => setNow(Date.now()), 30000);
    };
    const stop = () => { if (id) clearInterval(id); id = null; };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') start(); else stop();
    });
    return () => { stop(); sub.remove(); };
  }, []);

  useStompTopic(user ? '/topic/escalation/dashboard' : null, (raw) => {
    const msg = raw as { event?: string; ticketNumber?: string; toLevel?: number } | null;
    if (msg?.event?.startsWith?.('ESCALATED_TO_L')) {
      toast.info(`${msg.ticketNumber} escalated to L${msg.toLevel}`);
    }
    setPulse((p) => p + 1);
    fetchData(true);
  }, [fetchData]);

  const approveQuote = async (q: Quote) => {
    setBusyId(q.id);
    try { await quotesApi.approve(q.quoteNumber); toast.success(`Approved ${q.quoteNumber}`); haptics.success(); fetchData(true); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Could not approve'); }
    finally { setBusyId(null); }
  };
  const approvePart = async (p: PartRequest) => {
    setBusyId(p.id);
    try { await partsApi.approve(p.id); toast.success('Part approved'); haptics.success(); fetchData(true); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Could not approve'); }
    finally { setBusyId(null); }
  };
  const sendQuote = async (q: Quote) => {
    setBusyId(q.id);
    try { await quotesApi.send(q.quoteNumber); toast.success('Sent to customer'); haptics.success(); fetchData(true); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Could not send'); }
    finally { setBusyId(null); }
  };
  const openReject = (kind: 'quote' | 'part', item: Quote | PartRequest) => {
    haptics.selection();
    setRejectTarget({ kind, item });
    rejectSheetRef.current?.present();
  };
  const submitReject = async (reason: string) => {
    if (!rejectTarget) return;
    const { kind, item } = rejectTarget;
    setBusyId(item.id);
    try {
      if (kind === 'quote') {
        await quotesApi.reject((item as Quote).quoteNumber, reason);
        toast.success('Sent back');
      } else {
        await partsApi.reject(item.id, reason);
        toast.success('Rejected');
      }
      rejectSheetRef.current?.dismiss();
      fetchData(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reject');
    } finally {
      setBusyId(null);
    }
  };

  const onEscalate = async (t: ServiceTicket) => {
    if ((t.currentLevel ?? 1) >= 3) return;
    try {
      await ticketActions.escalate(t.ticketNumber, {
        reason: `Escalated to L${(t.currentLevel ?? 1) + 1} by ${user?.name || 'Manager'}`,
      });
      toast.success(`${t.ticketNumber} escalated to L${(t.currentLevel ?? 1) + 1}`);
      haptics.success();
      fetchData(true);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Escalation failed'); }
  };
  const onResolve = async (t: ServiceTicket) => {
    try {
      await ticketActions.resolve(t.ticketNumber, {
        resolutionNotes: `Resolved at L${t.currentLevel ?? 1} by ${user?.name || 'Manager'}`,
      });
      toast.success(`${t.ticketNumber} marked resolved`);
      haptics.success();
      fetchData(true);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Resolve failed'); }
  };

  const q = search.trim().toLowerCase();
  const filterTicket = useCallback((t: ServiceTicket) => {
    if (!q) return true;
    return [t.ticketNumber, t.problemCategory, t.customerName, t.currentAssigneeName]
      .filter(Boolean)
      .some((s) => String(s).toLowerCase().includes(q));
  }, [q]);

  const filtered = useMemo(() => {
    if (!data) return { l1: [] as ServiceTicket[], l2: [] as ServiceTicket[], l3: [] as ServiceTicket[] };
    return {
      l1: (data.l1Tickets || []).filter(filterTicket),
      l2: (data.l2Tickets || []).filter(filterTicket),
      l3: (data.l3Tickets || []).filter(filterTicket),
    };
  }, [data, filterTicket]);

  const teamWorkload = useMemo(() => {
    if (!data?.teamWorkload) return [] as TeamWorkloadRow[];
    return data.teamWorkload.map((tw) => ({ ...tw, tickets: (tw.tickets || []).filter(filterTicket) }));
  }, [data, filterTicket]);

  const counts = useMemo(() => ({
    l1: data?.l1Count ?? data?.l1Tickets?.length ?? 0,
    l2: data?.l2Count ?? data?.l2Tickets?.length ?? 0,
    l3: data?.l3Count ?? data?.l3Tickets?.length ?? 0,
    totalActive: data?.totalActive ?? 0,
    criticalActive: data?.criticalActive ?? 0,
  }), [data]);

  const breachedCount = useMemo(() => {
    if (!data) return 0;
    return [...(data.l1Tickets || []), ...(data.l2Tickets || [])].filter((t) => isFinalBreached(t, now)).length;
  }, [data, now]);

  const hero = (
    <View style={{ gap: space[4] }}>
      <View style={[styles.heroRow, isPhone && styles.heroRowPhone]}>
        <View style={{ gap: space[2], flex: 1 }}>
          <Text variant="headlineXl" color="onSurfaceStrong">Escalation Management</Text>
          <Text variant="bodyLg" color="onSurfaceVariant">
            Approve work, balance load, and break SLAs before they break you.
          </Text>
        </View>
        <View style={[styles.heroActions, isPhone && styles.heroActionsPhone]}>
          <View style={[styles.searchBox, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
            <Search size={16} color={tokens.colors.onSurfaceVariant} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search ticket, problem, customer…"
              placeholderTextColor={tokens.colors.outline}
              style={styles.searchInput}
            />
          </View>
          <Pressable
            onPress={() => { haptics.tapLight(); fetchData(); }}
            disabled={refreshing}
            accessibilityRole="button"
            accessibilityLabel="Refresh"
            hitSlop={6}
            style={[styles.iconBtn, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
          >
            <SpinningRefresh spinning={refreshing} color={tokens.colors.onSurfaceVariant} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/admin/coupons')}
            accessibilityRole="button"
            accessibilityLabel="Discount coupons"
            hitSlop={6}
            style={[styles.iconBtn, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
          >
            <Tag size={16} color={tokens.colors.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  if (authLoading || !user || (loading && !data)) {
    return (
      <AppShell hero={hero}>
        <View style={{ gap: space[3] }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={132} radius={16} />)}
        </View>
      </AppShell>
    );
  }

  const kpis = [
    {
      key: 'escalated', icon: AlertTriangle, label: 'Escalated Now', value: data?.escalatedNow ?? 0, unit: 'active', danger: (data?.escalatedNow ?? 0) > 0,
    },
    {
      key: 'avg', icon: Timer, label: 'Avg Response', value: data?.avgResponseMinutes != null ? `${Math.round(data.avgResponseMinutes)}` : '—', unit: data?.avgResponseMinutes != null ? 'min' : '',
    },
    {
      key: 'breach', icon: ShieldAlert, label: 'SLA Breach Today', value: data?.slaBreachToday ?? breachedCount, unit: 'incidents',
    },
    {
      key: 'resolved', icon: CheckCircle2, label: 'Resolved Today', value: data?.resolvedToday ?? 0, unit: 'tickets', success: true,
    },
  ];

  const columns: Record<ColKey, ServiceTicket[]> = { l1: filtered.l1, l2: filtered.l2, l3: filtered.l3 };

  return (
    <AppShell
      hero={hero}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData()} tintColor={tokens.colors.secondary} />}
    >
      {/* KPI tiles */}
      <ScrollView
        horizontal={isPhone || isTablet}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={(isPhone || isTablet) ? styles.kpiScroll : styles.kpiGrid}
        style={{ marginBottom: space[8] }}
      >
        {kpis.map(({ key, ...k }) => (
          <KpiTile key={key} {...k} pulseKey={pulse} narrow={isPhone || isTablet} styles={styles} tokens={tokens} />
        ))}
      </ScrollView>

      {/* Approval cards */}
      <View style={[styles.approvals, !isPhone && !isTablet && styles.approvalsWide]}>
        <ApprovalCard
          kind="quote"
          items={quoteQueue}
          busyId={busyId}
          onApprove={approveQuote}
          onReject={(it) => openReject('quote', it)}
          onSend={sendQuote}
          styles={styles}
          tokens={tokens}
        />
        <ApprovalCard
          kind="part"
          items={partQueue}
          busyId={busyId}
          onApprove={approvePart}
          onReject={(it) => openReject('part', it)}
          styles={styles}
          tokens={tokens}
        />
      </View>

      {/* Pipeline */}
      <View style={{ marginBottom: space[8] }}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Escalation Pipeline</Text>
          {counts.totalActive > 0 && (
            <Text style={styles.sectionMeta}>
              {counts.totalActive} active{counts.criticalActive ? ` · ${counts.criticalActive} P1` : ''}
            </Text>
          )}
        </View>

        {isPhone ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
              {COLUMNS.map((col) => {
                const active = tab === col.key;
                const tickets = columns[col.key];
                const breachedInCol = tickets.filter((t) => isFinalBreached(t, now)).length;
                return (
                  <PressableScale
                    key={col.key}
                    scaleTo={0.96}
                    onPress={() => { haptics.selection(); setTab(col.key); }}
                    style={[styles.tabChip, { backgroundColor: active ? tokens.colors.secondary : tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
                  >
                    <Text style={{ fontFamily: font('body', 600), fontSize: 12.5, color: active ? tokens.colors.onSecondary : tokens.colors.onSurfaceVariant }}>
                      {col.title}
                    </Text>
                    <View style={[styles.tabCount, { backgroundColor: active ? 'rgba(255,255,255,0.2)' : tokens.colors.surfaceContainer }]}>
                      <Text style={{ fontFamily: font('mono', 600), fontSize: 10, color: active ? tokens.colors.onSecondary : tokens.colors.onSurface }}>
                        {counts[col.key]}
                      </Text>
                    </View>
                    {breachedInCol > 0 && <View style={styles.tabBreachDot} />}
                  </PressableScale>
                );
              })}
            </ScrollView>
            <PipelineColumn
              tickets={columns[tab]}
              level={COLUMNS.find((c) => c.key === tab)!.level}
              now={now}
              onEscalate={onEscalate}
              onResolve={onResolve}
              router={router}
              styles={styles}
              tokens={tokens}
              pulse={pulse}
            />
          </>
        ) : (
          <View style={[styles.pipelineGrid, isTablet && styles.pipelineGridTablet]}>
            {COLUMNS.map((col) => {
              const tickets = columns[col.key];
              const breachedInCol = tickets.filter((t) => isFinalBreached(t, now)).length;
              const totalForLevel = counts[col.key] ?? tickets.length;
              const showingFiltered = q && tickets.length !== totalForLevel;
              return (
                <View key={col.key} style={[styles.column, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
                  <View style={[styles.columnHead, { borderBottomColor: tokens.colors.outlineVariant }]}>
                    <Text style={styles.columnTitle}>{col.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                      <View style={[styles.columnCount, { backgroundColor: tokens.colors.secondarySoft }]}>
                        <Text style={{ fontFamily: font('mono', 600), fontSize: 10, color: tokens.colors.secondaryInk }}>
                          {showingFiltered ? `${tickets.length}/${totalForLevel}` : totalForLevel}
                        </Text>
                      </View>
                      {breachedInCol > 0 && (
                        <View style={[styles.breachTag, { backgroundColor: tokens.colors.errorContainer }]}>
                          <AlertTriangle size={10} color={tokens.colors.error} />
                          <Text style={{ fontFamily: font('mono', 600), fontSize: 9, color: tokens.colors.error, letterSpacing: 0.72 }}>
                            {breachedInCol} BREACH
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <PipelineColumn
                    tickets={tickets}
                    level={col.level}
                    now={now}
                    onEscalate={onEscalate}
                    onResolve={onResolve}
                    router={router}
                    styles={styles}
                    tokens={tokens}
                    bare
                    pulse={pulse}
                  />
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Team workload */}
      {teamWorkload.length > 0 && (
        <View style={{ marginBottom: space[8] }}>
          <View style={styles.sectionHead}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Users size={18} color={tokens.colors.secondaryInk} />
              <Text style={styles.sectionTitle}>Who&rsquo;s on what</Text>
            </View>
            <Text style={styles.sectionMeta}>Live snapshot of every member&rsquo;s active queue</Text>
          </View>
          <View style={[styles.teamGrid, !isPhone && styles.teamGridWide]}>
            {teamWorkload.map((tw) => (
              <TeamCard key={tw.userId} member={tw} now={now} router={router} styles={styles} tokens={tokens} wide={!isPhone} />
            ))}
          </View>
        </View>
      )}

      {/* Escalation log — card list (never a horizontal table on a phone) */}
      {(data?.escalationLog || []).length > 0 && (
        <View style={{ marginBottom: space[8] }}>
          <View style={styles.sectionHead}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Activity size={18} color={tokens.colors.secondaryInk} />
              <Text style={styles.sectionTitle}>Escalation Log</Text>
            </View>
            <Text style={styles.sectionMeta}>Last {Math.min(25, data!.escalationLog.length)} events</Text>
          </View>
          <View style={{ gap: space[2] }}>
            {data!.escalationLog.slice(0, 25).map((row) => (
              <LogRow key={row.id} row={row} router={router} styles={styles} tokens={tokens} />
            ))}
          </View>
        </View>
      )}

      <RejectSheet ref={rejectSheetRef} onSubmit={submitReject} busy={!!busyId} />
    </AppShell>
  );
}

/* ─── Subcomponents ─────────────────────────────────────── */

function SpinningRefresh({ spinning, color }: { spinning: boolean; color: string }) {
  return (
    <MotiView
      from={{ rotate: '0deg' }}
      animate={{ rotate: spinning ? '360deg' : '0deg' }}
      transition={spinning ? { type: 'timing', duration: 900, loop: true, repeatReverse: false } : { type: 'timing', duration: 0 }}
    >
      <RefreshCw size={16} color={color} />
    </MotiView>
  );
}

interface KpiTileProps {
  icon: typeof AlertTriangle;
  label: string;
  value: string | number;
  unit?: string;
  danger?: boolean;
  success?: boolean;
  pulseKey: number;
  narrow: boolean;
  styles: ReturnType<typeof makeStyles>;
  tokens: ReturnType<typeof useTheme>['tokens'];
}
function KpiTile({
  icon: Icon, label, value, unit, danger, success, pulseKey, narrow, styles, tokens,
}: KpiTileProps) {
  return (
    <MotiView
      key={`${label}-${pulseKey}`}
      from={{ scale: pulseKey ? 1.02 : 1 }}
      animate={{ scale: 1 }}
      transition={{ type: 'timing', duration: 320 }}
      style={[styles.kpi, narrow && styles.kpiNarrow, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
    >
      <View style={styles.kpiHead}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <View style={[styles.kpiIcon, { backgroundColor: danger ? tokens.colors.errorContainer : tokens.colors.surfaceContainerLow }]}>
          <Icon size={16} color={danger ? tokens.colors.error : tokens.colors.onSurfaceVariant} />
        </View>
      </View>
      <View style={styles.kpiBody}>
        {typeof value === 'number' ? (
          <CountUp
            value={value}
            style={[styles.kpiValue, danger && { color: tokens.colors.error }, success && { color: tokens.colors.success }]}
          />
        ) : (
          <Text style={[styles.kpiValue, danger && { color: tokens.colors.error }, success && { color: tokens.colors.success }]}>
            {value}
          </Text>
        )}
        {unit ? <Text style={styles.kpiUnit}>{unit}</Text> : null}
      </View>
    </MotiView>
  );
}

interface ApprovalCardProps {
  kind: 'quote' | 'part';
  items: (Quote | PartRequest)[];
  busyId: string | null;
  onApprove: (item: any) => void;
  onReject: (item: any) => void;
  onSend?: (item: Quote) => void;
  styles: ReturnType<typeof makeStyles>;
  tokens: ReturnType<typeof useTheme>['tokens'];
}
function ApprovalCard({
  kind, items, busyId, onApprove, onReject, onSend, styles, tokens,
}: ApprovalCardProps) {
  const isQuote = kind === 'quote';
  const Icon = isQuote ? FileText : Package;
  const title = isQuote ? 'Quote approvals' : 'Part approvals';
  const empty = isQuote ? 'No quotes waiting.' : 'No parts to approve.';

  return (
    <View style={[styles.approvalCard, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
      <View style={styles.approvalHead}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Icon size={18} color={tokens.colors.secondaryInk} />
          <Text style={styles.approvalTitle}>{title}</Text>
        </View>
        <View style={[styles.pendingChip, items.length > 0 && { backgroundColor: tokens.colors.secondary }]}>
          <Text style={{ fontFamily: font('mono', 600), fontSize: 10, letterSpacing: 1.2, color: items.length > 0 ? tokens.colors.onSecondary : tokens.colors.onSurfaceVariant }}>
            {items.length} pending
          </Text>
        </View>
      </View>
      <View style={{ gap: space[3] }}>
        {items.length === 0 ? (
          <Text style={[styles.approvalEmpty, { backgroundColor: tokens.colors.surfaceContainerLow, borderColor: tokens.colors.outlineVariant }]}>{empty}</Text>
        ) : (
          items.slice(0, 5).map((it) => (
            <View key={it.id} style={[styles.approvalItem, { backgroundColor: tokens.colors.surfaceContainerLow, borderColor: tokens.colors.outlineVariant }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.approvalItemTitle}>
                  {isQuote
                    ? `${(it as Quote).quoteNumber} v${(it as Quote).version} — ${(it as Quote).installNumber || (it as Quote).ticketNumber || ''}`
                    : `${(it as PartRequest).partName} ×${(it as PartRequest).quantity} — ${(it as PartRequest).ticketNumber}`}
                </Text>
                <Text style={styles.approvalItemMeta}>
                  {isQuote
                    ? `Req: ${(it as Quote).preparedByName || 'CRM'} · ₹${Number((it as Quote).total || 0).toLocaleString('en-IN')} · ${(it as Quote).requiredApprovalBand || ''}`
                    : `${(it as PartRequest).ticketNumber} · ETA: ${(it as PartRequest).urgency || 'NORMAL'} · ₹${Number((it as PartRequest).totalCost || 0).toLocaleString('en-IN')}`}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                <PressableScale
                  scaleTo={0.88}
                  onPress={() => onReject(it)}
                  disabled={busyId === it.id}
                  accessibilityLabel="Reject"
                  style={[styles.approveAction, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.errorContainer }, busyId === it.id && { opacity: 0.5 }]}
                >
                  <ThumbsDown size={14} color={tokens.colors.error} />
                </PressableScale>
                <PressableScale
                  scaleTo={0.88}
                  onPress={() => onApprove(it)}
                  disabled={busyId === it.id}
                  accessibilityLabel="Approve"
                  style={[styles.approveAction, { backgroundColor: tokens.colors.success }, busyId === it.id && { opacity: 0.5 }]}
                >
                  <ThumbsUp size={14} color="#ffffff" />
                </PressableScale>
                {isQuote && (it as Quote).status === 'APPROVED' && onSend && (
                  <PressableScale
                    scaleTo={0.88}
                    onPress={() => onSend(it as Quote)}
                    disabled={busyId === it.id}
                    accessibilityLabel="Send to customer"
                    style={[styles.approveAction, { backgroundColor: tokens.colors.secondary }, busyId === it.id && { opacity: 0.5 }]}
                  >
                    <Send size={14} color={tokens.colors.onSecondary} />
                  </PressableScale>
                )}
              </View>
            </View>
          ))
        )}
        {items.length > 5 && (
          <Text style={styles.approvalMore}>+ {items.length - 5} more waiting</Text>
        )}
      </View>
    </View>
  );
}

function PipelineColumn({
  tickets, level, now, onEscalate, onResolve, router, styles, tokens, bare, pulse,
}: {
  tickets: ServiceTicket[]; level: number; now: number;
  onEscalate: (t: ServiceTicket) => void; onResolve: (t: ServiceTicket) => void;
  router: ReturnType<typeof useRouter>;
  styles: ReturnType<typeof makeStyles>; tokens: ReturnType<typeof useTheme>['tokens'];
  bare?: boolean;
  pulse: number;
}) {
  return (
    <View style={[styles.columnBody, bare && { marginTop: space[3] }]}>
      <AnimatePresence>
        {tickets.length === 0 ? (
          <EmptyCol level={level} styles={styles} tokens={tokens} />
        ) : (
          tickets.map((t, index) => (
            <MotiView
              key={t.id || t.ticketNumber}
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26, delay: Math.min(index, 10) * 40 }}
            >
              {/* Live STOMP updates (see useStompTopic above) bump `pulse` on every
                  escalation event — a brief gold glow tells the manager this row
                  just changed, per CLAUDE.md Phase 20 (LIVE DATA). */}
              <PulseView pulseKey={pulse} radius={radius.sm}>
                <PipelineCard
                  ticket={t}
                  now={now}
                  onEscalate={onEscalate}
                  onResolve={onResolve}
                  onPress={() => router.push(`/tickets/${t.ticketNumber}`)}
                  styles={styles}
                  tokens={tokens}
                />
              </PulseView>
            </MotiView>
          ))
        )}
      </AnimatePresence>
    </View>
  );
}

function PipelineCard({
  ticket, now, onEscalate, onResolve, onPress, styles, tokens,
}: {
  ticket: ServiceTicket; now: number;
  onEscalate: (t: ServiceTicket) => void; onResolve: (t: ServiceTicket) => void;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>; tokens: ReturnType<typeof useTheme>['tokens'];
}) {
  const breached = isFinalBreached(ticket, now);
  const age = describeAge(ticket.createdAt);
  const level = ticket.currentLevel ?? 1;
  const showActions = level === 2 || (breached && level < 3);

  return (
    <PressableScale
      scaleTo={0.98}
      onPress={onPress}
      style={[
        styles.ticket,
        { backgroundColor: tokens.colors.surfaceContainerLow, borderColor: tokens.colors.outlineVariant },
        breached && { borderLeftWidth: 3, borderLeftColor: tokens.colors.error },
      ]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: font('mono', 600), fontSize: 11, letterSpacing: 0.88, color: tokens.colors.secondaryInk }}>
          {ticket.ticketNumber}
        </Text>
        <Text style={{ fontFamily: font('mono', 400), fontSize: 10, letterSpacing: 0.6, color: tokens.colors.onSurfaceVariant }}>{age}</Text>
      </View>
      <Text style={{ fontFamily: font('body', 500), fontSize: 13.5, color: tokens.colors.onSurface, textTransform: 'capitalize', lineHeight: 18 }}>
        {(ticket.problemCategory || 'Service request').replace(/_/g, ' ').toLowerCase()}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        <PriorityBadge priority={ticket.priority} dense />
        {breached && (
          <View style={[styles.slaBreach, { backgroundColor: tokens.colors.errorContainer }]}>
            <ShieldAlert size={10} color={tokens.colors.error} />
            <Text style={{ fontFamily: font('mono', 600), fontSize: 9, letterSpacing: 1.08, color: tokens.colors.error }}>SLA BREACH</Text>
          </View>
        )}
        {ticket.problemCategory && (
          <View style={[styles.ticketTag, { backgroundColor: tokens.colors.surfaceContainer }]}>
            <Text style={{ fontFamily: font('mono', 400), fontSize: 9, letterSpacing: 0.9, color: tokens.colors.secondaryInk, textTransform: 'uppercase' }}>
              {ticket.problemCategory.replace(/_/g, ' ').toLowerCase()}
            </Text>
          </View>
        )}
      </View>
      {showActions && (
        <View style={[styles.ticketActions, { borderTopColor: tokens.colors.outlineVariant }]}>
          {level < 3 && (
            <Pressable onPress={() => onEscalate(ticket)} style={[styles.ticketActionBtn, { backgroundColor: tokens.colors.secondary }]}>
              <Text style={{ fontFamily: font('body', 500), fontSize: 11.5, color: tokens.colors.onSecondary }}>Escalate L{level + 1}</Text>
              <ArrowUp size={12} color={tokens.colors.onSecondary} />
            </Pressable>
          )}
          <Pressable onPress={() => onResolve(ticket)} style={[styles.ticketActionBtn, { backgroundColor: tokens.colors.successLight }]}>
            <Text style={{ fontFamily: font('body', 500), fontSize: 11.5, color: tokens.colors.success }}>Resolve</Text>
            <CheckCircle2 size={12} color={tokens.colors.success} />
          </Pressable>
        </View>
      )}
    </PressableScale>
  );
}

function EmptyCol({ level, styles, tokens }: { level: number; styles: ReturnType<typeof makeStyles>; tokens: ReturnType<typeof useTheme>['tokens'] }) {
  const txt = level === 3 ? 'No tickets at management level' : level === 2 ? 'No active escalations' : 'No tickets at L1';
  return (
    <View style={[styles.colEmpty, { backgroundColor: tokens.colors.surfaceContainerLow, borderColor: tokens.colors.outlineVariant }]}>
      <CheckCircle2 size={28} strokeWidth={1.5} color={tokens.colors.success} />
      <Text style={{ fontFamily: font('body', 400), fontSize: 12, color: tokens.colors.onSurfaceVariant }}>{txt}</Text>
    </View>
  );
}

function TeamCard({
  member, now, router, styles, tokens, wide,
}: {
  member: TeamWorkloadRow; now: number; router: ReturnType<typeof useRouter>;
  styles: ReturnType<typeof makeStyles>; tokens: ReturnType<typeof useTheme>['tokens']; wide: boolean;
}) {
  const meta = roleMeta(member.role);
  const RoleIcon = meta.icon;
  const breached = (member.tickets || []).filter((t) => isFinalBreached(t, now)).length;

  return (
    <View style={[styles.teamCard, wide && styles.teamCardWide, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View style={[styles.teamAv, { backgroundColor: tokens.colors.secondarySoft }]}>
          <Text style={{ fontFamily: font('body', 600), fontSize: 13, color: tokens.colors.secondaryInk }}>{initialsOf(member.name)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: font('body', 600), fontSize: 14, color: tokens.colors.onSurface }}>{member.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <RoleIcon size={11} color={tokens.colors.onSurfaceVariant} />
            <Text style={{ fontFamily: font('mono', 400), fontSize: 10, letterSpacing: 0.6, color: tokens.colors.onSurfaceVariant, textTransform: 'uppercase' }}>
              {meta.label}
            </Text>
            {meta.short ? (
              <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.xs, backgroundColor: tokens.colors.surfaceContainer }}>
                <Text style={{ fontFamily: font('mono', 600), fontSize: 9, color: tokens.colors.secondaryInk }}>{meta.short}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: font('display', 700), fontSize: 22, color: tokens.colors.onSurface, lineHeight: 24 }}>{member.activeCount}</Text>
          <Text style={{ fontFamily: font('mono', 400), fontSize: 9, letterSpacing: 0.9, color: tokens.colors.onSurfaceVariant, textTransform: 'uppercase' }}>active</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: space[3] }}>
        {member.criticalCount > 0 && (
          <View style={[styles.teamPill, { backgroundColor: tokens.colors.secondarySoft }]}>
            <Text style={{ fontFamily: font('mono', 600), fontSize: 10, color: tokens.colors.secondaryInk }}>{member.criticalCount} P1</Text>
          </View>
        )}
        {breached > 0 && (
          <View style={[styles.teamPill, { backgroundColor: tokens.colors.errorContainer }]}>
            <Text style={{ fontFamily: font('mono', 600), fontSize: 10, color: tokens.colors.error }}>{breached} breach</Text>
          </View>
        )}
        {member.activeCount === 0 && (
          <View style={[styles.teamPill, { backgroundColor: tokens.colors.surfaceContainer }]}>
            <Text style={{ fontFamily: font('mono', 600), fontSize: 10, color: tokens.colors.secondaryInk }}>Idle</Text>
          </View>
        )}
      </View>
      <View style={[styles.teamTickets, { borderTopColor: tokens.colors.outlineVariant }]}>
        {(member.tickets || []).length === 0 ? (
          <Text style={{ fontFamily: font('body', 400), fontSize: 12, color: tokens.colors.onSurfaceVariant, textAlign: 'center', paddingVertical: 8 }}>
            Inbox clear.
          </Text>
        ) : (
          member.tickets.slice(0, 3).map((t) => (
            <PressableScale
              key={t.id || t.ticketNumber}
              scaleTo={0.97}
              onPress={() => router.push(`/tickets/${t.ticketNumber}`)}
              style={[
                styles.teamTicket,
                { backgroundColor: tokens.colors.surfaceContainerLow },
                isFinalBreached(t, now) && { borderLeftWidth: 2, borderLeftColor: tokens.colors.error },
              ]}
            >
              <Text style={{ fontFamily: font('mono', 400), fontSize: 10, letterSpacing: 0.8, color: tokens.colors.secondaryInk }}>{t.ticketNumber}</Text>
              <Text numberOfLines={1} style={{ fontFamily: font('body', 500), fontSize: 12.5, color: tokens.colors.onSurface, textTransform: 'capitalize' }}>
                {(t.problemCategory || 'Service').replace(/_/g, ' ').toLowerCase()}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Clock size={10} color={tokens.colors.onSurfaceVariant} />
                <Text style={{ fontFamily: font('mono', 400), fontSize: 10, letterSpacing: 0.6, color: tokens.colors.onSurfaceVariant }}>{describeAge(t.createdAt)}</Text>
              </View>
            </PressableScale>
          ))
        )}
        {(member.tickets || []).length > 3 && (
          <Text style={{ fontFamily: font('mono', 400), fontSize: 10, color: tokens.colors.onSurfaceVariant, textAlign: 'center', paddingTop: 4 }}>
            + {member.tickets.length - 3} more
          </Text>
        )}
      </View>
    </View>
  );
}

function LogRow({
  row, router, styles, tokens,
}: {
  row: EscalationLog; router: ReturnType<typeof useRouter>;
  styles: ReturnType<typeof makeStyles>; tokens: ReturnType<typeof useTheme>['tokens'];
}) {
  return (
    <View style={[styles.logRow, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {row.ticketNumber ? (
          <Pressable onPress={() => router.push(`/tickets/${row.ticketNumber}`)}>
            <Text style={{ fontFamily: font('mono', 500), fontSize: 12, color: tokens.colors.secondaryInk }}>{row.ticketNumber}</Text>
          </Pressable>
        ) : <Text style={{ fontFamily: font('mono', 500), fontSize: 12, color: tokens.colors.onSurfaceVariant }}>—</Text>}
        <Text style={{ fontFamily: font('mono', 400), fontSize: 10, letterSpacing: 0.6, color: tokens.colors.onSurfaceVariant }}>{timeShort(row.escalatedAt)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
        <Text style={{ fontFamily: font('body', 400), fontSize: 12, color: tokens.colors.onSurfaceVariant }}>{levelLabel(row.fromLevel)}</Text>
        <ArrowUp size={11} color={tokens.colors.onSurfaceVariant} />
        <Text style={{ fontFamily: font('body', 600), fontSize: 12, color: row.toLevel === 3 ? tokens.colors.error : tokens.colors.warning }}>
          {levelLabel(row.toLevel)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        {row.fromUserName ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.logAv, { backgroundColor: tokens.colors.secondarySoft }]}>
              <Text style={{ fontFamily: font('body', 600), fontSize: 10, color: tokens.colors.secondaryInk }}>{initialsOf(row.fromUserName)}</Text>
            </View>
            <Text style={{ fontFamily: font('body', 400), fontSize: 12, color: tokens.colors.onSurface }}>{row.fromUserName}</Text>
          </View>
        ) : (
          <Text style={{ fontFamily: font('mono', 400), fontSize: 11, color: tokens.colors.onSurfaceVariant }}>System</Text>
        )}
        <View style={[styles.logSrc, { backgroundColor: row.escalationType === 'AUTO' ? tokens.colors.surfaceContainer : tokens.colors.secondarySoft }]}>
          <Text style={{ fontFamily: font('mono', 600), fontSize: 9, letterSpacing: 0.9, color: row.escalationType === 'AUTO' ? tokens.colors.secondary : tokens.colors.secondaryInk, textTransform: 'uppercase' }}>
            {row.escalationType === 'AUTO' ? 'System' : 'User'}
          </Text>
        </View>
      </View>
      {row.reason ? (
        <Text numberOfLines={2} style={{ fontFamily: font('body', 400), fontSize: 11.5, color: tokens.colors.onSurfaceVariant, marginTop: 6 }}>
          {row.reason}
        </Text>
      ) : null}
    </View>
  );
}

const RejectSheet = React.forwardRef<SheetRef, { onSubmit: (reason: string) => void; busy: boolean }>(
  function RejectSheet({ onSubmit, busy }, ref) {
    const [reason, setReason] = useState('');
    const sheetRef = useRef<SheetRef>(null);
    React.useImperativeHandle(ref, () => ({
      present: () => { setReason(''); sheetRef.current?.present(); },
      dismiss: () => sheetRef.current?.dismiss(),
    }), []);
    return (
      <Sheet ref={sheetRef} title="Reason for rejection">
        <View style={{ paddingHorizontal: space[5], paddingBottom: space[8], gap: space[4] }}>
          <TextArea
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. price too high, missing line items…"
            minHeight={92}
          />
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            <View style={{ flex: 1 }}>
              <Button variant="outline" fullWidth onPress={() => sheetRef.current?.dismiss()}>Cancel</Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button
                variant="danger"
                fullWidth
                loading={busy}
                disabled={!reason.trim()}
                onPress={() => onSubmit(reason.trim())}
              >
                Reject
              </Button>
            </View>
          </View>
        </View>
      </Sheet>
    );
  },
);

/* ─── Styles ────────────────────────────────────────────── */
function makeStyles(tokens: ReturnType<typeof useTheme>['tokens']) {
  return {
    heroRow: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, justifyContent: 'space-between' as const, gap: space[6], flexWrap: 'wrap' as const },
    heroRowPhone: { flexDirection: 'column' as const, alignItems: 'stretch' as const },
    heroActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[3] },
    heroActionsPhone: { flexWrap: 'wrap' as const },
    searchBox: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[2], paddingHorizontal: 14, height: 38, borderRadius: radius.full, borderWidth: 1, minWidth: 220, flex: 1,
    },
    searchInput: { flex: 1, fontFamily: font('body', 400), fontSize: 13.5, color: tokens.colors.onSurface, padding: 0 },
    iconBtn: {
      width: 38, height: 38, borderRadius: radius.full, borderWidth: 1, alignItems: 'center' as const, justifyContent: 'center' as const,
    },

    kpiScroll: { gap: space[3], paddingVertical: 2 },
    kpiGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space[3] },
    kpi: {
      gap: space[3], padding: space[5], borderRadius: radius.lg, borderWidth: 1, minHeight: 132, minWidth: 240, flexBasis: '48%' as const, flexGrow: 1, ...shadow('card'),
    },
    kpiNarrow: { minWidth: 150, flexBasis: 'auto' as const },
    kpiHead: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
    kpiLabel: { fontFamily: font('body', 500), fontSize: 13, color: tokens.colors.onSurface },
    kpiIcon: { width: 28, height: 28, borderRadius: radius.full, alignItems: 'center' as const, justifyContent: 'center' as const },
    kpiBody: { flexDirection: 'row' as const, alignItems: 'baseline' as const, gap: 6, marginTop: 'auto' as const },
    kpiValue: {
      fontFamily: font('display', 700), fontSize: 32, lineHeight: 34, letterSpacing: -0.6, color: tokens.colors.onSurfaceStrong,
    },
    kpiUnit: { fontFamily: font('body', 400), fontSize: 13, color: tokens.colors.onSurfaceVariant },

    approvals: { gap: space[4], marginBottom: space[8] },
    approvalsWide: { flexDirection: 'row' as const },
    approvalCard: {
      flex: 1, padding: space[5], borderRadius: radius.lg, borderWidth: 1, ...shadow('card'),
    },
    approvalHead: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: space[4] },
    approvalTitle: { fontFamily: font('display', 600), fontSize: 17, color: tokens.colors.onSurface },
    pendingChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: tokens.colors.surfaceContainer },
    approvalEmpty: {
      padding: space[5], textAlign: 'center' as const, fontFamily: font('body', 400), fontSize: 13, color: tokens.colors.onSurfaceVariant, borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed' as const,
    },
    approvalItem: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[3], padding: space[3], borderRadius: radius.sm, borderWidth: 1,
    },
    approvalItemTitle: { fontFamily: font('body', 600), fontSize: 13.5, color: tokens.colors.onSurface, marginBottom: 2 },
    approvalItemMeta: { fontFamily: font('mono', 400), fontSize: 11, letterSpacing: 0.44, color: tokens.colors.onSurfaceVariant },
    approveAction: {
      width: 30, height: 30, borderRadius: radius.full, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: 'transparent',
    },
    approvalMore: {
      textAlign: 'center' as const, fontFamily: font('mono', 400), fontSize: 11, color: tokens.colors.onSurfaceVariant, paddingTop: 4,
    },

    sectionHead: { marginBottom: space[4], gap: 2 },
    sectionTitle: { fontFamily: font('display', 600), fontSize: 20, letterSpacing: -0.1, color: tokens.colors.onSurface },
    sectionMeta: { fontFamily: font('mono', 400), fontSize: 11, letterSpacing: 0.66, color: tokens.colors.onSurfaceVariant },

    tabBar: { gap: space[2], paddingBottom: space[3] },
    tabChip: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.full, borderWidth: 1,
    },
    tabCount: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.full },
    tabBreachDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.colors.error },

    pipelineGrid: { gap: space[4] },
    pipelineGridTablet: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
    column: {
      gap: space[3], padding: space[4], borderRadius: radius.lg, borderWidth: 1, minHeight: 200, flex: 1, minWidth: 280, ...shadow('card'),
    },
    columnHead: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingBottom: 10, borderBottomWidth: 1 },
    columnTitle: { fontFamily: font('display', 600), fontSize: 16, color: tokens.colors.onSurface },
    columnCount: { minWidth: 24, height: 22, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 7, borderRadius: radius.full },
    breachTag: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
    columnBody: { gap: space[3] },

    ticket: { gap: space[2], padding: space[3], borderRadius: radius.sm, borderWidth: 1 },
    slaBreach: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.xs },
    ticketTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.xs },
    ticketActions: { flexDirection: 'row' as const, gap: 6, marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderStyle: 'dashed' as const },
    ticketActionBtn: {
      flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 4, paddingVertical: 7, paddingHorizontal: 10, borderRadius: radius.sm,
    },

    colEmpty: {
      alignItems: 'center' as const, gap: space[2], paddingVertical: 30, paddingHorizontal: space[3], borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed' as const,
    },

    teamGrid: { gap: space[4] },
    teamGridWide: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
    teamCard: { gap: space[3], padding: space[4], borderRadius: radius.sm, borderWidth: 1, ...shadow('card') },
    teamCardWide: { flexBasis: '31%' as const, flexGrow: 1, minWidth: 260 },
    teamAv: { width: 38, height: 38, borderRadius: radius.full, alignItems: 'center' as const, justifyContent: 'center' as const },
    teamPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
    teamTickets: { gap: 6, paddingTop: space[1], borderTopWidth: 1, borderStyle: 'dashed' as const },
    teamTicket: { gap: 2, padding: 8, borderRadius: radius.sm },

    logRow: { padding: space[3], borderRadius: radius.sm, borderWidth: 1 },
    logAv: { width: 22, height: 22, borderRadius: radius.full, alignItems: 'center' as const, justifyContent: 'center' as const },
    logSrc: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.xs },
  };
}
