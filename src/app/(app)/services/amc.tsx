import React, { useCallback, useEffect, useState } from 'react';
import { Linking, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import {
  ArrowRight, Calendar, CheckCircle2, ClipboardCheck, Phone, ShieldCheck, XCircle, WifiOff,
} from 'lucide-react-native';

import { AppShell } from '@/components/shell/AppShell';
import { Splash } from '@/components/shell/Splash';
import { Text } from '@/components/primitives/Text';
import { PressableScale } from '@/components/primitives/PressableScale';
import { EmptyState } from '@/components/primitives/EmptyState';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { amc } from '@/lib/api';
import type { AmcContract } from '@/types/api';

// Ported from ../../aes-frontend/src/app/services/amc/page.js +
// amc.module.css. `c.planLabel` on the web has no field in AmcContract
// (types/api.ts) — the fallback string 'Annual Maintenance Contract' the web
// uses when planLabel is absent is therefore always shown here.
const PERKS = [
  { label: '4 visits per year', icon: Calendar },
  { label: 'Priority response (4 h SLA)', icon: ShieldCheck },
  { label: 'Genuine spare parts', icon: CheckCircle2 },
] as const;

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AmcScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const { isPhone } = useBreakpoint();
  const styles = useThemedStyles(makeStyles);

  const [contracts, setContracts] = useState<AmcContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await amc.myContracts();
      setContracts(Array.isArray(data) ? data : []);
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

  if (loading) return <Splash message="Loading AMC contracts…" />;

  const activeContracts = contracts.filter((c) => c.isActive);
  const expired = contracts.filter((c) => !c.isActive);

  const hero = (
    <View style={[styles.heroRow, isPhone && styles.heroRowPhone]}>
      <View style={styles.heroText}>
        <Text variant="headlineXl" color="onSurfaceStrong">AMC Service</Text>
        <Text variant="bodyLg" color="onSurfaceVariant">
          {contracts.length === 0
            ? 'Get peace of mind with our Annual Maintenance Contracts — 4 visits a year and priority service.'
            : `${activeContracts.length} active · ${expired.length} expired — manage your maintenance contracts here.`}
        </Text>
      </View>
      <PressableScale
        style={[styles.heroCta, { backgroundColor: tokens.colors.secondarySoft }]}
        haptic
        onPress={() => Linking.openURL('tel:+914066131555')}
      >
        <Phone size={14} color={tokens.colors.secondaryInk} />
        <Text style={[styles.heroCtaLabel, { color: tokens.colors.secondaryInk }]}>Call AMC desk</Text>
      </PressableScale>
    </View>
  );

  return (
    <AppShell
      hero={hero}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.secondary} />}
    >
      <View style={[styles.perks, isPhone && styles.perksPhone]}>
        {PERKS.map(({ label, icon: Icon }) => (
          <View key={label} style={[styles.perk, { backgroundColor: tokens.colors.surfaceContainerLowest }]}>
            <View style={[styles.perkIcon, { backgroundColor: tokens.colors.secondarySoft }]}>
              <Icon size={16} strokeWidth={2} color={tokens.colors.secondaryInk} />
            </View>
            <Text style={styles.perkLabel} color="onSurface">{label}</Text>
          </View>
        ))}
      </View>

      {error && contracts.length === 0 ? (
        <EmptyState
          icon={<WifiOff size={26} color={tokens.colors.error} />}
          headline="Couldn't load your AMC contracts"
          body="Check your connection and try again."
          ctaLabel="Retry"
          onCtaPress={load}
        />
      ) : contracts.length === 0 ? (
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 320 }}
          style={[styles.empty, { borderColor: tokens.colors.outlineVariant }]}
        >
          <View style={[styles.emptyIcon, { backgroundColor: tokens.colors.secondarySoft }]}>
            <ClipboardCheck size={26} color={tokens.colors.secondaryInk} />
          </View>
          <Text variant="headlineSm" color="onSurface" align="center">No AMC contracts on file</Text>
          <Text variant="bodyMd" color="onSurfaceVariant" align="center" style={styles.emptyBody}>
            We don&apos;t have any AMC contracts under your name. Call the AMC desk to enrol
            your equipment for proactive maintenance and faster ticket resolution.
          </Text>
          <View style={styles.emptyActions}>
            <PressableScale
              style={[styles.primaryBtn, { backgroundColor: tokens.colors.secondary }, shadow('cta')]}
              haptic
              onPress={() => Linking.openURL('tel:+914066131555')}
            >
              <Phone size={14} color={tokens.colors.onSecondary} />
              <Text style={[styles.primaryBtnLabel, { color: tokens.colors.onSecondary }]}>Call AMC desk</Text>
            </PressableScale>
            <PressableScale
              style={[styles.secondaryBtn, { borderColor: tokens.colors.outlineVariant }]}
              onPress={() => router.push('/services')}
            >
              <Text style={styles.secondaryBtnLabel} color="onSurface">Back to services</Text>
            </PressableScale>
          </View>
        </MotiView>
      ) : (
        <View style={[styles.contractList, !isPhone && styles.contractListWide]}>
          {contracts.map((c, i) => (
            <MotiView
              key={c.id}
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: i * 50 }}
              style={[!isPhone && styles.contractListItemWide]}
            >
              <ContractCard contract={c} onScheduleVisit={() => router.push('/services/ticket?amc=1')} onViewDetails={() => router.push('/account?tab=amc')} styles={styles} tokens={tokens} />
            </MotiView>
          ))}
        </View>
      )}
    </AppShell>
  );
}

