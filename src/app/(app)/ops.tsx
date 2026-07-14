import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Pressable, RefreshControl, ScrollView, TextInput, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Inbox, AlertTriangle, Building2, RefreshCw, Search, ChevronRight, Send, X,
  CheckCircle2, MapPin, User, Users, Wrench, Check,
} from 'lucide-react-native';

import { AppShell } from '@/components/shell/AppShell';
import {
  Text, Button, Skeleton, PressableScale,
} from '@/components/primitives';
import { TextArea } from '@/components/primitives/Input';
import { Sheet, SheetRef } from '@/components/primitives/Sheet';
import useStompTopic from '@/hooks/useStompTopic';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  ops as opsApi,
  amcUpgrades as amcUpgradesApi,
  workload as workloadApi,
  dashboard as dashboardApi,
} from '@/lib/api';
import type { EngineerAvailability, Priority } from '@/types/api';

// Ported from ../../aes-frontend/src/app/ops/page.js + ops.module.css. The
// web is a 4-column board (Triage Inbox / AMC Upgrades / CRM Agents / Field
// Engineers). On a phone the 4 columns become 4 horizontally-scrollable
// segmented tabs; on tablet/large they lay out as a 2x2 wrapping grid, each
// column scrolling with the page (no nested scroll — column bodies here are
// not height-clipped the way the web's 75vh columns are, since a phone/
// tablet screen already scrolls as a whole). PriorityChip, StatusPill,
// StaffCard, AssignModal and the STATUS_LABEL/STATUS_TONE maps below are
// ported verbatim from the web; every string is copied character-for-
// character. Every string, colour and card layout comes straight from the
// source — see CLAUDE.md.

type Tokens = ReturnType<typeof useTheme>['tokens'];
type Styles = ReturnType<typeof makeStyles>;

type InboxKind = 'TICKET' | 'INSTALL';

interface OpsInboxItem {
  id: string;
  kind: InboxKind;
  referenceNumber: string;
  priority: Priority;
  status: string;
  customerName?: string;
  locality?: string;
  headline?: string;
  ageMinutes?: number;
  escalationReason?: string;
  offeredToName?: string;
}

interface AmcUpgradeItem {
  id: string;
  requestNumber?: string;
  customerName?: string;
  preferredPlan?: string;
  propertyLabel?: string;
  notes?: string;
  assignedCrmName?: string;
}

interface CrmWorkloadItem {
  userId: string;
  name: string;
  branch?: string;
  onShift: boolean;
  activeTickets: number;
  activeInstalls: number;
  pendingOffers: number;
  resolvedToday: number;
  maxConcurrentLoad: number;
  overloaded: boolean;
  csatScore?: number;
}

interface OpsStats {
  untriagedTickets?: number;
  awaitingCrmAccept?: number;
  awaitingEngineerAccept?: number;
  escalatedByCustomer?: number;
  untriagedInstalls?: number;
  slaRedZone?: number;
}

const PRIORITY_FILTERS = ['All', 'P1', 'P2', 'P3'] as const;
type PriorityFilter = typeof PRIORITY_FILTERS[number];

const STATUS_LABEL: Record<string, string> = {
  NEW: 'NEW',
  PENDING: 'NEW',
  OFFERED_CRM: 'OFFERED → CRM',
  OFFERED_ENGINEER: 'OFFERED → ENG',
  ESCALATED_BY_CUSTOMER: 'CUSTOMER ESCALATED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  ASSIGNED: 'ASSIGNED',
  EN_ROUTE: 'EN ROUTE',
  ON_SITE: 'ON SITE',
  IN_PROGRESS: 'IN PROGRESS',
  WAITING_PART: 'WAITING PART',
  WAITING_CUSTOMER_APPROVAL: 'AWAITING QUOTE',
  QUOTE_DRAFT: 'QUOTE DRAFT',
  QUOTE_PENDING_APPROVAL: 'QUOTE PENDING',
  QUOTE_SENT: 'QUOTE SENT',
};
const STATUS_TONE: Record<string, 'new' | 'wait' | 'esc' | 'ack' | 'work'> = {
  NEW: 'new',
  PENDING: 'new',
  OFFERED_CRM: 'wait',
  OFFERED_ENGINEER: 'wait',
  ESCALATED_BY_CUSTOMER: 'esc',
  ACKNOWLEDGED: 'ack',
  ASSIGNED: 'work',
  EN_ROUTE: 'work',
  ON_SITE: 'work',
  IN_PROGRESS: 'work',
  WAITING_PART: 'wait',
  WAITING_CUSTOMER_APPROVAL: 'wait',
  QUOTE_DRAFT: 'wait',
  QUOTE_PENDING_APPROVAL: 'wait',
  QUOTE_SENT: 'wait',
};

function initials(name: string | undefined): string {
  return (name || '?').trim().split(/\s+/).filter(Boolean)
    .map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}
