import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  ChevronRight, Inbox, Star, ArrowRight, Sparkles, Plus, Search, WifiOff,
} from 'lucide-react-native';
import { EmptyState } from '@/components/primitives/EmptyState';

import { AppShell } from '@/components/shell/AppShell';
import { Text } from '@/components/primitives/Text';
import { Skeleton } from '@/components/primitives/Skeleton';
import { PressableScale } from '@/components/primitives/PressableScale';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { SlaCountdown } from '@/components/ui/SlaCountdown';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { tickets as ticketsApi } from '@/lib/api';
import type { ServiceTicket, TicketStatus } from '@/types/api';

// Ported from ../../aes-frontend/src/app/tickets/page.js +
// tickets.module.css. Filter match predicates and relativeShort() are
// copied verbatim — they are subtle (level/status combos).
type FilterKey = 'all' | 'open' | 'in' | 'resolved' | 'esc';

const FILTERS: { key: FilterKey; label: string; match: (t: ServiceTicket) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  {
    key: 'open',
    label: 'Open',
    match: (t) => ['OPEN', 'ACKNOWLEDGED', 'ASSIGNED'].includes(t.status) && (t.currentLevel || 1) === 1,
  },
  { key: 'in', label: 'In Progress', match: (t) => t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED' },
  { key: 'resolved', label: 'Resolved', match: (t) => t.status === 'RESOLVED' || t.status === 'CLOSED' },
  {
    key: 'esc',
    label: 'Escalated',
    match: (t) => (t.currentLevel || 1) > 1 && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status),
  },
];

type Tone = 'open' | 'progress' | 'resolved' | 'esc' | 'neutral';

const STATUS_TONE: Partial<Record<TicketStatus, Tone>> = {
  OPEN: 'open',
  ACKNOWLEDGED: 'open',
  ASSIGNED: 'progress',
  IN_PROGRESS: 'progress',
  RESOLVED: 'resolved',
  CLOSED: 'resolved',
  CANCELLED: 'neutral',
};

