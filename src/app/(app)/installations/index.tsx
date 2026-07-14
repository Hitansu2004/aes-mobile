import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Building2, MapPin, Calendar, ArrowRight, ChevronRight, Snowflake,
  CheckCircle2, Clock, FileText, Plus, Search, WifiOff,
} from 'lucide-react-native';

import { AppShell } from '@/components/shell/AppShell';
import { Text } from '@/components/primitives/Text';
import { Skeleton } from '@/components/primitives/Skeleton';
import { PressableScale } from '@/components/primitives/PressableScale';
import { EmptyState } from '@/components/primitives/EmptyState';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { installations as installationsApi } from '@/lib/api';
import type { InstallationRequest, InstallationStatus } from '@/types/api';

// Ported from ../../aes-frontend/src/app/installations/page.js +
// installations.module.css. STATUS_GROUP and STATUS_LABEL are copied
// verbatim — all 17 statuses, do not paraphrase a single label.
type Group = 'pending' | 'active' | 'quote' | 'done';

const STATUS_GROUP: Record<InstallationStatus, Group> = {
  PENDING: 'pending',
  NEW: 'pending',
  OFFERED_CRM: 'pending',
  CONFIRMED: 'active',
  SURVEY_SCHEDULED: 'active',
  SITE_VISITED: 'active',
  SITE_VISIT_DONE: 'active',
  QUOTE_DRAFT: 'quote',
  QUOTE_PENDING_APPROVAL: 'quote',
  QUOTE_REJECTED_INTERNAL: 'quote',
  QUOTE_SENT: 'quote',
  QUOTE_NEGOTIATING: 'quote',
  QUOTE_ACCEPTED: 'active',
  INSTALLATION_SCHEDULED: 'active',
  INSTALLATION_IN_PROGRESS: 'active',
  COMPLETED: 'done',
  CANCELLED: 'done',
};

const STATUS_LABEL: Record<InstallationStatus, string> = {
  PENDING: 'Awaiting triage',
  NEW: 'Awaiting triage',
  OFFERED_CRM: 'Awaiting CRM acceptance',
  CONFIRMED: 'Confirmed by CRM',
  SURVEY_SCHEDULED: 'Site survey scheduled',
  SITE_VISITED: 'Site survey done',
  SITE_VISIT_DONE: 'Site survey done',
  QUOTE_DRAFT: 'Quote being prepared',
  QUOTE_PENDING_APPROVAL: 'Quote awaiting approval',
  QUOTE_REJECTED_INTERNAL: 'Quote rework in progress',
  QUOTE_SENT: 'Estimate sent — review',
  QUOTE_NEGOTIATING: 'Negotiating quote',
  QUOTE_ACCEPTED: 'Quote accepted',
  INSTALLATION_SCHEDULED: 'Installation scheduled',
  INSTALLATION_IN_PROGRESS: 'Installation in progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

type TabKey = 'all' | Group;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All projects' },
  { key: 'pending', label: 'New' },
  { key: 'active', label: 'In progress' },
  { key: 'quote', label: 'Quote' },
  { key: 'done', label: 'Completed' },
];