function minutesAgo(min: number | undefined | null): string {
  if (min == null) return '—';
  if (min < 60) return `${min}m open`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m open`;
}

type TabKey = 'inbox' | 'amc' | 'crm' | 'eng';
const TABS: { key: TabKey; label: string; icon: typeof Inbox }[] = [
  { key: 'inbox', label: 'Triage Inbox', icon: Inbox },
  { key: 'amc', label: 'AMC Upgrades', icon: Building2 },
  { key: 'crm', label: 'CRM Agents', icon: Users },
  { key: 'eng', label: 'Field Engineers', icon: Wrench },
];

export default function OpsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const haptics = useHaptics();
  const { tokens } = useTheme();
  const { isPhone } = useBreakpoint();
  const styles = useThemedStyles(makeStyles);

  const [inbox, setInbox] = useState<OpsInboxItem[]>([]);
  const [amcUpgrades, setAmcUpgrades] = useState<AmcUpgradeItem[]>([]);
  const [crm, setCrm] = useState<CrmWorkloadItem[]>([]);
  const [eng, setEng] = useState<EngineerAvailability[]>([]);
  const [stats, setStats] = useState<OpsStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState<PriorityFilter>('All');
  const [stage, setStage] = useState<'all' | 'untriaged' | 'awaiting-crm' | 'escalated'>('all');
  const [tab, setTab] = useState<TabKey>('inbox');
  const [assignFor, setAssignFor] = useState<OpsInboxItem | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);

  const assignSheetRef = useRef<SheetRef>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/ops'); return; }
    if (!['OPS_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      router.replace(defaultRouteForRole(user.role));
    }
  }, [user, authLoading, router]);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    const [statsRes, inboxRes, amcRes, crmRes, engRes] = await Promise.allSettled([
      dashboardApi.ops(),
      opsApi.inbox(),
      amcUpgradesApi.open(),
      workloadApi.crm(),
      workloadApi.engineers(),
    ]);
    if (statsRes.status === 'fulfilled') setStats((statsRes.value as OpsStats) || null);
    if (inboxRes.status === 'fulfilled') {
      setInbox(Array.isArray(inboxRes.value) ? (inboxRes.value as OpsInboxItem[]) : []);
    } else if (!silent) {
      toast.error(inboxRes.reason instanceof Error ? inboxRes.reason.message : 'Could not load the triage board');
    }
    if (amcRes.status === 'fulfilled') setAmcUpgrades(Array.isArray(amcRes.value) ? (amcRes.value as AmcUpgradeItem[]) : []);
    if (crmRes.status === 'fulfilled') setCrm(Array.isArray(crmRes.value) ? (crmRes.value as CrmWorkloadItem[]) : []);
    if (engRes.status === 'fulfilled') setEng(Array.isArray(engRes.value) ? engRes.value : []);
    setLoading(false);
    if (!silent) setRefreshing(false);
  }, [toast]);

  useEffect(() => {
    if (!user) return;
    fetchAll();
    const id = setInterval(() => fetchAll(true), 15000);
    return () => clearInterval(id);
  }, [user, fetchAll]);

  useStompTopic(user ? '/topic/ops/inbox' : null, () => fetchAll(true), [fetchAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inbox.filter((i) => {
      if (priority !== 'All' && i.priority !== priority) return false;
      if (stage === 'untriaged' && !['NEW', 'PENDING'].includes(i.status)) return false;
      if (stage === 'awaiting-crm' && i.status !== 'OFFERED_CRM') return false;
      if (stage === 'escalated' && i.status !== 'ESCALATED_BY_CUSTOMER') return false;
      if (q && !`${i.referenceNumber} ${i.customerName} ${i.headline} ${i.locality}`
        .toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (b.ageMinutes || 0) - (a.ageMinutes || 0));
  }, [inbox, search, priority, stage]);

  const openItem = useCallback((item: OpsInboxItem) => {
    if (item.kind === 'INSTALL') router.push(`/installations/${item.referenceNumber}`);
    else router.push(`/tickets/${item.referenceNumber}`);
  }, [router]);

  const openAssign = (item: OpsInboxItem) => {
    haptics.selection();
    setAssignFor(item);
    assignSheetRef.current?.present();
  };

  const submitAssign = async (payload: { crmId: string; mode: 'DIRECT' | 'INVITE'; note: string }) => {
    if (!assignFor) return;
    setAssignBusy(true);
    try {
      if (assignFor.kind === 'INSTALL') {
        await opsApi.offerInstall(assignFor.referenceNumber, payload);
      } else {
        await opsApi.offerTicket(assignFor.referenceNumber, payload);
      }
      const name = crm.find((c) => c.userId === payload.crmId)?.name || 'agent';
      toast.success(`Offer sent to ${name}`);
      haptics.success();
      assignSheetRef.current?.dismiss();
      setAssignFor(null);
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send offer.');
    } finally {
      setAssignBusy(false);
    }
  };

  const tiles = [
    { key: 'untriaged', label: 'Untriaged', value: stats?.untriagedTickets ?? 0 },
    { key: 'crm_wait', label: 'Awaiting CRM', value: stats?.awaitingCrmAccept ?? 0 },
    { key: 'eng_wait', label: 'Awaiting Eng', value: stats?.awaitingEngineerAccept ?? 0 },
    {
      key: 'escalated', label: 'Customer Esc.', value: stats?.escalatedByCustomer ?? 0, featured: (stats?.escalatedByCustomer ?? 0) > 0,
    },
    { key: 'installs', label: 'New Installs', value: stats?.untriagedInstalls ?? 0 },
    {
      key: 'sla', label: 'SLA Red Zone', value: stats?.slaRedZone ?? 0, danger: (stats?.slaRedZone ?? 0) > 0,
    },
    { key: 'amc', label: 'AMC Upgrade', value: amcUpgrades.length },
  ];

  const tabCount = (key: TabKey): number => {
    if (key === 'inbox') return filtered.length;
    if (key === 'amc') return amcUpgrades.length;
    if (key === 'crm') return crm.length;
    return eng.length;
  };

  const hero = (
    <View style={styles.heroBlock}>
      <View style={[styles.heroRow, isPhone && styles.heroRowPhone]}>
        <View style={styles.heroText}>
          <Text variant="headlineXl" color="onSurfaceStrong">Triage Board Overview</Text>
          <Text variant="bodyLg" color="onSurfaceVariant">
            Route work, balance load, keep SLAs green.
          </Text>
        </View>
        <View style={[styles.heroActions, isPhone && styles.heroActionsPhone]}>
          <View style={[styles.searchBox, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
            <Search size={16} color={tokens.colors.onSurfaceVariant} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search ticket #, customer, area…"
              placeholderTextColor={tokens.colors.outline}
              style={styles.searchInput}
            />
          </View>
          <Pressable
            onPress={() => { haptics.tapLight(); fetchAll(); }}
            disabled={refreshing}
            accessibilityRole="button"
            accessibilityLabel="Refresh"
            hitSlop={6}
            style={[styles.refreshBtn, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
          >
            <SpinningRefresh spinning={refreshing} color={tokens.colors.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  if (authLoading || !user || (loading && inbox.length === 0 && !stats)) {
    return (
      <AppShell hero={hero}>
        <View style={{ gap: 12 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={124} radius={16} />)}
        </View>
      </AppShell>
    );
  }

  const columns = {
    inbox: (
      <TriageInboxColumn
        items={filtered}
        stage={stage}
        setStage={setStage}
        priority={priority}
        setPriority={setPriority}
        onOpen={openItem}
        onAssign={openAssign}
        styles={styles}
        tokens={tokens}
      />
    ),
    amc: <AmcUpgradesColumn items={amcUpgrades} styles={styles} tokens={tokens} />,
    crm: <CrmAgentsColumn items={crm} styles={styles} tokens={tokens} />,
    eng: <FieldEngineersColumn items={eng} styles={styles} tokens={tokens} />,
  };

  return (
    <AppShell
      hero={hero}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAll()} tintColor={tokens.colors.secondary} />}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tiles}
        style={{ marginBottom: space[8] }}
      >
        {tiles.map((t) => (
          <View
            key={t.key}
            style={[
              styles.tile,
              { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant },
              t.featured && { borderColor: 'transparent' },
            ]}
          >
            {t.featured ? (
              <FeaturedTileBg tokens={tokens} />
            ) : null}
            <Text style={[styles.tileLabel, { color: t.featured ? 'rgba(247,244,238,0.72)' : tokens.colors.onSurfaceVariant }]}>
              {t.label}
            </Text>
            <Text
              style={[
                styles.tileValue,
                { color: t.featured ? '#F7F4EE' : t.danger ? tokens.colors.error : tokens.colors.onSurfaceStrong },
              ]}
            >
              {t.value}
            </Text>
          </View>
        ))}
      </ScrollView>

      {isPhone ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
            {TABS.map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              const count = tabCount(key);
              return (
                <PressableScale
                  key={key}
                  scaleTo={0.96}
                  onPress={() => { haptics.selection(); setTab(key); }}
                  style={[styles.tabChip, { backgroundColor: active ? tokens.colors.secondary : tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
                >
                  <Icon size={14} color={active ? tokens.colors.onSecondary : tokens.colors.onSurfaceVariant} />
                  <Text style={{ fontFamily: font('body', 600), fontSize: 12.5, color: active ? tokens.colors.onSecondary : tokens.colors.onSurfaceVariant }}>
                    {label}
                  </Text>
                  <View style={[styles.tabCount, { backgroundColor: active ? 'rgba(255,255,255,0.2)' : tokens.colors.surfaceContainer }]}>
                    <Text style={{ fontFamily: font('mono', 600), fontSize: 10, color: active ? tokens.colors.onSecondary : tokens.colors.onSurface }}>
                      {count}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </ScrollView>
          <View style={{ marginTop: space[4] }}>{columns[tab]}</View>
        </>
      ) : (
        <View style={styles.grid}>
          <ColumnCard title="Triage Inbox" count={filtered.length} styles={styles} tokens={tokens}>
            {columns.inbox}
          </ColumnCard>
          <ColumnCard title="AMC Upgrades" count={amcUpgrades.length} styles={styles} tokens={tokens}>
            {columns.amc}
          </ColumnCard>
          <ColumnCard title="CRM Agents" count={crm.length} styles={styles} tokens={tokens}>
            {columns.crm}
          </ColumnCard>
          <ColumnCard title="Field Engineers" count={eng.length} styles={styles} tokens={tokens}>
            {columns.eng}
          </ColumnCard>
        </View>
      )}

      <Sheet ref={assignSheetRef} snapPoints={['85%']} onDismiss={() => setAssignFor(null)}>
        {assignFor ? (
          <AssignSheetContent
            item={assignFor}
            crmList={crm}
            busy={assignBusy}
            onSubmit={submitAssign}
            onClose={() => assignSheetRef.current?.dismiss()}
            styles={styles}
            tokens={tokens}
          />
        ) : null}
      </Sheet>
    </AppShell>
  );
}

/* ─── Spinning refresh icon ─────────────────────────────────────────────── */
function SpinningRefresh({ spinning, color }: { spinning: boolean; color: string }) {
  const rot = useSharedValue(0);
  useEffect(() => {
    if (spinning) {
      rot.value = withRepeat(withTiming(1, { duration: 1000, easing: Easing.linear }), -1, false);
    } else {
      rot.value = 0;
    }
  }, [spinning, rot]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value * 360}deg` }] }));
  return (
    <Animated.View style={style}>
      <RefreshCw size={16} color={color} />
    </Animated.View>
  );
}

