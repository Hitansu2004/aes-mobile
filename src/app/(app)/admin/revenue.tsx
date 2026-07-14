import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable, RefreshControl, ScrollView, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import {
  CalendarDays, TrendingUp, BarChart3, Calendar, Diamond, RefreshCw, Crown, ChevronRight, WifiOff,
} from 'lucide-react-native';

import { AppShell } from '@/components/shell/AppShell';
import { Text, Skeleton, CountUp, EmptyState } from '@/components/primitives';
import { useToast } from '@/context/ToastContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useHaptics } from '@/hooks/useHaptics';
import useStompTopic from '@/hooks/useStompTopic';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { adminRevenue as revenueApi } from '@/lib/api';
import type {
  AdminRevenueDashboard, RevenueTransaction, RevenueTeamRow, RevenueEngineerRow, RevenueKpi,
} from '@/types/api';

// Ported from ../../aes-frontend/src/app/admin/revenue/page.js +
// revenue.module.css. ⚠️ Amounts arrive in PAISE — fmtINR/fmtAmount are
// copied EXACTLY, never re-derived. The web's transactions table becomes a
// card list here (never a horizontally-scrolling table on a phone).
function fmtINR(paise?: number | null): { num: string; unit: string } {
  const v = Number(paise || 0);
  if (v >= 1_00_00_000) return { num: (v / 1_00_00_000).toFixed(2), unit: 'Cr' };
  if (v >= 1_00_000) return { num: (v / 1_00_000).toFixed(2), unit: 'L' };
  if (v >= 1_000) return { num: (v / 1_000).toFixed(1), unit: 'K' };
  return { num: v.toLocaleString('en-IN'), unit: '' };
}
function fmtAmount(paise?: number | null): string {
  const { num, unit } = fmtINR(paise);
  return `₹${num}${unit ? ` ${unit}` : ''}`;
}
function relTime(iso?: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function greetingFor(h: number = new Date().getHours()): string {
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}
function pct(v?: number | null): string | null {
  if (v == null) return null;
  const sign = v >= 0 ? '+' : '';
  return `${sign}${Number(v).toFixed(1)}%`;
}

export default function AdminRevenueScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const haptics = useHaptics();
  const { tokens } = useTheme();
  const { isPhone, isTablet, isLarge } = useBreakpoint();
  const styles = useThemedStyles(makeStyles);
  const toast = useToast();

  const [data, setData] = useState<AdminRevenueDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/admin/revenue'); return; }
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      router.replace(defaultRouteForRole(user.role));
    }
  }, [user, authLoading, router]);

  const fetchData = async (background = false) => {
    if (background) setRefreshing(true); else setLoading(true);
    try {
      const res = await revenueApi.fetch();
      setData(res || null);
      setLastUpdated(new Date());
      setError(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError(true);
      if (background) toast.error('Could not refresh revenue data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchData();
    const id = setInterval(() => fetchData(true), 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useStompTopic(user ? '/topic/ops/inbox' : null, () => fetchData(true), []);

  const kpi: RevenueKpi = data?.kpi || {
    today: 0, thisWeek: 0, thisMonth: 0, thisYear: 0, lifetime: 0, paidCount: 0, avgTicket: 0,
  };
  const transactions = data?.transactions || [];
  const teams = data?.teams || [];
  const engineers = data?.engineers || [];

  const engineerStats = useMemo(() => {
    const total = engineers.length;
    const onShift = engineers.filter((e) => e.onShift).length;
    const busy = engineers.filter((e) => Number(e.activeJobs) > 0).length;
    return { total, onShift, busy };
  }, [engineers]);

  const hero = (
    <View style={{ gap: space[4] }}>
      <View style={[styles.heroRow, isPhone && styles.heroRowPhone]}>
        <View style={{ gap: space[3], flex: 1 }}>
          <View style={styles.heroChip}>
            <Crown size={12} color={tokens.colors.secondaryInk} />
            <Text style={{ fontFamily: font('mono', 600), fontSize: 10, letterSpacing: 1.6, color: tokens.colors.secondaryInk }}>
              OWNER · REVENUE HQ
            </Text>
          </View>
          <Text variant="headlineXl" color="onSurfaceStrong">
            {greetingFor()}, {(user?.name?.split(' ')[0]) || 'there'}.
          </Text>
          <Text variant="bodyLg" color="onSurfaceVariant">
            Here&apos;s how AES is doing — updated live as payments land.
          </Text>
        </View>
        <View style={[styles.heroActions, isPhone && styles.heroActionsPhone]}>
          <Text style={{ fontFamily: font('mono', 400), fontSize: 11, letterSpacing: 0.88, color: tokens.colors.onSurfaceVariant }}>
            {refreshing ? 'Refreshing…' : lastUpdated ? `Updated ${relTime(lastUpdated.toISOString())}` : ''}
          </Text>
          <Pressable
            onPress={() => { haptics.tapLight(); fetchData(true); }}
            disabled={refreshing}
            accessibilityLabel="Refresh"
            style={[styles.iconBtn, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
          >
            <SpinningRefresh spinning={refreshing} color={tokens.colors.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  if (authLoading || !user || (loading && !data)) {
    return (
      <AppShell hero={hero}>
        <View style={{ gap: space[3] }}>
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={168} radius={16} />)}
        </View>
      </AppShell>
    );
  }

  if (error && !data) {
    return (
      <AppShell hero={hero}>
        <EmptyState
          icon={<WifiOff size={26} color={tokens.colors.error} />}
          headline="Couldn't load revenue data"
          body="Check your connection and try again."
          ctaLabel="Retry"
          onCtaPress={() => fetchData()}
        />
      </AppShell>
    );
  }

  const deltas = {
    today: pct(kpi.todayPctVsYesterday),
    thisWeek: pct(kpi.thisWeekPctVsLastWeek),
    thisMonth: pct(kpi.thisMonthPctVsLastMonth),
    thisYear: pct(kpi.thisYearPctVsLastYear),
  };

  return (
    <AppShell
      hero={hero}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={tokens.colors.secondary} />}
    >
      {/* Revenue tiles */}
      <ScrollView
        horizontal={isPhone || isTablet}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={(isPhone || isTablet) ? styles.revScroll : styles.revGrid}
        style={{ marginBottom: space[8] }}
      >
        <RevTile label="Today" amount={kpi.today} icon={CalendarDays} delta={deltas.today} deltaNote="vs yesterday" narrow={isPhone || isTablet} styles={styles} tokens={tokens} index={0} />
        <RevTile label="This Week" amount={kpi.thisWeek} icon={Calendar} delta={deltas.thisWeek} deltaNote="vs last week" narrow={isPhone || isTablet} styles={styles} tokens={tokens} index={1} />
        <RevTile label="This Month" amount={kpi.thisMonth} icon={BarChart3} delta={deltas.thisMonth} deltaNote="vs last month" narrow={isPhone || isTablet} styles={styles} tokens={tokens} index={2} />
        <RevTile label="This Year" amount={kpi.thisYear} icon={TrendingUp} delta={deltas.thisYear} deltaNote="vs last year" narrow={isPhone || isTablet} styles={styles} tokens={tokens} index={3} />
        <RevTile
          label="Lifetime"
          amount={kpi.lifetime}
          icon={Diamond}
          dark
          sub={`${(kpi.paidCount || 0).toLocaleString('en-IN')} paid tickets · avg ${fmtAmount(kpi.avgTicket)}`}
          narrow={isPhone || isTablet}
          styles={styles}
          tokens={tokens}
          index={4}
        />
      </ScrollView>

      {/* Stat strip */}
      <View style={[styles.statStrip, { borderColor: tokens.colors.outlineVariant }]}>
        <Stat label="Open Tickets" value={data?.openTickets ?? '—'} styles={styles} tokens={tokens} />
        <Stat label="Critical (P1)" value={data?.criticalOpen ?? '—'} danger styles={styles} tokens={tokens} />
        <Stat label="Eng On Shift" value={engineerStats.onShift} styles={styles} tokens={tokens} />
        <Stat label="Eng Busy" value={engineerStats.busy} styles={styles} tokens={tokens} />
      </View>

      {/* Transactions + Teams */}
      <View style={[styles.duo, isLarge && styles.duoWide]}>
        <Panel title="Recent Transactions" subtitle="Latest paid tickets — auto-updates" action={{ label: 'VIEW ALL', onPress: () => router.push('/admin') }} styles={styles} tokens={tokens}>
          {transactions.length === 0 ? (
            <EmptyRow styles={styles} tokens={tokens}>No transactions yet today.</EmptyRow>
          ) : (
            <View style={{ gap: space[2] }}>
              {transactions.slice(0, 12).map((tx, index) => (
                <TransactionRow key={`${tx.ticketNumber}-${tx.paidAt}`} tx={tx} router={router} styles={styles} tokens={tokens} index={index} />
              ))}
            </View>
          )}
        </Panel>

        <Panel title="Revenue by Team" subtitle="Today" styles={styles} tokens={tokens}>
          {teams.length === 0 ? (
            <EmptyRow styles={styles} tokens={tokens}>No team activity yet.</EmptyRow>
          ) : (
            <View>
              {teams.map((tm, index) => (
                <TeamRow key={tm.teamName} tm={tm} styles={styles} tokens={tokens} index={index} />
              ))}
            </View>
          )}
        </Panel>
      </View>

      {/* Engineers floor */}
      <View style={{ marginBottom: space[8] }}>
        <View style={styles.floorHead}>
          <Text style={styles.floorTitle}>Service Engineers Floor</Text>
          <Text style={styles.floorMeta}>{engineerStats.onShift} on shift · {engineerStats.busy} on jobs</Text>
        </View>
        {engineers.length === 0 ? (
          <EmptyRow styles={styles} tokens={tokens}>No engineer roster.</EmptyRow>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {engineers.map((e) => (
              <EngineerChip key={e.id} eng={e} styles={styles} tokens={tokens} />
            ))}
          </View>
        )}
      </View>
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

function RevTile({
  label, amount, icon: Icon, dark, sub, delta, deltaNote, narrow, styles, tokens, index = 0,
}: {
  label: string; amount?: number | null; icon: typeof CalendarDays; dark?: boolean; sub?: string;
  delta?: string | null; deltaNote?: string; narrow: boolean;
  styles: ReturnType<typeof makeStyles>; tokens: ReturnType<typeof useTheme>['tokens']; index?: number;
}) {
  const { num, unit } = fmtINR(amount);
  const numeric = Number(num.replace(/,/g, ''));
  const decimals = num.includes('.') ? num.split('.')[1].length : 0;
  const positive = !!delta && delta.startsWith('+');

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 320, delay: Math.min(index, 10) * 60 }}
      style={[styles.revTile, narrow && styles.revTileNarrow, dark ? styles.revTileDark : { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
    >
      <View style={styles.revTileHead}>
        <Text style={[styles.revTileLabel, { color: dark ? 'rgba(255,255,255,0.85)' : tokens.colors.onSurfaceVariant }]}>{label}</Text>
        <Icon size={16} color={dark ? 'rgba(255,255,255,0.85)' : tokens.colors.onSurfaceVariant} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        <Text style={[styles.revCurrency, { color: dark ? tokens.colors.inversePrimary : tokens.colors.secondaryInk }]}>₹</Text>
        <CountUp
          value={numeric}
          format={(n) => (decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString('en-IN'))}
          style={[styles.revAmount, { color: dark ? '#ffffff' : tokens.colors.secondaryInk }]}
        />
        {unit ? <Text style={[styles.revUnit, { color: dark ? tokens.colors.inversePrimary : tokens.colors.secondaryInk }]}>{unit}</Text> : null}
      </View>
      {delta && !dark ? (
        <Text style={[styles.revDelta, { color: positive ? tokens.colors.secondaryInk : tokens.colors.error, marginTop: 'auto' }]}>
          {delta} <Text style={{ color: tokens.colors.onSurfaceVariant, fontFamily: font('mono', 400) }}>{deltaNote}</Text>
        </Text>
      ) : null}
      {sub ? <Text style={[styles.revSub, { marginTop: 'auto' }]}>{sub}</Text> : null}
    </MotiView>
  );
}

function Stat({
  label, value, danger, styles, tokens,
}: {
  label: string; value: string | number; danger?: boolean;
  styles: ReturnType<typeof makeStyles>; tokens: ReturnType<typeof useTheme>['tokens'];
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, danger && { color: tokens.colors.error }]}>{label}</Text>
      {typeof value === 'number' ? (
        <CountUp value={value} style={[styles.statValue, danger && { color: tokens.colors.error }]} />
      ) : (
        <Text style={[styles.statValue, danger && { color: tokens.colors.error }]}>{value}</Text>
      )}
    </View>
  );
}

function Panel({
  title, subtitle, action, children, styles, tokens,
}: {
  title: string; subtitle?: string; action?: { label: string; onPress: () => void }; children: React.ReactNode;
  styles: ReturnType<typeof makeStyles>; tokens: ReturnType<typeof useTheme>['tokens'];
}) {
  return (
    <View style={[styles.panel, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
      <View style={styles.panelHead}>
        <View>
          <Text style={styles.panelTitle}>{title}</Text>
          {subtitle ? <Text style={styles.panelSub}>{subtitle}</Text> : null}
        </View>
        {action ? (
          <Pressable onPress={action.onPress} style={styles.panelAction}>
            <Text style={{ fontFamily: font('mono', 600), fontSize: 10, letterSpacing: 1.4, color: tokens.colors.secondaryInk }}>{action.label}</Text>
            <ChevronRight size={14} color={tokens.colors.secondaryInk} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function EmptyRow({ children, styles, tokens }: { children: React.ReactNode; styles: ReturnType<typeof makeStyles>; tokens: ReturnType<typeof useTheme>['tokens'] }) {
  return (
    <View style={[styles.empty, { backgroundColor: tokens.colors.surfaceContainerLow, borderColor: tokens.colors.outlineVariant }]}>
      <Text style={{ fontFamily: font('body', 400), fontSize: 14, color: tokens.colors.onSurfaceVariant }}>{children}</Text>
    </View>
  );
}

function TransactionRow({
  tx, router, styles, tokens, index = 0,
}: {
  tx: RevenueTransaction; router: ReturnType<typeof useRouter>;
  styles: ReturnType<typeof makeStyles>; tokens: ReturnType<typeof useTheme>['tokens']; index?: number;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: Math.min(index, 10) * 40 }}
      style={[styles.txCard, { backgroundColor: tokens.colors.surfaceContainerLow, borderColor: tokens.colors.outlineVariant }]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Pressable onPress={() => router.push(`/tickets/${tx.ticketNumber}`)}>
          <Text style={{ fontFamily: font('mono', 500), fontSize: 12, letterSpacing: 0.72, color: tokens.colors.secondaryInk }}>#{tx.ticketNumber}</Text>
        </Pressable>
        <Text style={{ fontFamily: font('display', 700), fontSize: 16, color: tokens.colors.secondaryInk }}>{fmtAmount(tx.amount)}</Text>
      </View>
      <Text style={{ fontFamily: font('body', 500), fontSize: 13, color: tokens.colors.onSurface, marginTop: 2 }}>{tx.customerName || '—'}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[styles.methodChip, { backgroundColor: tokens.colors.surfaceContainer }]}>
            <Text style={{ fontFamily: font('mono', 600), fontSize: 10, letterSpacing: 0.8, color: tokens.colors.secondaryInk }}>{(tx.method || 'MOCK').toString().toUpperCase()}</Text>
          </View>
          <Text style={{ fontFamily: font('body', 400), fontSize: 12, color: tokens.colors.onSurfaceVariant }}>{tx.team || '—'}</Text>
        </View>
        <Text style={{ fontFamily: font('mono', 400), fontSize: 11, letterSpacing: 0.66, color: tokens.colors.onSurfaceVariant }}>{relTime(tx.paidAt)}</Text>
      </View>
    </MotiView>
  );
}

function TeamRow({
  tm, styles, tokens, index = 0,
}: { tm: RevenueTeamRow; styles: ReturnType<typeof makeStyles>; tokens: ReturnType<typeof useTheme>['tokens']; index?: number }) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: Math.min(index, 10) * 40 }}
      style={[styles.teamRow, { borderBottomColor: tokens.colors.outlineVariant }]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: font('body', 600), fontSize: 14, color: tokens.colors.onSurface }}>{tm.teamName}</Text>
        <Text style={{ fontFamily: font('mono', 400), fontSize: 11, letterSpacing: 0.66, color: tokens.colors.onSurfaceVariant }}>
          {tm.activeTickets} active · {tm.resolvedToday} solved
        </Text>
      </View>
      <Text style={{ fontFamily: font('display', 700), fontSize: 18, color: tokens.colors.secondaryInk }}>{fmtAmount(tm.revenueToday)}</Text>
    </MotiView>
  );
}

function EngineerChip({ eng, styles, tokens }: { eng: RevenueEngineerRow; styles: ReturnType<typeof makeStyles>; tokens: ReturnType<typeof useTheme>['tokens'] }) {
  const onShift = !!eng.onShift;
  const displayName = (eng.name || '').split(' ').slice(0, 2).map((p, i) => (i === 0 ? `${p[0]}.` : p)).join(' ');
  return (
    <View
      style={[
        styles.engChip,
        onShift
          ? { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.secondaryLight }
          : { backgroundColor: tokens.colors.surfaceContainerLow, borderColor: tokens.colors.outlineVariant, opacity: 0.72 },
      ]}
    >
      <View style={[styles.engDot, { backgroundColor: onShift ? tokens.colors.secondary : tokens.colors.outlineVariant }]} />
      <Text style={{ fontFamily: font('body', 500), fontSize: 13, color: onShift ? tokens.colors.onSurface : tokens.colors.outline }}>{displayName}</Text>
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────── */
function makeStyles(tokens: ReturnType<typeof useTheme>['tokens']) {
  return {
    heroRow: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, justifyContent: 'space-between' as const, gap: space[6], flexWrap: 'wrap' as const },
    heroRowPhone: { flexDirection: 'column' as const, alignItems: 'stretch' as const },
    heroChip: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, alignSelf: 'flex-start' as const, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full, backgroundColor: tokens.colors.secondarySoft,
    },
    heroActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[3] },
    heroActionsPhone: { flexWrap: 'wrap' as const },
    iconBtn: { width: 38, height: 38, borderRadius: radius.full, borderWidth: 1, alignItems: 'center' as const, justifyContent: 'center' as const },

    revScroll: { gap: space[3], paddingVertical: 2 },
    revGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space[3] },
    revTile: {
      gap: space[4], padding: space[5], minHeight: 168, borderRadius: radius.lg, borderWidth: 1, flexBasis: '18%' as const, flexGrow: 1, minWidth: 220, ...shadow('card'),
    },
    revTileNarrow: { minWidth: 190, flexBasis: 'auto' as const },
    revTileDark: { borderColor: 'transparent', ...shadow('lg') },
    revTileHead: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    revTileLabel: { fontFamily: font('mono', 500), fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' as const },
    revCurrency: { fontFamily: font('mono', 600), fontSize: 20 },
    revAmount: { fontFamily: font('display', 700), fontSize: 30, lineHeight: 32, letterSpacing: -0.6 },
    revUnit: { fontFamily: font('display', 600), fontSize: 18 },
    revDelta: { fontFamily: font('mono', 500), fontSize: 11, letterSpacing: 0.66 },
    revSub: { fontFamily: font('body', 400), fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 18 },

    statStrip: {
      flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space[6], paddingVertical: space[5], paddingHorizontal: space[6], marginBottom: space[8], borderTopWidth: 1, borderBottomWidth: 1,
    },
    stat: { gap: 6, flexBasis: '40%' as const, flexGrow: 1 },
    statLabel: { fontFamily: font('mono', 500), fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' as const, color: tokens.colors.onSurfaceVariant },
    statValue: { fontFamily: font('display', 700), fontSize: 30, lineHeight: 32, color: tokens.colors.onSurfaceStrong },

    duo: { gap: space[6], marginBottom: space[10] },
    duoWide: { flexDirection: 'row' as const },
    panel: { flex: 1, padding: space[6], borderRadius: radius.lg, borderWidth: 1, ...shadow('card') },
    panelHead: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: space[3], marginBottom: space[4] },
    panelTitle: { fontFamily: font('display', 600), fontSize: 18, color: tokens.colors.onSurface },
    panelSub: { fontFamily: font('body', 400), fontSize: 12, color: tokens.colors.onSurfaceVariant, marginTop: 2 },
    panelAction: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm },

    empty: { padding: space[8], alignItems: 'center' as const, borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed' as const },

    txCard: { padding: space[3], borderRadius: radius.sm, borderWidth: 1 },
    methodChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.xs },

    teamRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: space[3], paddingVertical: space[3], borderBottomWidth: 1 },

    floorHead: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'baseline' as const, marginBottom: space[3], flexWrap: 'wrap' as const, gap: 4 },
    floorTitle: { fontFamily: font('display', 600), fontSize: 18, color: tokens.colors.onSurface },
    floorMeta: { fontFamily: font('mono', 400), fontSize: 11, letterSpacing: 0.88, color: tokens.colors.onSurfaceVariant },
    engChip: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1,
    },
    engDot: { width: 6, height: 6, borderRadius: 3 },
  };
}