function fmtDate(iso?: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function roomCount(roomsJson?: string): number {
  try {
    const r: unknown = JSON.parse(roomsJson || '[]');
    return Array.isArray(r) ? r.length : 0;
  } catch {
    return 0;
  }
}

export default function InstallationsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const { isPhone } = useBreakpoint();
  const styles = useThemedStyles(makeStyles);

  const [items, setItems] = useState<InstallationRequest[]>([]);
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await installationsApi.list();
      const arr = Array.isArray(data) ? data : (data as { content?: InstallationRequest[] })?.content || [];
      setItems(arr);
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

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { all: items.length, pending: 0, active: 0, quote: 0, done: 0 };
    items.forEach((i) => {
      const g = STATUS_GROUP[i.status] || 'pending';
      c[g] = (c[g] || 0) + 1;
    });
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      const grp = STATUS_GROUP[i.status] || 'pending';
      if (tab !== 'all' && grp !== tab) return false;
      if (!q) return true;
      return [i.requestNumber, i.acType, i.brand, i.modelNumber, i.propertyLabel]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [items, tab, search]);

  const inProgress = counts.active + counts.quote;

  const hero = (
    <View style={[styles.heroRow, isPhone && styles.heroRowPhone]}>
      <View style={styles.heroText}>
        <Text variant="headlineXl" color="onSurfaceStrong">My Projects</Text>
        <Text variant="bodyLg" color="onSurfaceVariant">
          {items.length === 0
            ? 'You haven’t requested an installation yet — start a new one when you’re ready.'
            : `${inProgress} in progress · ${counts.done} completed · ${items.length} total installations.`}
        </Text>
      </View>
      <View style={[styles.heroActions, isPhone && styles.heroActionsPhone]}>
        <View style={[styles.searchBox, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }, isPhone && styles.searchBoxPhone]}>
          <Search size={15} color={tokens.colors.onSurfaceVariant} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search request, brand, model, property…"
            placeholderTextColor={tokens.colors.outline}
            style={styles.searchInput}
          />
        </View>
        <PressableScale
          style={[styles.newBtn, { backgroundColor: tokens.colors.secondary }, shadow('cta'), isPhone && styles.newBtnPhone]}
          onPress={() => router.push('/services/installation')}
        >
          <Plus size={15} color={tokens.colors.onSecondary} />
          <Text style={[styles.newBtnLabel, { color: tokens.colors.onSecondary }]}>New Installation</Text>
        </PressableScale>
      </View>
    </View>
  );

  const renderItem = useCallback((item: InstallationRequest, index: number) => (
    <InstallRowEntering key={String(item.id)} index={index} tablet={!isPhone} styles={styles}>
      <InstallCard req={item} onPress={() => router.push(`/installations/${item.requestNumber}`)} styles={styles} tokens={tokens} />
    </InstallRowEntering>
  ), [isPhone, router, styles, tokens]);

  return (
    <AppShell
      hero={hero}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.secondary} />}
    >
      {isPhone ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.tabsScrollPhone, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
          contentContainerStyle={styles.tabsRowPhone}
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <PressableScale
                key={t.key}
                style={[styles.tab, styles.tabPhone, active && { backgroundColor: tokens.colors.secondary }]}
                onPress={() => setTab(t.key)}
              >
                <Text style={[styles.tabLabel, styles.tabLabelPhone, { color: active ? tokens.colors.onSecondary : tokens.colors.onSurfaceVariant }]}>
                  {t.label}
                </Text>
                <View style={[styles.tabCount, { backgroundColor: active ? 'rgba(255,255,255,0.20)' : tokens.colors.surfaceContainer }]}>
                  <Text style={[styles.tabCountLabel, { color: active ? tokens.colors.onSecondary : tokens.colors.secondaryInk }]}>
                    {counts[t.key] || 0}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
        </ScrollView>
      ) : (
        <View style={[styles.tabsRow, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <PressableScale
                key={t.key}
                style={[styles.tab, active && { backgroundColor: tokens.colors.secondary }]}
                onPress={() => setTab(t.key)}
              >
                <Text style={[styles.tabLabel, { color: active ? tokens.colors.onSecondary : tokens.colors.onSurfaceVariant }]}>
                  {t.label}
                </Text>
                <View style={[styles.tabCount, { backgroundColor: active ? 'rgba(255,255,255,0.20)' : tokens.colors.surfaceContainer }]}>
                  <Text style={[styles.tabCountLabel, { color: active ? tokens.colors.onSecondary : tokens.colors.secondaryInk }]}>
                    {counts[t.key] || 0}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
        </View>
      )}

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={104} radius={16} />
          ))}
        </View>
      ) : error && items.length === 0 ? (
        <EmptyState
          icon={<WifiOff size={26} color={tokens.colors.error} />}
          headline="Couldn't load your installations"
          body="Check your connection and try again."
          ctaLabel="Retry"
          onCtaPress={load}
        />
      ) : visible.length === 0 ? (
        <EmptyList hasSearch={!!search.trim()} isAll={tab === 'all'} styles={styles} tokens={tokens} router={router} />
      ) : (
        // Plain map inside AppShell's own ScrollView — see the matching note
        // in tickets/index.tsx. FlashList forced this screen's disableScroll
        // wrapper to flex:1/fill the full viewport regardless of how many
        // installations exist, leaving a large empty area (in FlashList's
        // own backdrop colour, not the app's) below a short list.
        <View style={[styles.list, !isPhone && styles.listTablet]}>
          {visible.map((item, index) => (
            <View key={String(item.id)} style={!isPhone ? { width: '50%' } : undefined}>
              {renderItem(item, index)}
            </View>
          ))}
        </View>
      )}
    </AppShell>
  );
}