/* ─── Featured KPI tile background (navy gradient, hardcoded per source) ── */
function FeaturedTileBg({ tokens }: { tokens: Tokens }) {
  // ops.module.css .tileFeatured uses a literal 155deg navy gradient, not a
  // token pair — the two stops match tokens.colors.primaryLight/primary
  // exactly, ported as-is rather than inventing a new gradient token.
  return (
    <LinearGradient
      colors={[tokens.colors.primaryLight, tokens.colors.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ position: 'absolute', inset: 0, borderRadius: radius.md }}
    />
  );
}

/* ─── Priority chip + status pill (ops-specific, distinct from PriorityBadge) */
function PriorityChip({ priority, tokens }: { priority: string; tokens: Tokens }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    P1: { label: 'P1 · URGENT', bg: tokens.colors.secondarySoft, fg: tokens.colors.secondaryInk },
    P2: { label: 'P2 · HIGH', bg: tokens.colors.tertiarySoft, fg: tokens.colors.tertiary },
    P3: { label: 'P3 · STANDARD', bg: tokens.colors.surfaceContainer, fg: tokens.colors.secondaryInk },
  };
  const m = map[priority] || { label: priority || '—', bg: tokens.colors.surfaceContainer, fg: tokens.colors.onSurfaceVariant };
  return (
    <View style={{
      alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: m.bg,
    }}
    >
      <Text style={{
        fontFamily: font('mono', 600), fontSize: 9, letterSpacing: 0.12 * 9, textTransform: 'uppercase', color: m.fg,
      }}
      >
        {m.label}
      </Text>
    </View>
  );
}