type Styles = ReturnType<typeof makeStyles>;
type Tokens = ReturnType<typeof useTheme>['tokens'];

const ContractCard = React.memo(function ContractCard({
  contract: c, onScheduleVisit, onViewDetails, styles, tokens,
}: {
  contract: AmcContract; onScheduleVisit: () => void; onViewDetails: () => void; styles: Styles; tokens: Tokens;
}) {
  const visitsPerYear = c.visitsPerYear || 4;
  const percent = Math.min(100, ((c.visitsCompleted || 0) / visitsPerYear) * 100);
  const barWidth = useSharedValue(0);

  useEffect(() => {
    barWidth.value = withSpring(percent, { damping: 20, stiffness: 90 });
  }, [percent, barWidth]);

  const barStyle = useAnimatedStyle(() => ({ width: `${barWidth.value}%` }));

  return (
    <View style={[styles.card, { borderTopColor: c.isActive ? tokens.colors.secondary : tokens.colors.outlineVariant }]}>
      <View style={styles.cardHead}>
        <View style={styles.cardHeadLeft}>
          <Text style={[styles.contractNum, { color: tokens.colors.secondaryInk }]}>{c.contractNumber || 'AMC'}</Text>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: c.isActive ? tokens.colors.successLight : tokens.colors.surfaceContainer },
            ]}
          >
            {c.isActive
              ? <CheckCircle2 size={11} color={tokens.colors.success} />
              : <XCircle size={11} color={tokens.colors.onSurfaceVariant} />}
            <Text style={[styles.statusPillLabel, { color: c.isActive ? tokens.colors.success : tokens.colors.onSurfaceVariant }]}>
              {c.isActive ? 'Active' : 'Expired'}
            </Text>
          </View>
        </View>
        <Text variant="headlineMd" color="onSurfaceStrong">Annual Maintenance Contract</Text>
      </View>

      <View style={[styles.metaGrid, { backgroundColor: tokens.colors.surfaceContainerLow }]}>
        <Metric label="Start" value={fmtDate(c.startDate)} />
        <Metric label="Ends" value={fmtDate(c.endDate)} />
        <Metric label="Visits Used" value={`${c.visitsCompleted || 0}/${visitsPerYear}`} emphasize />
      </View>

      {visitsPerYear > 0 && (
        <View style={[styles.progressBar, { backgroundColor: tokens.colors.surfaceContainer }]}>
          <Animated.View style={[styles.progressFill, { backgroundColor: tokens.colors.secondary }, barStyle]} />
        </View>
      )}

      <View style={styles.cardFoot}>
        {c.isActive && (
          <PressableScale style={[styles.primaryBtn, { backgroundColor: tokens.colors.secondary }, shadow('cta')]} haptic onPress={onScheduleVisit}>
            <Text style={[styles.primaryBtnLabel, { color: tokens.colors.onSecondary }]}>Schedule visit</Text>
            <ArrowRight size={13} color={tokens.colors.onSecondary} />
          </PressableScale>
        )}
        <PressableScale style={[styles.secondaryBtn, { borderColor: tokens.colors.outlineVariant }]} onPress={onViewDetails}>
          <Text style={styles.secondaryBtnLabel} color="onSurface">View details</Text>
        </PressableScale>
      </View>
    </View>
  );
});