const InstallRowEntering = React.memo(function InstallRowEntering({
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

function InstallCard({
  req, onPress, styles, tokens,
}: { req: InstallationRequest; onPress: () => void; styles: Styles; tokens: Tokens }) {
  const group = STATUS_GROUP[req.status] || 'pending';
  const label = STATUS_LABEL[req.status] || req.status;
  const Icon = group === 'done' ? CheckCircle2
    : group === 'quote' ? FileText
      : group === 'active' ? Building2
        : Clock;
  const rooms = roomCount(req.roomsJson);
  const scheduled = fmtDate(req.scheduledDate);

  const accentColor = {
    pending: tokens.colors.warning,
    active: tokens.colors.secondary,
    quote: tokens.colors.info,
    done: tokens.colors.success,
  }[group];

  const pillColors = {
    pending: { bg: tokens.colors.warningLight, fg: tokens.colors.warning },
    active: { bg: tokens.colors.secondarySoft, fg: tokens.colors.secondaryInk },
    quote: { bg: tokens.colors.secondarySoft, fg: tokens.colors.secondaryInk },
    done: { bg: tokens.colors.successLight, fg: tokens.colors.success },
  }[group];

  return (
    <PressableScale scaleTo={0.99} onPress={onPress} style={[styles.card, { backgroundColor: tokens.colors.surfaceContainerLowest }, shadow('card')]}>
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={[styles.numberPill, { color: tokens.colors.secondaryInk }]}>{req.requestNumber}</Text>
          <View style={[styles.statusPill, { backgroundColor: pillColors.bg }]}>
            <Icon size={11} color={pillColors.fg} />
            <Text style={[styles.statusPillLabel, { color: pillColors.fg }]}>{label}</Text>
          </View>
        </View>

        <Text variant="headlineSm" color="onSurfaceStrong" numberOfLines={1} style={styles.cardTitle}>
          {(req.acType || '').replace('_', ' / ')} Installation{req.tonnage ? ` · ${req.tonnage} ton` : ''}
        </Text>

        <View style={styles.cardMeta}>
          {req.brand ? (
            <View style={styles.cardMetaItem}>
              <Snowflake size={12} color={tokens.colors.onSurfaceVariant} />
              <Text style={styles.cardMetaText}>{req.brand}{req.modelNumber ? ` ${req.modelNumber}` : ''}</Text>
            </View>
          ) : null}
          {req.propertyLabel ? (
            <View style={styles.cardMetaItem}>
              <MapPin size={12} color={tokens.colors.onSurfaceVariant} />
              <Text style={styles.cardMetaText}>{req.propertyLabel}</Text>
            </View>
          ) : null}
          {rooms > 0 ? (
            <View style={styles.cardMetaItem}>
              <Text style={styles.cardMetaText}>{rooms} room{rooms > 1 ? 's' : ''}</Text>
            </View>
          ) : null}
          {scheduled ? (
            <View style={styles.cardMetaItem}>
              <Calendar size={12} color={tokens.colors.onSurfaceVariant} />
              <Text style={styles.cardMetaText}>{scheduled}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <ChevronRight size={20} color={tokens.colors.onSurfaceVariant} />
    </PressableScale>
  );
}

function EmptyList({
  hasSearch, isAll, styles, tokens, router,
}: { hasSearch: boolean; isAll: boolean; styles: Styles; tokens: Tokens; router: Router }) {
  let headline: string;
  let body: string;
  let showCta = false;

  if (hasSearch) {
    headline = 'No matching projects';
    body = 'Try a different search term or clear the filter to see all projects.';
  } else if (!isAll) {
    headline = 'Nothing here yet';
    body = 'Try switching to a different tab — your other projects may be in another stage.';
  } else {
    headline = 'No projects yet';
    body = 'Request a new AC installation and we’ll take care of survey, quote and fitting.';
    showCta = true;
  }

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300 }}
      style={[styles.empty, { borderColor: tokens.colors.outlineVariant }]}
    >
      <View style={[styles.emptyIcon, { backgroundColor: tokens.colors.secondarySoft }]}>
        <Snowflake size={26} color={tokens.colors.secondaryInk} />
      </View>
      <Text variant="headlineSm" color="onSurface" align="center">{headline}</Text>
      <Text variant="bodyMd" color="onSurfaceVariant" align="center" style={styles.emptyBody}>{body}</Text>
      {showCta ? (
        <PressableScale
          style={[styles.emptyCta, { backgroundColor: tokens.colors.secondary }, shadow('cta')]}
          onPress={() => router.push('/services/installation')}
        >
          <Plus size={14} color={tokens.colors.onSecondary} />
          <Text style={[styles.emptyCtaLabel, { color: tokens.colors.onSecondary }]}>Start a new installation</Text>
          <ArrowRight size={13} color={tokens.colors.onSecondary} />
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

  tabsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderRadius: radius.lg,
    marginBottom: 22,
    ...shadow('card'),
  },
  tab: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
  },
  tabLabel: {
    fontFamily: font('body', 500),
    fontSize: 13,
  },
  // Web mobile CSS (installations.module.css, ≤768px): edge-to-edge
  // horizontal scroll instead of wrap — wrapping left a ragged empty
  // gap at the end of the last row on phone widths.
  tabsScrollPhone: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginHorizontal: -space[4],
    marginBottom: 16,
    ...shadow('card'),
  },
  tabsRowPhone: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: space[4],
  },
  tabPhone: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  tabLabelPhone: {
    fontSize: 12,
  },
  tabCount: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  tabCountLabel: {
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
  cardTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    flexWrap: 'wrap' as const,
  },
  numberPill: {
    fontFamily: font('mono', 600),
    fontSize: 11,
    letterSpacing: 0.10 * 11,
  },
  statusPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
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
  cardTitle: {
    textTransform: 'capitalize' as const,
  },
  cardMeta: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    columnGap: 12,
    rowGap: 4,
    paddingTop: 2,
  },
  cardMetaItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  cardMetaText: {
    fontFamily: font('body', 400),
    fontSize: 12.5,
    color: tokens.colors.onSurfaceVariant,
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