function StatusPill({ status, tokens }: { status: string; tokens: Tokens }) {
  const label = STATUS_LABEL[status] || status || '—';
  const tone = STATUS_TONE[status] || 'ack';
  const toneColors: Record<string, { bg: string; fg: string }> = {
    new: { bg: tokens.colors.secondarySoft, fg: tokens.colors.secondaryInk },
    ack: { bg: tokens.colors.surfaceContainer, fg: tokens.colors.secondaryInk },
    work: { bg: tokens.colors.successLight, fg: tokens.colors.success },
    wait: { bg: tokens.colors.warningLight, fg: tokens.colors.warning },
    esc: { bg: tokens.colors.errorContainer, fg: tokens.colors.error },
  };
  const c = toneColors[tone];
  return (
    <View style={{
      alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: c.bg,
    }}
    >
      <Text style={{
        fontFamily: font('mono', 600), fontSize: 9, letterSpacing: 0.12 * 9, textTransform: 'uppercase', color: c.fg,
      }}
      >
        {label}
      </Text>
    </View>
  );
}

/* ─── Column card wrapper (tablet / large 2×2 grid) ────────────────────── */
function ColumnCard({
  title, count, children, styles, tokens,
}: { title: string; count: number; children: React.ReactNode; styles: Styles; tokens: Tokens }) {
  return (
    <View style={[styles.column, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
      <View style={[styles.columnHead, { borderBottomColor: tokens.colors.outlineVariant }]}>
        <Text variant="headlineSm">{title}</Text>
        <View style={[styles.columnCount, { backgroundColor: tokens.colors.secondarySoft }]}>
          <Text style={{ fontFamily: font('mono', 600), fontSize: 10, color: tokens.colors.secondaryInk }}>{count}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

/* ─── Triage Inbox column ───────────────────────────────────────────────── */
function TriageInboxColumn({
  items, stage, setStage, priority, setPriority, onOpen, onAssign, styles, tokens,
}: {
  items: OpsInboxItem[];
  stage: 'all' | 'untriaged' | 'awaiting-crm' | 'escalated';
  setStage: (v: 'all' | 'untriaged' | 'awaiting-crm' | 'escalated') => void;
  priority: PriorityFilter;
  setPriority: (v: PriorityFilter) => void;
  onOpen: (item: OpsInboxItem) => void;
  onAssign: (item: OpsInboxItem) => void;
  styles: Styles;
  tokens: Tokens;
}) {
  const haptics = useHaptics();
  const stageChips: { k: typeof stage; label: string }[] = [
    { k: 'all', label: 'All' },
    { k: 'untriaged', label: 'New' },
    { k: 'awaiting-crm', label: 'CRM' },
    { k: 'escalated', label: 'Esc' },
  ];

  return (
    <View style={{ gap: space[3] }}>
      <View style={styles.chipRow}>
        {stageChips.map((c) => (
          <FilterChip key={c.k} label={c.label} selected={stage === c.k} onPress={() => { haptics.selection(); setStage(c.k); }} tokens={tokens} />
        ))}
      </View>
      <View style={styles.chipRow}>
        {PRIORITY_FILTERS.map((p) => (
          <FilterChip key={p} label={p} selected={priority === p} onPress={() => { haptics.selection(); setPriority(p); }} tokens={tokens} />
        ))}
      </View>

      {items.length === 0 ? (
        <EmptyColumn icon={<CheckCircle2 size={24} color={tokens.colors.success} />} label="Inbox is clear." tokens={tokens} />
      ) : (
        <View style={{ gap: 10 }}>
          <AnimatePresence>
            {items.map((i, idx) => (
              <MotiView
                key={i.id}
                from={{ opacity: 0, translateY: 6 }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ type: 'timing', duration: 220, delay: idx * 40 }}
              >
                <View style={[styles.inboxCard, { backgroundColor: tokens.colors.surfaceContainerLow, borderColor: tokens.colors.outlineVariant }]}>
                  <View style={styles.inboxHead}>
                    <PriorityChip priority={i.priority} tokens={tokens} />
                    <Text style={{ fontFamily: font('mono', 500), fontSize: 10, letterSpacing: 0.08 * 10, color: tokens.colors.onSurfaceVariant }}>
                      #{i.referenceNumber}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: font('body', 600), fontSize: 14, color: tokens.colors.onSurface, marginVertical: 2 }}>
                    {i.headline || 'Customer service'}
                  </Text>
                  <View style={styles.inboxMeta}>
                    <User size={11} color={tokens.colors.onSurfaceVariant} />
                    <Text style={styles.inboxMetaText}>{i.customerName || '—'}</Text>
                    {i.locality ? (
                      <>
                        <View style={styles.dot} />
                        <MapPin size={11} color={tokens.colors.onSurfaceVariant} />
                        <Text style={styles.inboxMetaText}>{i.locality}</Text>
                      </>
                    ) : null}
                  </View>
                  {i.escalationReason ? (
                    <View style={[styles.escNote, { backgroundColor: tokens.colors.errorContainer }]}>
                      <AlertTriangle size={11} color={tokens.colors.error} />
                      <Text style={{ fontSize: 12, lineHeight: 16, color: tokens.colors.error, flex: 1 }}>{i.escalationReason}</Text>
                    </View>
                  ) : null}
                  <View style={styles.inboxFoot}>
                    <Text style={{ fontFamily: font('mono', 400), fontSize: 10, letterSpacing: 0.08 * 10, color: tokens.colors.onSurfaceVariant, textTransform: 'uppercase' }}>
                      {minutesAgo(i.ageMinutes)}
                    </Text>
                    {i.kind === 'INSTALL' ? (
                      <View style={[styles.installChip, { backgroundColor: tokens.colors.tertiarySoft }]}>
                        <Building2 size={10} color={tokens.colors.tertiary} />
                        <Text style={{ fontFamily: font('mono', 600), fontSize: 9, letterSpacing: 0.12 * 9, color: tokens.colors.tertiary }}>INSTALL</Text>
                      </View>
                    ) : null}
                    <StatusPill status={i.status} tokens={tokens} />
                  </View>
                  <View style={styles.inboxActions}>
                    <PressableScale onPress={() => onOpen(i)} style={[styles.btnGhost, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
                      <Text style={{ fontFamily: font('body', 500), fontSize: 12, color: tokens.colors.onSurface }}>Open</Text>
                      <ChevronRight size={12} color={tokens.colors.onSurface} />
                    </PressableScale>
                    <PressableScale haptic onPress={() => onAssign(i)} style={[styles.btnPrimary, { backgroundColor: tokens.colors.secondary }]}>
                      <Send size={12} color={tokens.colors.onSecondary} />
                      <Text style={{ fontFamily: font('body', 500), fontSize: 12, color: tokens.colors.onSecondary }}>
                        {i.offeredToName ? 'Reassign' : 'Assign'}
                      </Text>
                    </PressableScale>
                  </View>
                </View>
              </MotiView>
            ))}
          </AnimatePresence>
        </View>
      )}
    </View>
  );
}

function FilterChip({
  label, selected, onPress, tokens,
}: { label: string; selected: boolean; onPress: () => void; tokens: Tokens }) {
  return (
    <PressableScale
      scaleTo={0.96}
      onPress={onPress}
      style={{
        paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.full,
        backgroundColor: selected ? tokens.colors.secondary : tokens.colors.surfaceContainer,
      }}
    >
      <Text style={{
        fontFamily: font('mono', 500), fontSize: 10, letterSpacing: 0.08 * 10, textTransform: 'uppercase',
        color: selected ? tokens.colors.onSecondary : tokens.colors.onSurfaceVariant,
      }}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

/* ─── AMC Upgrades column ───────────────────────────────────────────────── */
function AmcUpgradesColumn({ items, styles, tokens }: { items: AmcUpgradeItem[]; styles: Styles; tokens: Tokens }) {
  if (items.length === 0) {
    return <EmptyColumn icon={<Building2 size={22} color={tokens.colors.onSurfaceVariant} />} label="No upgrade leads." tokens={tokens} />;
  }
  return (
    <View style={{ gap: 10 }}>
      {items.map((r, idx) => (
        <MotiView
          key={r.id}
          from={{ opacity: 0, translateY: 6 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 220, delay: idx * 40 }}
          style={[styles.upgradeCard, { backgroundColor: tokens.colors.secondarySoft, borderColor: tokens.colors.secondaryLight }]}
        >
          <View style={[styles.upgradeTag, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
            <Text style={{ fontFamily: font('mono', 600), fontSize: 10, letterSpacing: 0.12 * 10, color: tokens.colors.secondaryInk }}>
              {(r.preferredPlan || 'PREMIUM').toUpperCase()} REQUEST
            </Text>
          </View>
          <Text style={{ fontFamily: font('display', 600), fontSize: 15, color: tokens.colors.secondaryInk }}>
            {r.customerName || 'Customer'}
          </Text>
          <View style={styles.inboxMeta}>
            <Text style={styles.inboxMetaText}>{r.requestNumber}</Text>
            {r.propertyLabel ? (
              <>
                <View style={styles.dot} />
                <Text style={styles.inboxMetaText}>{r.propertyLabel}</Text>
              </>
            ) : null}
          </View>
          {r.notes ? (
            <Text style={{ fontSize: 12, fontStyle: 'italic', color: tokens.colors.secondaryInk }}>&quot;{r.notes}&quot;</Text>
          ) : null}
          {r.assignedCrmName ? (
            <Text style={{ fontSize: 12, color: tokens.colors.secondaryInk }}>
              Assigned to <Text style={{ fontFamily: font('body', 700) }}>{r.assignedCrmName}</Text>
            </Text>
          ) : (
            <PressableScale style={[styles.upgradeReviewBtn, { backgroundColor: 'rgba(255,255,255,0.85)' }]}>
              <Text style={{ fontFamily: font('body', 600), fontSize: 13, color: tokens.colors.secondaryInk }}>Review</Text>
            </PressableScale>
          )}
        </MotiView>
      ))}
    </View>
  );
}

/* ─── CRM Agents / Field Engineers columns ──────────────────────────────── */
function CrmAgentsColumn({ items, styles, tokens }: { items: CrmWorkloadItem[]; styles: Styles; tokens: Tokens }) {
  if (items.length === 0) {
    return <EmptyColumn icon={<Users size={22} color={tokens.colors.onSurfaceVariant} />} label="No CRM on roster." tokens={tokens} />;
  }
  return (
    <View style={{ gap: 10 }}>
      {items.map((c, idx) => (
        <MotiView key={c.userId} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: idx * 40 }}>
          <StaffCard
            avatar={initials(c.name)}
            name={c.name}
            role="CRM"
            onShift={c.onShift}
            badges={c.branch ? [c.branch] : []}
            stats={[
              { label: 'Tickets', value: c.activeTickets },
              { label: 'Installs', value: c.activeInstalls },
              { label: 'Pending', value: c.pendingOffers },
              { label: 'Solved', value: c.resolvedToday },
            ]}
            load={Math.min(100, ((c.activeTickets + c.activeInstalls) / Math.max(1, c.maxConcurrentLoad)) * 100)}
            overloaded={c.overloaded}
            styles={styles}
            tokens={tokens}
          />
        </MotiView>
      ))}
    </View>
  );
}

function FieldEngineersColumn({ items, styles, tokens }: { items: EngineerAvailability[]; styles: Styles; tokens: Tokens }) {
  if (items.length === 0) {
    return <EmptyColumn icon={<Wrench size={22} color={tokens.colors.onSurfaceVariant} />} label="No engineers on shift." tokens={tokens} />;
  }
  return (
    <View style={{ gap: 10 }}>
      {items.map((e, idx) => (
        <MotiView key={e.userId} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: idx * 40 }}>
          <StaffCard
            avatar={initials(e.name)}
            name={e.name}
            role={e.onShift ? 'AVAILABLE' : 'OFF SHIFT'}
            onShift={e.onShift}
            badges={(e.skills || []).slice(0, 2)}
            stats={[
              { label: 'Jobs', value: e.activeJobs },
              { label: 'Pending', value: e.pendingOffers },
              ...(e.avgResolutionMinutes != null ? [{ label: 'Avg Fix', value: `${e.avgResolutionMinutes}m` }] : []),
              ...(e.csatScore != null ? [{ label: 'CSAT', value: Number(e.csatScore).toFixed(1) }] : []),
            ]}
            load={Math.min(100, (e.activeJobs / Math.max(1, e.maxConcurrentLoad)) * 100)}
            overloaded={e.overloaded}
            styles={styles}
            tokens={tokens}
          />
        </MotiView>
      ))}
    </View>
  );
}

function StaffCard({
  avatar, name, role, onShift, badges, stats, load, overloaded, styles, tokens,
}: {
  avatar: string;
  name: string;
  role: string;
  onShift: boolean;
  badges: string[];
  stats: { label: string; value: number | string }[];
  load: number;
  overloaded: boolean;
  styles: Styles;
  tokens: Tokens;
}) {
  return (
    <View style={[styles.staffCard, { backgroundColor: tokens.colors.surfaceContainerLow, borderColor: tokens.colors.outlineVariant }]}>
      <View style={styles.staffHead}>
        <View style={[styles.staffAv, { backgroundColor: tokens.colors.secondarySoft }]}>
          <Text style={{ fontFamily: font('body', 600), fontSize: 12, color: tokens.colors.secondaryInk }}>{avatar}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: font('body', 600), fontSize: 14, color: tokens.colors.onSurface }} numberOfLines={1}>{name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <ShiftDot onShift={onShift} tokens={tokens} />
            <Text style={{ fontFamily: font('mono', 500), fontSize: 10, letterSpacing: 0.12 * 10, textTransform: 'uppercase', color: onShift ? tokens.colors.success : tokens.colors.outline }}>
              {role}
            </Text>
          </View>
        </View>
      </View>

      {badges.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {badges.map((b) => (
            <View key={b} style={[styles.skillChip, { backgroundColor: tokens.colors.surfaceContainer }]}>
              <Text style={{ fontFamily: font('mono', 400), fontSize: 9, letterSpacing: 0.12 * 9, textTransform: 'uppercase', color: tokens.colors.secondaryInk }}>{b}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.staffStats}>
        {stats.map((s) => (
          <View key={s.label} style={{ flexBasis: '46%' as `${number}%`, flexGrow: 1 }}>
            <Text style={{ fontFamily: font('mono', 500), fontSize: 9, letterSpacing: 0.12 * 9, textTransform: 'uppercase', color: tokens.colors.onSurfaceVariant }}>{s.label}</Text>
            <Text style={{ fontFamily: font('display', 700), fontSize: 18, color: tokens.colors.onSurface }}>{s.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.loadRow}>
        <View style={[styles.loadBar, { backgroundColor: tokens.colors.surfaceContainer }]}>
          <MotiView
            animate={{ width: `${load}%` }}
            transition={{ type: 'timing', duration: 600, easing: Easing.bezier(0.22, 1, 0.36, 1) }}
            style={{ height: '100%', backgroundColor: overloaded ? tokens.colors.error : tokens.colors.secondary, borderRadius: 999 }}
          />
        </View>
        <Text style={{ fontFamily: font('mono', 500), fontSize: 10, letterSpacing: 0.08 * 10, color: overloaded ? tokens.colors.error : tokens.colors.onSurfaceVariant, fontWeight: overloaded ? '700' : '500' }}>
          {Math.round(load)}%
        </Text>
      </View>
    </View>
  );
}

function ShiftDot({ onShift, tokens }: { onShift: boolean; tokens: Tokens }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!onShift) return undefined;
    pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1, false);
    return undefined;
  }, [onShift, pulse]);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 1.8 }],
    opacity: (1 - pulse.value) * 0.55,
  }));
  return (
    <View style={{ width: 8, height: 8, alignItems: 'center', justifyContent: 'center' }}>
      {onShift ? (
        <Animated.View
          style={[
            { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colors.success },
            ringStyle,
          ]}
        />
      ) : null}
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: onShift ? tokens.colors.success : tokens.colors.outlineVariant }} />
    </View>
  );
}