function Metric({
  label, value, emphasize,
}: { label: string; value: string; emphasize?: boolean }) {
  return (
    <View style={{ gap: 4 }}>
      <Text
        style={{
          fontFamily: font('mono', 400),
          fontSize: 10,
          letterSpacing: 0.10 * 10,
          textTransform: 'uppercase',
        }}
        color="onSurfaceVariant"
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: font('display', 600),
          fontSize: emphasize ? 22 : 15,
        }}
        color={emphasize ? 'secondaryInk' : 'onSurface'}
      >
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
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
  heroText: {
    flex: 1,
    gap: space[2],
  },
  heroCta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[2],
    paddingVertical: space[2] + 2,
    paddingHorizontal: space[4] + 2,
    borderRadius: radius.full,
  },
  heroCtaLabel: {
    fontFamily: font('body', 600),
    fontSize: 13,
  },

  perks: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: space[3],
    marginBottom: space[6],
  },
  perksPhone: {
    flexDirection: 'column' as const,
  },
  perk: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[3],
    flexGrow: 1,
    minWidth: 220,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    ...shadow('card'),
  },
  perkIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  perkLabel: {
    fontFamily: font('body', 400),
    fontSize: 13.5,
    flexShrink: 1,
  },

  contractList: {
    gap: space[4],
  },
  contractListWide: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    marginHorizontal: -space[2],
  },
  contractListItemWide: {
    width: '50%' as const,
    paddingHorizontal: space[2],
  },

  card: {
    gap: space[5],
    padding: space[6],
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: 'rgba(11, 26, 44, 0.06)',
    borderTopWidth: 4,
    borderRadius: radius.xl,
    ...shadow('card'),
  },
  cardHead: {
    gap: space[2],
  },
  cardHeadLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[3],
  },
  contractNum: {
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
    fontSize: 10,
    letterSpacing: 0.10 * 10,
    textTransform: 'uppercase' as const,
  },

  metaGrid: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    padding: space[4],
    borderRadius: radius.md,
  },

  progressBar: {
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%' as const,
    borderRadius: radius.full,
  },

  cardFoot: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: space[3],
  },
  primaryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[2],
    paddingVertical: space[3] - 2,
    paddingHorizontal: space[5],
    borderRadius: radius.full,
  },
  primaryBtnLabel: {
    fontFamily: font('body', 600),
    fontSize: 13,
  },
  secondaryBtn: {
    paddingVertical: space[3] - 2,
    paddingHorizontal: space[5],
    borderWidth: 1,
    borderRadius: radius.full,
  },
  secondaryBtnLabel: {
    fontFamily: font('body', 500),
    fontSize: 13,
  },

  empty: {
    alignItems: 'center' as const,
    gap: space[4],
    paddingVertical: space[12] + 8,
    paddingHorizontal: space[6],
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
  emptyActions: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'center' as const,
    gap: space[3],
    marginTop: space[1],
  },
});