const STATUS_LABEL: Partial<Record<TicketStatus, string>> = {
  OPEN: 'Open',
  ACKNOWLEDGED: 'Acknowledged',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

const PROBLEM_LABEL: Record<string, string> = {
  NOT_COOLING: 'Not Cooling',
  NOISE: 'Loud Noise',
  LEAKING: 'Water Leak',
  NOT_TURNING_ON: 'Not Turning On',
  NO_AIRFLOW: 'No Airflow',
  REMOTE_WIFI: 'Remote / Wi-Fi',
  OTHER: 'Other Issue',
};

function relativeShort(date?: string | null): string {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ticketTitle(t: ServiceTicket): string {
  const issue = PROBLEM_LABEL[t.problemCategory] || t.problemCategory || 'Service';
  return `${issue}${t.acUnitRoom ? ` — ${t.acUnitRoom}` : ''}`;
}

export default function TicketsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const { isPhone } = useBreakpoint();
  const styles = useThemedStyles(makeStyles);

  const [ticketList, setTicketList] = useState<ServiceTicket[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await ticketsApi.list();
      const arr = Array.isArray(data) ? data : (data as { content?: ServiceTicket[] })?.content || [];
      setTicketList(arr);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filterFn = useMemo(() => (FILTERS.find((f) => f.key === filter) || FILTERS[0]).match, [filter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ticketList.filter((t) => {
      if (!filterFn(t)) return false;
      if (!q) return true;
      return [t.ticketNumber, t.problemCategory, t.acUnitRoom, t.propertyLabel]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [ticketList, filterFn, search]);

  const openCount = ticketList.filter((t) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status)).length;

  const hero = (
    <View style={[styles.heroRow, isPhone && styles.heroRowPhone]}>
      <View style={styles.heroText}>
        <Text variant="headlineXl" color="onSurfaceStrong">Service Requests</Text>
        <Text variant="bodyLg" color="onSurfaceVariant">
          {ticketList.length === 0
            ? 'You have no service tickets yet — raise one and our CRM team responds in 30 minutes.'
            : `${openCount} active · ${ticketList.length} total tickets across all your properties.`}
        </Text>
      </View>
      <View style={[styles.heroActions, isPhone && styles.heroActionsPhone]}>
        <View style={[styles.searchBox, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }, isPhone && styles.searchBoxPhone]}>
          <Search size={15} color={tokens.colors.onSurfaceVariant} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by ticket number, room, problem…"
            placeholderTextColor={tokens.colors.outline}
            style={styles.searchInput}
          />
        </View>
        <PressableScale
          style={[styles.newBtn, { backgroundColor: tokens.colors.secondary }, shadow('cta'), isPhone && styles.newBtnPhone]}
          onPress={() => router.push('/services/ticket')}
        >
          <Plus size={15} color={tokens.colors.onSecondary} />
          <Text style={[styles.newBtnLabel, { color: tokens.colors.onSecondary }]}>Raise Ticket</Text>
        </PressableScale>
      </View>
    </View>
  );

  const renderItem = useCallback((item: ServiceTicket, index: number) => (
    <RowEntering key={String(item.id || item.ticketNumber)} index={index} tablet={!isPhone} styles={styles}>
      <TicketCard ticket={item} onPress={() => router.push(`/tickets/${item.ticketNumber}`)} styles={styles} tokens={tokens} />
    </RowEntering>
  ), [isPhone, router, styles, tokens]);

  return (
    <AppShell
      hero={hero}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.secondary} />}
    >
      <View style={[styles.filterRow, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
        {FILTERS.map((f) => {
          const count = ticketList.filter(f.match).length;
          const active = filter === f.key;
          return (
            <PressableScale
              key={f.key}
              style={[styles.filterChip, active && { backgroundColor: tokens.colors.secondary }]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterChipLabel, { color: active ? tokens.colors.onSecondary : tokens.colors.onSurfaceVariant }]}>
                {f.label}
              </Text>
              <View style={[styles.filterCount, { backgroundColor: active ? 'rgba(255,255,255,0.20)' : tokens.colors.surfaceContainer }]}>
                <Text style={[styles.filterCountLabel, { color: active ? tokens.colors.onSecondary : tokens.colors.tertiary }]}>
                  {count}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={124} radius={16} />
          ))}
        </View>
      ) : error && ticketList.length === 0 ? (
        <EmptyState
          icon={<WifiOff size={26} color={tokens.colors.error} />}
          headline="Couldn't load your tickets"
          body="Check your connection and try again."
          ctaLabel="Retry"
          onCtaPress={load}
        />
      ) : filtered.length === 0 ? (
        <EmptyList filterKey={filter} hasSearch={!!search.trim()} styles={styles} tokens={tokens} router={router} />
      ) : (
        // A plain map inside AppShell's own ScrollView, not FlashList — a
        // customer's ticket list is realistically dozens of rows, not the
        // thousands FlashList's virtualization exists for, and FlashList
        // forces its container (and disableScroll's wrapping View) to
        // flex:1/fill the full screen height regardless of content length.
        // With only a few tickets that left a large empty area below the
        // last card, painted in FlashList's own internal backdrop colour
        // (not the app's cream background) rather than scrolling away like
        // the web's page naturally does.
        <View style={[styles.list, !isPhone && styles.listTablet]}>
          {filtered.map((item, index) => (
            <View key={String(item.id || item.ticketNumber)} style={!isPhone ? { width: '50%' } : undefined}>
              {renderItem(item, index)}
            </View>
          ))}
        </View>
      )}
    </AppShell>
  );
}

// Cell wrapper: fade+rise entrance, staggered up to the first 10 rows, with a
// plain (no-motion) fallback when Reduce Motion is on — see CLAUDE.md Phase 20.
const RowEntering = React.memo(function RowEntering({
  index, tablet, styles, children,
}: { index: number; tablet: boolean; styles: ReturnType<typeof makeStyles>; children: React.ReactNode }) {
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

type Styles = ReturnType<typeof makeStyles>;
type Tokens = ReturnType<typeof useTheme>['tokens'];
type Router = ReturnType<typeof useRouter>;

function TicketCard({
  ticket, onPress, styles, tokens,
}: { ticket: ServiceTicket; onPress: () => void; styles: Styles; tokens: Tokens }) {
  const escalated = (ticket.currentLevel || 1) > 1 && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(ticket.status);
  const resolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
  const needsRating = ticket.status === 'RESOLVED' && !ticket.customerRating;

  const tone: Tone = escalated ? 'esc' : resolved ? 'resolved' : STATUS_TONE[ticket.status] || 'open';

  const accentColor = {
    resolved: tokens.colors.success,
    esc: tokens.colors.error,
    progress: tokens.colors.warning,
    open: tokens.colors.secondary,
    neutral: tokens.colors.outline,
  }[tone];

  const pillColors = {
    open: { bg: tokens.colors.secondarySoft, fg: tokens.colors.secondaryInk },
    progress: { bg: tokens.colors.warningLight, fg: tokens.colors.warning },
    resolved: { bg: tokens.colors.successLight, fg: tokens.colors.success },
    esc: { bg: tokens.colors.errorContainer, fg: tokens.colors.error },
    neutral: { bg: tokens.colors.surfaceContainer, fg: tokens.colors.secondaryInk },
  }[tone];

  return (
    <PressableScale scaleTo={0.99} onPress={onPress} style={[styles.card, { backgroundColor: tokens.colors.surfaceContainerLowest }, shadow('card')]}>
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <Text style={[styles.ticketNumber, { color: tokens.colors.secondaryInk }]}>{ticket.ticketNumber}</Text>
          <PriorityBadge priority={ticket.priority} />
          <View style={[styles.statusPill, { backgroundColor: pillColors.bg }]}>
            <Text style={[styles.statusPillLabel, { color: pillColors.fg }]}>
              {escalated ? `Escalated · L${ticket.currentLevel}` : (STATUS_LABEL[ticket.status] || ticket.status)}
            </Text>
          </View>
        </View>

        <Text variant="headlineSm" color="onSurfaceStrong" numberOfLines={1}>{ticketTitle(ticket)}</Text>

        {ticket.propertyLabel ? (
          <Text variant="bodySm" color="onSurfaceVariant" numberOfLines={1}>{ticket.propertyLabel}</Text>
        ) : null}

        <View style={styles.cardFooter}>
          {!resolved && ticket.slaDeadlineL1 && (ticket.currentLevel || 1) === 1 && !ticket.acknowledgedAt ? (
            <SlaCountdown deadlineISO={ticket.slaDeadlineL1} />
          ) : null}
          {!resolved && ticket.slaDeadlineL2 && (ticket.currentLevel || 1) === 2 ? (
            <SlaCountdown deadlineISO={ticket.slaDeadlineL2} />
          ) : null}
          {resolved && ticket.resolvedAt ? (
            <Text style={styles.metaText}>{`Resolved ${relativeShort(ticket.resolvedAt)}`}</Text>
          ) : null}
          {!resolved && !ticket.slaDeadlineL1 ? (
            <Text style={styles.metaText}>{`Created ${relativeShort(ticket.createdAt)}`}</Text>
          ) : null}
          <Text style={[styles.dotSep, { color: tokens.colors.outlineVariant }]}>·</Text>
          <Text style={styles.metaText}>{`Opened ${relativeShort(ticket.createdAt)}`}</Text>
        </View>

        {needsRating ? (
          <View style={[styles.rateLink, { backgroundColor: tokens.colors.warningLight }]}>
            <Star size={13} color={tokens.colors.warning} />
            <Text style={[styles.rateLinkLabel, { color: tokens.colors.warning }]}>Rate your experience</Text>
            <ArrowRight size={11} color={tokens.colors.warning} />
          </View>
        ) : null}
      </View>
      <ChevronRight size={20} color={tokens.colors.onSurfaceVariant} />
    </PressableScale>
  );
}

function EmptyList({
  filterKey, hasSearch, styles, tokens, router,
}: { filterKey: FilterKey; hasSearch: boolean; styles: Styles; tokens: Tokens; router: Router }) {
  const isAll = filterKey === 'all' && !hasSearch;
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300 }}
      style={[styles.empty, { borderColor: tokens.colors.outlineVariant }]}
    >
      <View style={[styles.emptyIcon, { backgroundColor: tokens.colors.secondarySoft }]}>
        <Inbox size={26} color={tokens.colors.secondaryInk} />
      </View>
      <Text variant="headlineSm" color="onSurface" align="center">
        {isAll ? 'No tickets yet' : 'Nothing matches this view'}
      </Text>
      <Text variant="bodyMd" color="onSurfaceVariant" align="center" style={styles.emptyBody}>
        {isAll
          ? 'Raise a service ticket and our CRM team will respond within 30 minutes.'
          : hasSearch
            ? 'Try a different search term or clear the filter.'
            : 'Try a different filter to see your other tickets.'}
      </Text>
      {isAll ? (
        <PressableScale
          style={[styles.emptyCta, { backgroundColor: tokens.colors.secondary }, shadow('cta')]}
          onPress={() => router.push('/services/ticket')}
        >
          <Sparkles size={14} color={tokens.colors.onSecondary} />
          <Text style={[styles.emptyCtaLabel, { color: tokens.colors.onSecondary }]}>Raise a service ticket</Text>
        </PressableScale>
      ) : null}
    </MotiView>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  heroRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'space-between' as const,
    gap: space[6],
    flexWrap: 'wrap' as const,
  },
  heroRowPhone: {
    flexDirection: 'column' as const,
    alignItems: 'stretch' as const,
    gap: space[3],
  },
  heroText: {
    gap: space[2],
    maxWidth: 560,
  },
  heroActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    flexWrap: 'wrap' as const,
  },
  heroActionsPhone: {
    flexWrap: 'nowrap' as const,
    width: '100%' as const,
  },
  searchBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 14,
    height: 40,
    borderWidth: 1,
    borderRadius: radius.full,
    minWidth: 260,
  },
  searchBoxPhone: {
    flex: 1,
    minWidth: 0,
  },
  searchInput: {
    flex: 1,
    fontFamily: font('body', 400),
    fontSize: 13.5,
    color: tokens.colors.onSurface,
    paddingVertical: 0,
  },
  newBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 18,
    height: 40,
    borderRadius: radius.full,
  },
  newBtnPhone: {
    flexShrink: 0,
    paddingHorizontal: 14,
  },
  newBtnLabel: {
    fontFamily: font('body', 600),
    fontSize: 13,
  },

  filterRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderRadius: radius.lg,
    marginBottom: 22,
    ...shadow('card'),
  },
  filterChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
  },
  filterChipLabel: {
    fontFamily: font('body', 500),
    fontSize: 13,
  },
  filterCount: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  filterCountLabel: {
    fontFamily: font('mono', 600),
    fontSize: 10,
  },

  list: {
    gap: 12,
  },
  listTablet: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    marginHorizontal: -7,
  },
  listItemTablet: {
    paddingHorizontal: 7,
    marginBottom: 12,
  },
  listItemPhone: {
    marginBottom: 12,
  },

  card: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    padding: 18,
    paddingLeft: 20,
    borderRadius: radius.lg,
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  cardAccent: {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
  },
  cardBody: {
    flex: 1,
    gap: 6,
    paddingLeft: 4,
  },
  cardHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    flexWrap: 'wrap' as const,
  },
  ticketNumber: {
    fontFamily: font('mono', 600),
    fontSize: 11,
    letterSpacing: 0.10 * 11,
  },
  cardFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
    paddingTop: 4,
  },
  dotSep: {
    fontSize: 11,
  },
  metaText: {
    fontFamily: font('mono', 400),
    fontSize: 11,
    letterSpacing: 0.04 * 11,
    color: tokens.colors.onSurfaceVariant,
  },
  statusPill: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  statusPillLabel: {
    fontFamily: font('mono', 600),
    fontSize: 9.5,
    letterSpacing: 0.08 * 9.5,
    textTransform: 'uppercase' as const,
  },
  rateLink: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    alignSelf: 'flex-start' as const,
  },
  rateLinkLabel: {
    fontFamily: font('body', 600),
    fontSize: 12,
  },

  empty: {
    alignItems: 'center' as const,
    gap: 14,
    paddingVertical: 60,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderRadius: radius.xl,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emptyBody: {
    maxWidth: 420,
  },
  emptyCta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: radius.full,
  },
  emptyCtaLabel: {
    fontFamily: font('body', 600),
    fontSize: 14,
  },
});