function EmptyColumn({ icon, label, tokens }: { icon: React.ReactNode; label: string; tokens: Tokens }) {
  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        alignItems: 'center', gap: 8, paddingVertical: 30, paddingHorizontal: 14,
        borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: tokens.colors.outlineVariant,
      }}
    >
      {icon}
      <Text variant="bodySm" color="onSurfaceVariant" align="center">{label}</Text>
    </MotiView>
  );
}

/* ─── Assign sheet (AssignModal ported as a bottom sheet) ──────────────── */
function AssignSheetContent({
  item, crmList, busy, onSubmit, onClose, styles, tokens,
}: {
  item: OpsInboxItem;
  crmList: CrmWorkloadItem[];
  busy: boolean;
  onSubmit: (payload: { crmId: string; mode: 'DIRECT' | 'INVITE'; note: string }) => void;
  onClose: () => void;
  styles: Styles;
  tokens: Tokens;
}) {
  const toast = useToast();
  const haptics = useHaptics();
  const [pickedId, setPickedId] = useState('');
  const [mode, setMode] = useState<'DIRECT' | 'INVITE'>('DIRECT');
  const [note, setNote] = useState('');

  const isInstall = item.kind === 'INSTALL';
  const subtitle = isInstall
    ? 'Send this installation lead to a CRM agent'
    : 'Offer this ticket to a CRM agent';

  const submit = () => {
    if (!pickedId) { toast.warning('Pick a CRM agent first.'); return; }
    onSubmit({ crmId: pickedId, mode, note });
  };

  return (
    <View style={{ flex: 1, gap: 12 }}>
      <View style={{ paddingHorizontal: space[5], flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headlineMd">{item.referenceNumber} — Assign</Text>
          <Text variant="bodySm" color="onSurfaceVariant">{subtitle}</Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={{ padding: 6 }}
        >
          <X size={18} color={tokens.colors.onSurfaceVariant} />
        </Pressable>
      </View>

      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: space[5], gap: 8 }}>
        {crmList.length === 0 ? (
          <Text variant="bodySm" color="onSurfaceVariant">No CRM agents on roster.</Text>
        ) : null}
        {crmList.map((c) => {
          const picked = c.userId === pickedId;
          return (
            <Pressable
              key={c.userId}
              onPress={() => { haptics.selection(); setPickedId(c.userId); }}
              style={[
                styles.modalRow,
                {
                  borderColor: picked ? tokens.colors.secondary : tokens.colors.outlineVariant,
                  backgroundColor: picked ? tokens.colors.secondarySoft : tokens.colors.surfaceContainerLow,
                },
              ]}
            >
              <View style={[styles.staffAv, { backgroundColor: tokens.colors.secondarySoft }]}>
                <Text style={{ fontFamily: font('body', 600), fontSize: 12, color: tokens.colors.secondaryInk }}>{initials(c.name)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={{ fontFamily: font('body', 600), fontSize: 14, color: tokens.colors.onSurface }}>{c.name}</Text>
                  {!c.onShift ? <TagMini label="off-shift" bg={tokens.colors.surfaceContainer} fg={tokens.colors.onSurfaceVariant} /> : null}
                  {c.overloaded ? <TagMini label="at capacity" bg={tokens.colors.errorContainer} fg={tokens.colors.error} /> : null}
                </View>
                <Text style={{ fontFamily: font('mono', 400), fontSize: 11, letterSpacing: 0.05 * 11, color: tokens.colors.onSurfaceVariant, marginTop: 2 }}>
                  {`Tickets ${c.activeTickets} · Installs ${c.activeInstalls} · Pending ${c.pendingOffers}`}
                  {c.csatScore != null ? ` · CSAT ${Number(c.csatScore).toFixed(1)}` : ''}
                </Text>
              </View>
              {picked ? <Check size={18} color={tokens.colors.secondaryInk} /> : null}
            </Pressable>
          );
        })}
      </BottomSheetScrollView>

      <View style={{ paddingHorizontal: space[5], gap: 12 }}>
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: font('mono', 600), fontSize: 10, letterSpacing: 0.14 * 10, textTransform: 'uppercase', color: tokens.colors.onSurfaceVariant }}>
            Offer mode
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(['DIRECT', 'INVITE'] as const).map((m) => (
              <FilterChip key={m} label={m === 'DIRECT' ? 'Direct' : 'Invite (can decline)'} selected={mode === m} onPress={() => setMode(m)} tokens={tokens} />
            ))}
          </View>
        </View>
        <TextArea
          label="Note (optional)"
          minHeight={56}
          maxLength={500}
          value={note}
          onChangeText={setNote}
          placeholder="VIP customer, prefer afternoon visit…"
        />
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: space[6] }}>
          <View style={{ flex: 1 }}>
            <Button variant="outline" fullWidth onPress={onClose} disabled={busy}>Cancel</Button>
          </View>
          <View style={{ flex: 2 }}>
            <Button
              variant="primary"
              fullWidth
              disabled={busy || !pickedId}
              loading={busy}
              leftIcon={!busy ? <Send size={14} color={tokens.colors.onSecondary} /> : undefined}
              onPress={submit}
            >
              Send offer
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}

