import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming,
} from 'react-native-reanimated';
import {
  ArrowRight, Building2, Droplets, History, MapPin, Radio, ShieldCheck, Snowflake, Wrench,
} from 'lucide-react-native';

import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/shell/AppShell';
import { Splash } from '@/components/shell/Splash';
import { Text } from '@/components/primitives/Text';
import { PressableScale } from '@/components/primitives/PressableScale';
import { CountUp } from '@/components/primitives/CountUp';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import {
  amc as amcApi, dashboard as dashboardApi, installations as installationsApi, tickets as ticketsApi,
} from '@/lib/api';
import type {
  AmcContract, DashboardStats, InstallationRequest, ServiceTicket,
} from '@/types/api';

// Ported from ../../aes-frontend/src/app/dashboard/page.js +
// dashboard.module.css ("Rose Luxury redesign"). See CLAUDE.md — every
// string, colour and layout choice below is copied verbatim from that pair
// of files; motion (stagger, spring progress bar, pulsing status dot,
// pull-to-refresh) is the mobile-only addition.
const TERMINAL_TICKET = ['RESOLVED', 'CLOSED', 'CANCELLED'];

function greetingFor(h: number = new Date().getHours()): string {
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// The web's TICKET_ICONS map — direct-key lookup first, then a substring
// scan. Not every ProblemCategory in the current backend contract matches a
// key (NOT_TURNING_ON/NO_AIRFLOW/REMOTE_WIFI/SMELL_BURNING/OTHER all fall
// through), which mirrors the web's own behaviour exactly.
const TICKET_ICONS: Record<string, typeof Snowflake> = {
  COOLING: Snowflake,
  NOT_COOLING: Snowflake,
  WATER: Droplets,
  LEAKING: Droplets,
  WATER_LEAK: Droplets,
  NOISE: Radio,
  SENSOR: Radio,
  ELECTRICAL: Radio,
};
function iconForTicket(t: ServiceTicket): typeof Snowflake {
  const k = (t.problemCategory || '').toUpperCase();
  if (TICKET_ICONS[k]) return TICKET_ICONS[k];
  for (const key of Object.keys(TICKET_ICONS)) {
    if (k.includes(key)) return TICKET_ICONS[key];
  }
  return Snowflake;
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Resolved',
  COMPLETED: 'Resolved',
  CANCELLED: 'Cancelled',
  PENDING: 'Pending',
  AWAITING_ASSIGNMENT: 'Pending',
  ASSIGNED: 'Scheduled',
  EN_ROUTE: 'En Route',
  ARRIVED: 'On Site',
};
function statusFor(t: ServiceTicket): string {
  const raw = (t.status || '').toUpperCase();
  return STATUS_LABEL[raw] || raw.replace(/_/g, ' ');
}

type TicketTone = 'resolved' | 'scheduled' | 'inprogress' | 'cancelled' | 'pending';
function statusTone(raw: string | undefined): TicketTone {
  const s = (raw || '').toUpperCase();
  if (['RESOLVED', 'CLOSED', 'COMPLETED'].includes(s)) return 'resolved';
  if (['SCHEDULED', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED'].includes(s)) return 'scheduled';
  if (s === 'IN_PROGRESS') return 'inprogress';
  if (s === 'CANCELLED') return 'cancelled';
  return 'pending';
}

function formatTicketDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.getFullYear() === today.getFullYear()
    && d.getMonth() === today.getMonth()
    && d.getDate() === today.getDate();
  if (sameDay) {
    return `Today, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
  }
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear()
    && d.getMonth() === yesterday.getMonth()
    && d.getDate() === yesterday.getDate()
  ) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// deriveProgress() ported verbatim from the web — its status keys
// (DRAFT/QUOTE_PREP/AWAITING_HANDOFF/...) are an older naming scheme than
// InstallationStatus in types/api.ts, but the map is kept exactly as the
// web has it; anything that doesn't match falls to the same default.
const PROGRESS_MAP: Record<string, { label: string; percent: number }> = {
  DRAFT: { label: 'Phase 1: Draft', percent: 8 },
  QUOTE_PREP: { label: 'Phase 1: Quote prep', percent: 18 },
  QUOTE_SENT: { label: 'Phase 1: Quote sent', percent: 28 },
  QUOTE_APPROVED: { label: 'Phase 1: Approved', percent: 40 },
  SCHEDULED: { label: 'Phase 2: Scheduled', percent: 55 },
  ASSIGNED: { label: 'Phase 2: Assigned', percent: 60 },
  IN_PROGRESS: { label: 'Phase 2: Installation', percent: 75 },
  AWAITING_HANDOFF: { label: 'Phase 3: Handoff', percent: 90 },
  COMPLETED: { label: 'Completed', percent: 100 },
};
function deriveProgress(project?: InstallationRequest): { label: string; percent: number } {
  if (!project) return { label: 'Awaiting start', percent: 0 };
  return PROGRESS_MAP[(project.status || '').toUpperCase()] || { label: 'Phase 1: In review', percent: 25 };
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { tokens } = useTheme();
  const { isPhone, isLarge } = useBreakpoint();
  const styles = useThemedStyles(makeStyles);

  const [dash, setDash] = useState<DashboardStats | null>(null);
  const [contracts, setContracts] = useState<AmcContract[]>([]);
  const [requests, setRequests] = useState<InstallationRequest[]>([]);
  const [allTickets, setAllTickets] = useState<ServiceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fired in parallel with Promise.allSettled — exactly as the web does, so
  // one failing endpoint never blanks the whole screen.
  const loadAll = useCallback(async () => {
    const [dashRes, amcRes, instRes, tickRes] = await Promise.allSettled([
      dashboardApi.customer(),
      amcApi.myContracts(),
      installationsApi.list(),
      ticketsApi.list(),
    ]);
    if (dashRes.status === 'fulfilled') setDash(dashRes.value);
    if (amcRes.status === 'fulfilled') setContracts(Array.isArray(amcRes.value) ? amcRes.value : []);
    // installation-requests and service-tickets are paginated on the backend
    // (Spring-style { content, page, size, totalElements, totalPages }, not a
    // bare array) — ported verbatim from the web's same defensive unwrap
    // (dashboard/page.js lines 135-144). amc-contracts is NOT paginated, so
    // it stays a plain Array.isArray check above.
    if (instRes.status === 'fulfilled') {
      const arr = Array.isArray(instRes.value)
        ? instRes.value
        : (instRes.value as unknown as { content?: InstallationRequest[] })?.content || [];
      setRequests(arr);
    }
    if (tickRes.status === 'fulfilled') {
      const arr = Array.isArray(tickRes.value)
        ? tickRes.value
        : (tickRes.value as unknown as { content?: ServiceTicket[] })?.content || [];
      setAllTickets(arr);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadAll();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const activeContract = useMemo(
    () => contracts.find((c) => c.isActive) || contracts[0],
    [contracts],
  );

  // Prefer the full ticket list (up to 3 most recent); fall back to the
  // dashboard summary if the list call failed — ported verbatim from the web.
  const recentTickets = (allTickets.length ? allTickets : dash?.recentTickets || []).slice(0, 3);
  const openTickets = allTickets.length
    ? allTickets.filter((t) => !TERMINAL_TICKET.includes((t.status || '').toUpperCase())).length
    : dash?.openTickets ?? recentTickets.length;

  const activeProjects = requests.filter(
    (r) => !['COMPLETED', 'CANCELLED', 'QUOTE_REJECTED_INTERNAL'].includes(r.status),
  );
  const firstProject = activeProjects[0];
  const projectProgress = useMemo(() => deriveProgress(firstProject), [firstProject]);

  if (loading) {
    return <Splash message="Preparing your dashboard…" />;
  }

  const firstName = user?.name?.split(' ')[0] || 'there';
  const greetingSize = isPhone ? 28 : isLarge ? 48 : 36;
  const endLabel = activeContract?.endDate
    ? new Date(activeContract.endDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : '—';

  return (
    <AppShell
      bare
      refreshControl={(
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.secondary} />
      )}
    >
      <View style={[styles.hero, isPhone && styles.heroPhone]}>
        <Text
          style={[styles.greeting, { fontSize: greetingSize, lineHeight: greetingSize * 1.08 }]}
          color="onSurfaceStrong"
        >
          {greetingFor()}, {firstName}.
        </Text>
        <Text style={styles.greetingSub} color="onSurfaceVariant">
          Your climate control ecosystem is operating at peak efficiency across all monitored zones.
        </Text>
      </View>

      <View style={[styles.stack, isPhone && styles.stackPhone]}>
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 350, delay: 0 }}
          style={[styles.actionGrid, isPhone && styles.actionGridPhone]}
        >
          <ActionCard
            icon={Building2}
            title="New Installation"
            body="Expand your infrastructure with precision-engineered solutions tailored to your facility."
            cta="Consult an Expert"
            onPress={() => router.push('/services/installation')}
            styles={styles}
            tokens={tokens}
          />
          <ActionCard
            icon={Wrench}
            title="Schedule Repair"
            body="Request immediate technical intervention for anomalous equipment behavior."
            cta="Book Technician"
            onPress={() => router.push('/services/ticket')}
            styles={styles}
            tokens={tokens}
          />
          <AmcCard
            active={!!activeContract}
            endLabel={endLabel}
            onPress={() => router.push('/services/amc')}
            styles={styles}
            tokens={tokens}
          />
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 350, delay: 60 }}
          style={[styles.duo, isPhone && styles.duoPhone]}
        >
          <Panel
            title="Active Projects"
            count={activeProjects.length}
            actionLabel="View All"
            onActionPress={() => router.push('/installations')}
            styles={styles}
            tokens={tokens}
            isPhone={isPhone}
          >
            {firstProject ? (
              <>
                <ProjectFeature project={firstProject} progress={projectProgress} onPress={() => router.push(`/installations/${firstProject.requestNumber}`)} styles={styles} tokens={tokens} />
                {activeProjects.length > 1 && (
                  <View style={styles.projectMore}>
                    {activeProjects.slice(1, 4).map((p) => (
                      <ProjectMini
                        key={p.id || p.requestNumber}
                        project={p}
                        onPress={() => router.push(`/installations/${p.requestNumber}`)}
                        styles={styles}
                        tokens={tokens}
                      />
                    ))}
                    {activeProjects.length > 4 && (
                      <PressableScale style={styles.projectMoreCta} onPress={() => router.push('/installations')}>
                        <Text style={[styles.projectMoreCtaLabel, { color: tokens.colors.secondaryInk }]}>
                          + {activeProjects.length - 4} more project{activeProjects.length - 4 === 1 ? '' : 's'}
                        </Text>
                        <ArrowRight size={14} color={tokens.colors.secondaryInk} />
                      </PressableScale>
                    )}
                  </View>
                )}
              </>
            ) : (
              <EmptyBlock
                title="No active projects"
                body="Plan a new installation and we'll guide you from quote to commissioning."
                ctaLabel="Request a quote"
                onCtaPress={() => router.push('/services/installation')}
                styles={styles}
                tokens={tokens}
              />
            )}
          </Panel>

          <Panel
            title="Recent Tickets"
            count={openTickets || recentTickets.length}
            actionLabel="History"
            actionIcon={History}
            onActionPress={() => router.push('/tickets')}
            styles={styles}
            tokens={tokens}
            isPhone={isPhone}
          >
            {recentTickets.length === 0 ? (
              <EmptyBlock
                title="No open tickets"
                body="Raise a ticket if your AC needs attention."
                ctaLabel="Raise a ticket"
                onCtaPress={() => router.push('/services/ticket')}
                styles={styles}
                tokens={tokens}
              />
            ) : (
              <View style={styles.ticketList}>
                {recentTickets.map((t, i) => (
                  <TicketRow
                    key={t.id || t.ticketNumber}
                    ticket={t}
                    isFirst={i === 0}
                    onPress={() => router.push(`/tickets/${t.ticketNumber}`)}
                    styles={styles}
                    tokens={tokens}
                  />
                ))}
                {openTickets > recentTickets.length && (
                  <PressableScale style={styles.projectMoreCta} onPress={() => router.push('/tickets')}>
                    <Text style={[styles.projectMoreCtaLabel, { color: tokens.colors.secondaryInk }]}>
                      View all {openTickets} open tickets
                    </Text>
                    <ArrowRight size={14} color={tokens.colors.secondaryInk} />
                  </PressableScale>
                )}
              </View>
            )}
          </Panel>
        </MotiView>
      </View>
    </AppShell>
  );
}

/* ─── Sub-components ───────────────────────────────────── */

type Styles = ReturnType<typeof makeStyles>;
type Tokens = ReturnType<typeof useTheme>['tokens'];

function ActionCard({
  icon: Icon, title, body, cta, onPress, styles, tokens,
}: {
  icon: typeof Building2; title: string; body: string; cta: string; onPress: () => void; styles: Styles; tokens: Tokens;
}) {
  return (
    <PressableScale style={styles.actionCard} onPress={onPress} haptic>
      <View style={[styles.actionIcon, { backgroundColor: tokens.colors.secondarySoft }]}>
        <Icon size={20} strokeWidth={2} color={tokens.colors.secondaryInk} />
      </View>
      <Text style={styles.actionTitle} color="onSurface">{title}</Text>
      <Text style={styles.actionBody} color="onSurfaceVariant">{body}</Text>
      <View style={styles.actionCtaRow}>
        <Text style={[styles.actionCtaLabel, { color: tokens.colors.tertiary }]}>{cta}</Text>
        <ArrowRight size={16} color={tokens.colors.tertiary} />
      </View>
    </PressableScale>
  );
}

// The web's .amcCard is a fixed navy/gold "feature" card that never reads
// from --aes-* CSS vars — it's the one deliberately un-themed element on
// this otherwise fully dark/light-aware screen (dashboard.module.css has no
// dark override for it, and it reuses the same literal navy gradient found
// at globals.css:733 as a general hero-banner treatment). Mirrored here as
// fixed literals rather than tokens.ts, except the CTA button background,
// which the web *does* theme via var(--aes-primary).
const AMC = {
  navyLight: '#17293D',
  navy: '#0B1A2C',
  title: '#F7F4EE',
  body: 'rgba(247, 244, 238, 0.72)',
  iconBg: 'rgba(201, 168, 76, 0.16)',
  iconBorder: 'rgba(201, 168, 76, 0.32)',
  gold: '#C9A84C',
  badgeText: '#EAD68F',
  btnText: '#0B1A2C',
};

function AmcCard({
  active, endLabel, onPress, styles, tokens,
}: {
  active: boolean; endLabel: string; onPress: () => void; styles: Styles; tokens: Tokens;
}) {
  return (
    <PressableScale style={[styles.actionCard, styles.amcCard]} onPress={onPress} haptic>
      <LinearGradient
        colors={[AMC.navyLight, AMC.navy]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.amcHead}>
        <View style={[styles.amcIcon, { backgroundColor: AMC.iconBg, borderColor: AMC.iconBorder }]}>
          <ShieldCheck size={20} strokeWidth={2} color={AMC.gold} />
        </View>
        <View style={[styles.amcBadge, { backgroundColor: AMC.iconBg, borderColor: AMC.iconBorder }]}>
          <Text style={[styles.amcBadgeLabel, { color: AMC.badgeText }]}>
            {active ? 'PREMIUM ACTIVE' : 'NOT ENROLLED'}
          </Text>
        </View>
      </View>
      <Text style={[styles.actionTitle, { color: AMC.title }]}>AMC Status</Text>
      <Text style={[styles.actionBody, { color: AMC.body }]}>
        {active
          ? `Your comprehensive maintenance contract covers all critical systems until ${endLabel}.`
          : 'Enroll in our annual maintenance contract for priority response and quarterly visits.'}
      </Text>
      <View style={[styles.amcBtn, { backgroundColor: tokens.colors.secondary }]}>
        <Text style={[styles.amcBtnLabel, { color: AMC.btnText }]}>
          {active ? 'View Coverage' : 'Get a Quote'}
        </Text>
      </View>
    </PressableScale>
  );
}

function Panel({
  title, count, actionLabel, actionIcon: ActionIcon, onActionPress, children, styles, tokens, isPhone,
}: {
  title: string; count: number; actionLabel: string; actionIcon?: typeof History; onActionPress: () => void;
  children: React.ReactNode; styles: Styles; tokens: Tokens; isPhone?: boolean;
}) {
  return (
    // panel's base style has flex:1 for the desktop side-by-side "duo" row,
    // where it correctly makes both columns equal width. On phone, "duo"
    // stacks to a column (duoPhone) — flex:1 on a column child inside an
    // auto-height ScrollView is ambiguous and was silently collapsing this
    // panel's height, hiding its second "more projects" row entirely (still
    // present in the DOM, just laid out with no visible space). `flex: 1` is
    // shorthand for flexGrow:1, flexShrink:1, flexBasis:0% — zeroing only
    // grow/shrink still leaves flexBasis at 0%, which collapses the box to
    // its header's minimum content height. flexBasis:'auto' is required too.
    <View style={[styles.panel, isPhone && { flex: undefined, flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }]}>
      <View style={styles.panelHead}>
        <View style={styles.panelTitleRow}>
          <Text style={styles.panelTitle} color="onSurface">{title}</Text>
          {count > 0 && (
            <View style={[styles.panelCount, { backgroundColor: tokens.colors.secondarySoft }]}>
              <CountUp
                value={count}
                // CountUp renders via a web <input>, which defaults to a
                // ~20-character intrinsic width unlike <Text> — without an
                // explicit width it stretches the whole badge into a wide
                // pill instead of shrink-wrapping to "3". A count here is
                // always 1-2 digits, so a small fixed width + center align
                // is enough (see CountUp.tsx's own comment for the general
                // fix; this pins the exact visible width for this badge).
                style={[styles.panelCountLabel, { color: tokens.colors.secondaryInk, width: 16, textAlign: 'center' }]}
              />
            </View>
          )}
        </View>
        <PressableScale onPress={onActionPress} style={styles.panelAction}>
          <Text style={[styles.panelActionLabel, { color: tokens.colors.tertiary }]}>{actionLabel}</Text>
          {ActionIcon && <ActionIcon size={14} color={tokens.colors.tertiary} />}
        </PressableScale>
      </View>
      <View style={styles.panelBody}>{children}</View>
    </View>
  );
}

function ProjectFeature({
  project, progress, onPress, styles, tokens,
}: {
  project: InstallationRequest; progress: { label: string; percent: number }; onPress: () => void; styles: Styles; tokens: Tokens;
}) {
  const acLabel = (project.acType || '').replace('_', '/') || 'AC';
  const barWidth = useSharedValue(0);

  useEffect(() => {
    barWidth.value = withSpring(progress.percent, { damping: 20, stiffness: 90 });
  }, [progress.percent, barWidth]);

  const barStyle = useAnimatedStyle(() => ({ width: `${barWidth.value}%` }));

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.04 }],
    opacity: 1 - pulse.value * 0.4,
  }));

  return (
    <PressableScale style={styles.projectCard} onPress={onPress}>
      <View style={styles.projectImage}>
        <View style={styles.projectImageGradient} />
        <View style={styles.projectStatus}>
          <Animated.View style={[styles.projectStatusDot, { backgroundColor: tokens.colors.secondary }, dotStyle]} />
          <Text style={styles.projectStatusLabel} color="onSurface">In Progress</Text>
        </View>
      </View>
      <View style={[styles.projectMeta, { backgroundColor: tokens.colors.surfaceContainerLowest }]}>
        <Text style={styles.projectTitle} color="onSurface">{`${acLabel} Installation`}</Text>
        <Text style={styles.projectId} color="onSurfaceVariant">ID: {project.requestNumber}</Text>
        <View style={styles.projectProgressRow}>
          <Text style={[styles.projectPhase, { color: tokens.colors.tertiary }]}>{progress.label}</Text>
          <CountUp
            value={progress.percent}
            format={(n) => `${Math.round(n)}%`}
            style={[styles.projectPhase, { color: tokens.colors.tertiary }]}
          />
        </View>
        <View style={[styles.projectBar, { backgroundColor: tokens.colors.surfaceContainer }]}>
          <Animated.View style={[styles.projectBarFill, { backgroundColor: tokens.colors.secondary }, barStyle]} />
        </View>
        {!!project.propertyLabel && (
          <View style={styles.projectMetaLine}>
            <MapPin size={12} color={tokens.colors.onSurfaceVariant} />
            <Text style={styles.projectMetaLineLabel} color="onSurfaceVariant">{project.propertyLabel}</Text>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const ProjectMini = React.memo(function ProjectMini({
  project, onPress, styles, tokens,
}: {
  project: InstallationRequest; onPress: () => void; styles: Styles; tokens: Tokens;
}) {
  const acLabel = (project.acType || '').replace('_', '/') || 'AC';
  return (
    <PressableScale style={styles.projectMiniRow} onPress={onPress}>
      <View style={[styles.projectMiniIcon, { backgroundColor: tokens.colors.surfaceContainer }]}>
        <Snowflake size={14} color={tokens.colors.tertiary} />
      </View>
      <View style={styles.projectMiniBody}>
        <Text style={styles.projectMiniTitle} color="onSurface">{`${acLabel} Installation`}</Text>
        <Text style={styles.projectMiniMeta} color="onSurfaceVariant">
          {project.requestNumber}
          {project.propertyLabel ? ` • ${project.propertyLabel}` : ''}
        </Text>
      </View>
      <ArrowRight size={14} color={tokens.colors.onSurfaceVariant} />
    </PressableScale>
  );
});

const TONE_COLORS: Record<TicketTone, (tokens: Tokens) => { fg: string; bg: string }> = {
  resolved: (t) => ({ fg: t.colors.tertiary, bg: t.colors.surfaceContainer }),
  scheduled: (t) => ({ fg: t.colors.secondaryInk, bg: t.colors.secondarySoft }),
  inprogress: (t) => ({ fg: t.colors.warning, bg: t.colors.warningLight }),
  pending: (t) => ({ fg: t.colors.onSurfaceVariant, bg: t.colors.surfaceContainerLow }),
  cancelled: (t) => ({ fg: t.colors.error, bg: t.colors.errorContainer }),
};

const TicketRow = React.memo(function TicketRow({
  ticket, isFirst, onPress, styles, tokens,
}: {
  ticket: ServiceTicket; isFirst: boolean; onPress: () => void; styles: Styles; tokens: Tokens;
}) {
  const Icon = iconForTicket(ticket);
  const status = statusFor(ticket);
  const tone = statusTone(ticket.status);
  const { fg, bg } = TONE_COLORS[tone](tokens);
  const iconBg = isFirst ? tokens.colors.secondarySoft : tokens.colors.surfaceContainer;
  const iconFg = isFirst ? tokens.colors.secondaryInk : tokens.colors.tertiary;

  return (
    <PressableScale style={[styles.ticketRow, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]} onPress={onPress}>
      <View style={styles.ticketLeft}>
        <View style={[styles.ticketIcon, { backgroundColor: iconBg }]}>
          <Icon size={18} strokeWidth={2} color={iconFg} />
        </View>
        <View style={styles.ticketBody}>
          <Text style={styles.ticketTitle} color="onSurface">
            {(ticket.problemCategory || 'Service request').replace(/_/g, ' ')}
          </Text>
          <Text style={styles.ticketMeta} color="onSurfaceVariant">
            {ticket.ticketNumber}
            {ticket.createdAt ? ` • ${formatTicketDate(ticket.createdAt)}` : ''}
          </Text>
        </View>
      </View>
      <View style={[styles.ticketBadge, { backgroundColor: bg }]}>
        <Text style={[styles.ticketBadgeLabel, { color: fg }]}>{status}</Text>
      </View>
    </PressableScale>
  );
});

function EmptyBlock({
  title, body, ctaLabel, onCtaPress, styles, tokens,
}: {
  title: string; body: string; ctaLabel: string; onCtaPress: () => void; styles: Styles; tokens: Tokens;
}) {
  return (
    <View style={[styles.empty, { backgroundColor: tokens.colors.surfaceContainerLow, borderColor: tokens.colors.outlineVariant }]}>
      <Text style={styles.emptyTitle} color="onSurface">{title}</Text>
      <Text style={styles.emptyBody} color="onSurfaceVariant">{body}</Text>
      <PressableScale style={[styles.emptyCta, { backgroundColor: tokens.colors.secondary }]} onPress={onCtaPress}>
        <Text style={[styles.emptyCtaLabel, { color: tokens.colors.onSecondary }]}>{ctaLabel}</Text>
        <ArrowRight size={14} color={tokens.colors.onSecondary} />
      </PressableScale>
    </View>
  );
}

/* ─── Styles ───────────────────────────────────────────── */

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  hero: {
    gap: space[3],
    marginBottom: 56,
    maxWidth: 560,
  },
  heroPhone: {
    marginBottom: space[8],
    maxWidth: undefined,
  },
  greeting: {
    fontFamily: font('display', 700),
    letterSpacing: -0.4,
  },
  greetingSub: {
    fontFamily: font('body', 400),
    fontSize: 16,
    lineHeight: 24,
    marginTop: space[2],
    maxWidth: 560,
  },

  stack: {
    gap: 56,
  },
  stackPhone: {
    gap: space[8],
  },

  actionGrid: {
    flexDirection: 'row' as const,
    gap: space[6],
  },
  actionGridPhone: {
    flexDirection: 'column' as const,
    gap: space[3],
  },
  actionCard: {
    flex: 1,
    minHeight: 220,
    padding: space[6],
    gap: space[3] + 2,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: 'rgba(11, 26, 44, 0.06)',
    borderRadius: radius.xl,
    overflow: 'hidden' as const,
    ...shadow('card'),
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  actionTitle: {
    fontFamily: font('display', 500),
    fontSize: 20,
  },
  actionBody: {
    flex: 1,
    fontFamily: font('body', 400),
    fontSize: 14,
    lineHeight: 21,
  },
  actionCtaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[2] - 2,
    marginTop: space[1],
  },
  actionCtaLabel: {
    fontFamily: font('body', 500),
    fontSize: 14,
  },

  amcCard: {
    borderColor: 'transparent',
  },
  amcHead: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
  },
  amcIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  amcBadge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  amcBadgeLabel: {
    fontFamily: font('mono', 600),
    fontSize: 10,
    letterSpacing: 1.6,
  },
  amcBtn: {
    marginTop: space[1],
    height: 42,
    borderRadius: radius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  amcBtnLabel: {
    fontFamily: font('body', 600),
    fontSize: 14,
  },

  duo: {
    flexDirection: 'row' as const,
    gap: space[6],
  },
  duoPhone: {
    flexDirection: 'column' as const,
    gap: space[6],
  },
  panel: {
    flex: 1,
    gap: space[6],
    padding: space[7],
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: 'rgba(11, 26, 44, 0.06)',
    borderRadius: radius.xl,
    ...shadow('card'),
  },
  panelHead: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    gap: space[3],
  },
  panelTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[2] + 2,
  },
  panelTitle: {
    fontFamily: font('display', 600),
    fontSize: 22,
  },
  panelCount: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: space[2],
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  panelCountLabel: {
    fontFamily: font('mono', 600),
    fontSize: 11,
  },
  panelAction: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[2] - 2,
  },
  panelActionLabel: {
    fontFamily: font('body', 500),
    fontSize: 14,
  },
  panelBody: {
    gap: space[3],
  },

  projectCard: {
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
    borderRadius: radius.lg,
    overflow: 'hidden' as const,
  },
  projectImage: {
    height: 200,
    backgroundColor: '#F1ECE0',
  },
  projectImageGradient: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(201, 168, 76, 0.10)',
  },
  projectStatus: {
    position: 'absolute' as const,
    top: 16,
    right: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[2],
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: radius.full,
  },
  projectStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  projectStatusLabel: {
    fontFamily: font('mono', 600),
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  projectMeta: {
    gap: space[2],
    padding: space[4],
    paddingBottom: space[5],
  },
  projectTitle: {
    fontFamily: font('display', 500),
    fontSize: 18,
  },
  projectId: {
    fontFamily: font('mono', 500),
    fontSize: 11,
    letterSpacing: 0.9,
  },
  projectProgressRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginTop: space[3],
  },
  projectPhase: {
    fontFamily: font('mono', 600),
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  projectBar: {
    height: 4,
    borderRadius: radius.full,
    overflow: 'hidden' as const,
  },
  projectBarFill: {
    height: '100%' as const,
    borderRadius: radius.full,
  },
  projectMetaLine: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[2] - 2,
    marginTop: space[2],
  },
  projectMetaLineLabel: {
    fontFamily: font('body', 400),
    fontSize: 13,
  },

  projectMore: {
    gap: space[2],
    marginTop: space[3],
    paddingTop: space[4],
    borderTopWidth: 1,
    borderTopColor: tokens.colors.outlineVariant,
    borderStyle: 'dashed' as const,
  },
  projectMiniRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[3],
    paddingVertical: space[2] + 2,
    paddingHorizontal: space[3],
    borderRadius: radius.md,
  },
  projectMiniIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.xs,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  projectMiniBody: {
    flex: 1,
    minWidth: 0,
  },
  projectMiniTitle: {
    fontFamily: font('body', 500),
    fontSize: 13.5,
    marginBottom: 1,
  },
  projectMiniMeta: {
    fontFamily: font('mono', 400),
    fontSize: 10,
    letterSpacing: 0.9,
  },

  projectMoreCta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: space[2] - 2,
    paddingVertical: space[3] - 2,
    paddingHorizontal: space[3],
    marginTop: space[1],
    borderTopWidth: 1,
    borderTopColor: tokens.colors.outlineVariant,
    borderStyle: 'dashed' as const,
  },
  projectMoreCtaLabel: {
    fontFamily: font('body', 500),
    fontSize: 13,
  },

  ticketList: {
    gap: space[3],
  },
  ticketRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: space[3],
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  ticketLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[3],
    flex: 1,
    minWidth: 0,
  },
  ticketIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  ticketBody: {
    flex: 1,
    minWidth: 0,
  },
  ticketTitle: {
    fontFamily: font('body', 500),
    fontSize: 14,
    marginBottom: 2,
    textTransform: 'capitalize' as const,
  },
  ticketMeta: {
    fontFamily: font('mono', 400),
    fontSize: 10,
    letterSpacing: 0.9,
  },
  ticketBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  ticketBadgeLabel: {
    fontFamily: font('mono', 600),
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },

  empty: {
    alignItems: 'flex-start' as const,
    gap: space[2],
    padding: space[6],
    paddingHorizontal: space[6],
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderRadius: radius.lg,
  },
  emptyTitle: {
    fontFamily: font('display', 600),
    fontSize: 16,
  },
  emptyBody: {
    fontFamily: font('body', 400),
    fontSize: 13,
    lineHeight: 19.5,
  },
  emptyCta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[2] - 2,
    marginTop: space[2],
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
  },
  emptyCtaLabel: {
    fontFamily: font('body', 500),
    fontSize: 13,
  },
});