function TagMini({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.xs, backgroundColor: bg }}>
      <Text style={{ fontFamily: font('mono', 600), fontSize: 9, letterSpacing: 0.08 * 9, textTransform: 'uppercase', color: fg }}>{label}</Text>
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Styles
 * ──────────────────────────────────────────────────────────────────────── */
function makeStyles(tokens: Tokens) {
  return {
    heroBlock: { gap: 18 as const },
    heroRow: {
      flexDirection: 'row' as const, alignItems: 'flex-end' as const, justifyContent: 'space-between' as const, gap: space[6], flexWrap: 'wrap' as const,
    },
    heroRowPhone: { flexDirection: 'column' as const, alignItems: 'stretch' as const, gap: space[3] },
    heroText: { gap: space[2], maxWidth: 540 },
    heroActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
    heroActionsPhone: { flexWrap: 'wrap' as const },
    searchBox: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, height: 38, paddingHorizontal: 14,
      borderWidth: 1, borderRadius: radius.full, minWidth: 220, flex: 1,
    },
    searchInput: { flex: 1, fontFamily: font('body', 400), fontSize: 13.5, padding: 0 },
    refreshBtn: {
      width: 38, height: 38, borderRadius: radius.full, borderWidth: 1, alignItems: 'center' as const, justifyContent: 'center' as const,
    },

    tiles: { flexDirection: 'row' as const, gap: 12, paddingRight: 4 },
    tile: {
      gap: 16, padding: 16, minWidth: 128, minHeight: 96, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' as const, ...shadow('card'),
    },
    tileLabel: {
      fontFamily: font('mono', 500), fontSize: 10, fontWeight: '500' as const, letterSpacing: 0.14 * 10, textTransform: 'uppercase' as const,
    },
    tileValue: { fontFamily: font('display', 700), fontSize: 26, letterSpacing: -0.02 * 26 },

    tabBar: { flexDirection: 'row' as const, gap: 8, paddingBottom: 2 },
    tabChip: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1,
    },
    tabCount: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.full, minWidth: 18, alignItems: 'center' as const },

    grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 16 },
    column: {
      flexGrow: 1, flexBasis: '46%' as `${number}%`, minWidth: 280, gap: 12, padding: 16, borderRadius: radius.lg, borderWidth: 1, ...shadow('card'),
    },
    columnHead: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingBottom: 10, borderBottomWidth: 1,
    },
    columnCount: { minWidth: 24, height: 22, paddingHorizontal: 7, borderRadius: radius.full, alignItems: 'center' as const, justifyContent: 'center' as const },

    chipRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },

    inboxCard: {
      gap: 8, padding: 14, borderRadius: radius.md, borderWidth: 1,
    },
    inboxHead: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, gap: 8 },
    inboxMeta: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, flexWrap: 'wrap' as const },
    inboxMetaText: { fontFamily: font('body', 400), fontSize: 12, color: tokens.colors.onSurfaceVariant },
    dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: tokens.colors.outline },
    escNote: { flexDirection: 'row' as const, gap: 6, padding: 10, borderRadius: radius.xs, alignItems: 'flex-start' as const },
    inboxFoot: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, flexWrap: 'wrap' as const,
    },
    installChip: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full,
    },
    inboxActions: { flexDirection: 'row' as const, gap: 6, marginTop: 4 },
    btnGhost: {
      flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 4, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.sm, borderWidth: 1,
    },
    btnPrimary: {
      flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 4, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.sm,
    },

    upgradeCard: { gap: 8, padding: 14, borderRadius: radius.md, borderWidth: 1 },
    upgradeTag: { alignSelf: 'flex-start' as const, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
    upgradeReviewBtn: { marginTop: 4, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.sm, alignItems: 'center' as const },

    staffCard: { gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1 },
    staffHead: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
    staffAv: {
      width: 36, height: 36, borderRadius: radius.full, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    skillChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.xs },
    staffStats: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },

    loadRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
    loadBar: { flex: 1, height: 4, borderRadius: 999, overflow: 'hidden' as const },

    modalRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1,
    },
  };
}
