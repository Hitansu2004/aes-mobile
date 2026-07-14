import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { Linking, RefreshControl, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import Animated, {
  useAnimatedStyle, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated';
import {
  AlertCircle, Camera, Phone, Clock, History, Snowflake, MapPin,
  Star, CalendarDays, CheckCircle2, Send,
  ArrowUp, RotateCcw, FileText,
} from 'lucide-react-native';

import { AppShell } from '@/components/shell/AppShell';
import { Splash } from '@/components/shell/Splash';
import { Text } from '@/components/primitives/Text';
import { Button } from '@/components/primitives/Button';
import { PressableScale } from '@/components/primitives/PressableScale';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { SlaCountdown } from '@/components/ui/SlaCountdown';
import { EscalationLadder } from '@/components/ui/EscalationLadder';
import {
  RateSheet, RescheduleSheet, EscalateSheet, ReopenSheet, QuoteReviewSheet, DetailSheetRef,
} from '@/components/ticket-detail/DetailSheets';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import useStompTopic from '@/hooks/useStompTopic';
import { tickets as ticketsApi, ticketActions, quotes as quotesApi } from '@/lib/api';
import { slotLabel } from '@/lib/constants';
import type { ActivityType, Quote, ServiceTicket, TicketActivity } from '@/types/api';

// Ported from ../../aes-frontend/src/app/tickets/[ticketNumber]/page.js +
// ticketDetail.module.css. TICKET_EVENT_TONE/TEXT, activityIcon() and
// formatStamp() are copied verbatim.
const TICKET_EVENT_TONE: Record<string, 'success' | 'info' | 'warning'> = {
  ACKNOWLEDGED: 'success',
  ENGINEER_ASSIGNED: 'info',
  ESCALATED_TO_L2: 'warning',
  ESCALATED_TO_L3: 'warning',
  RESOLVED: 'success',
};

const TICKET_EVENT_TEXT: Record<string, string> = {
  ACKNOWLEDGED: 'CRM team acknowledged your ticket',
  ENGINEER_ASSIGNED: 'An engineer has been assigned',
  ESCALATED_TO_L2: 'Ticket escalated to Service Manager',
  ESCALATED_TO_L3: 'Ticket escalated to Management',
  RESOLVED: 'Your ticket has been resolved',
};

const PROBLEM_LABEL: Record<string, string> = {
  NOT_COOLING: 'Not Cooling',
  NOISE: 'Noise',
  LEAKING: 'Water Leak',
  NOT_TURNING_ON: 'Not Turning On',
  NO_AIRFLOW: 'No Airflow',
  REMOTE_WIFI: 'Remote / Wi-Fi',
  OTHER: 'Other Issue',
};

function activityIcon(type: ActivityType | string, color: string) {
  switch (type) {
    case 'TICKET_RAISED':
    case 'ACKNOWLEDGED':
    case 'RESOLVED':
      return <CheckCircle2 size={14} color={color} />;
    case 'ASSIGNED':
      return <Phone size={14} color={color} />;
    case 'ESCALATED':
      return <AlertCircle size={14} color={color} />;
    case 'NOTE_ADDED':
    case 'CUSTOMER_NOTE':
      return <Send size={14} color={color} />;
    case 'PHOTO_ADDED':
      return <Camera size={14} color={color} />;
    default:
      return <Clock size={14} color={color} />;
  }
}

function formatStamp(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function isStompEvent(payload: unknown): payload is { event?: string } {
  return typeof payload === 'object' && payload !== null;
}

export default function TicketDetailScreen() {
  const { ticketNumber: ticketNumberParam } = useLocalSearchParams<{ ticketNumber: string }>();
  const ticketNumber = String(ticketNumberParam || '');
  const router = useRouter();
  const { tokens } = useTheme();
  const { isPhone, isTablet } = useBreakpoint();
  const { user } = useAuth();
  const toast = useToast();
  const styles = useThemedStyles(makeStyles);

  const [ticket, setTicket] = useState<ServiceTicket | null>(null);
  const [ticketQuotes, setTicketQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openQuote, setOpenQuote] = useState<Quote | null>(null);

  const rateSheetRef = useRef<DetailSheetRef>(null);
  const rescheduleSheetRef = useRef<DetailSheetRef>(null);
  const escalateSheetRef = useRef<DetailSheetRef>(null);
  const reopenSheetRef = useRef<DetailSheetRef>(null);
  const quoteSheetRef = useRef<DetailSheetRef>(null);

  const glow = useSharedValue(0);
  const flashPill = useCallback(() => {
    glow.value = withSequence(
      withTiming(1, { duration: 180 }),
      withTiming(0, { duration: 900 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const glowStyle = useAnimatedStyle(() => ({
    shadowColor: '#C9A84C',
    shadowOpacity: glow.value * 0.7,
    shadowRadius: glow.value * 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: glow.value * 10,
  }));

  const fetchTicket = useCallback(async (silent = false) => {
    try {
      const data = await ticketsApi.get(ticketNumber);
      setTicket(data);
      if (data?.id) {
        quotesApi.forTicket(data.id).then(setTicketQuotes).catch(() => {});
      }
    } catch {
      if (!silent) toast.error('Could not load ticket.');
    } finally {
      setLoading(false);
    }
  }, [ticketNumber, toast]);

  useEffect(() => {
    if (!ticketNumber) return undefined;
    fetchTicket();
    const id = setInterval(() => fetchTicket(true), 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketNumber]);

  useStompTopic(
    ticketNumber ? `/topic/tickets/${ticketNumber}` : null,
    (payload) => {
      if (isStompEvent(payload)) {
        const event = payload.event;
        const text = event ? TICKET_EVENT_TEXT[event] : undefined;
        if (text) {
          const tone = (event && TICKET_EVENT_TONE[event]) || 'info';
          toast[tone](text);
        }
      }
      flashPill();
      fetchTicket(true);
    },
    [ticketNumber],
  );

  const escalated = !!ticket && (ticket.currentLevel || 1) > 1;
  const resolved = !!ticket && (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED');

  const activeSla = useMemo(() => {
    if (!ticket || resolved) return null;
    const lvl = ticket.currentLevel || 1;
    if (ticket.acknowledgedAt && lvl === 1) {
      return { deadline: ticket.slaDeadlineFinal, total: 24 * 60 * 60, label: 'Resolution SLA' };
    }
    if (lvl === 1) return { deadline: ticket.slaDeadlineL1, total: 30 * 60, label: 'CRM Response Deadline' };
    if (lvl === 2) return { deadline: ticket.slaDeadlineL2, total: 30 * 60, label: 'L2 Response Deadline' };
    if (lvl === 3) return { deadline: ticket.slaDeadlineFinal, total: 24 * 60 * 60, label: 'Final Resolution Deadline' };
    return null;
  }, [ticket, resolved]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTicket(true);
    setRefreshing(false);
  }, [fetchTicket]);

  if (loading) return <Splash message="Loading ticket…" />;

  if (!ticket) {
    return (
      <AppShell
        focused
        hero={(
          <View>
            <Text variant="headlineLg" color="onSurfaceStrong">Ticket not found</Text>
            <Text variant="bodyMd" color="onSurfaceVariant">It may have been removed, or you might not have access.</Text>
          </View>
        )}
      >
        <View style={styles.notFound}>
          <Text variant="headlineMd" color="onSurface" align="center">We couldn&apos;t find that ticket.</Text>
          <Text variant="bodyMd" color="onSurfaceVariant" align="center">Go back to your tickets list or contact support.</Text>
        </View>
      </AppShell>
    );
  }

  const detailMaxWidth = isPhone ? 480 : isTablet ? 760 : 1120;

  const handleRate = async (rating: number, feedback: string | null) => {
    try {
      await ticketActions.rate(ticket.ticketNumber, { rating, feedback });
      toast.success('Thanks for the feedback!');
      rateSheetRef.current?.dismiss();
      fetchTicket(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit rating.');
    }
  };
  const handleEscalate = async (data: { reason: string; details: string | null }) => {
    try {
      await ticketActions.customerEscalate(ticket.ticketNumber, data);
      toast.success('Escalation raised. Service Manager will be in touch.');
      escalateSheetRef.current?.dismiss();
      fetchTicket(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not escalate');
    }
  };
  const handleReschedule = async (data: { scheduledDate: string; scheduledSlot: string; reason: string | null }) => {
    try {
      await ticketActions.reschedule(ticket.ticketNumber, data);
      toast.success('Visit rescheduled.');
      rescheduleSheetRef.current?.dismiss();
      fetchTicket(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reschedule');
    }
  };
  const handleReopen = async (data: { reason: string }) => {
    try {
      await ticketActions.reopen(ticket.ticketNumber, data);
      toast.success('Ticket reopened. CRM is on it.');
      reopenSheetRef.current?.dismiss();
      fetchTicket(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reopen');
    }
  };
  const handleQuoteDecision = async (decision: 'ACCEPT' | 'REJECT' | 'NEGOTIATE', comment: string | null) => {
    if (!openQuote) return;
    try {
      await quotesApi.customerDecision(openQuote.quoteNumber, { decision, comment });
      toast.success(`Quote ${decision.toLowerCase()}ed.`);
      quoteSheetRef.current?.dismiss();
      setOpenQuote(null);
      fetchTicket(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit decision');
    }
  };

  const isCustomer = user?.role === 'CUSTOMER';
  const canReopen = isCustomer && ticket.status === 'CLOSED';
  const canRequest = isCustomer && ['OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS'].includes(ticket.status);
  const pendingQuote = ticketQuotes.find((q) => q.status === 'SENT_TO_CUSTOMER') || null;

  const statusTone = escalated ? 'esc' : resolved ? 'resolved' : 'open';
  const statusAccent = { esc: '#f59e0b', resolved: tokens.colors.success, open: tokens.colors.secondary }[statusTone];
  const statusLabel = resolved
    ? 'Resolved'
    : escalated
      ? `Escalated to L${ticket.currentLevel}`
      : ticket.acknowledgedAt
        ? 'CRM Acknowledged'
        : 'CRM Team Handling';

  const hero = (
    <View style={[styles.heroRow, isPhone && styles.heroRowPhone]}>
      <View style={styles.heroText}>
        <Text style={[styles.heroEyebrow, { color: tokens.colors.secondaryInk }]}>Service ticket</Text>
        <Text variant="headlineLg" color="onSurfaceStrong" style={styles.heroTitle}>{ticket.ticketNumber}</Text>
        <Text variant="bodyMd" color="onSurfaceVariant">
          {`${PROBLEM_LABEL[ticket.problemCategory] || ticket.problemCategory || 'Service request'} · ${ticket.acBrand || ''}${ticket.acUnitRoom ? ` · ${ticket.acUnitRoom}` : ''}`}
        </Text>
      </View>
      <PressableScale
        style={[styles.backCta, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }, isPhone && styles.backCtaPhone]}
        onPress={() => router.push('/tickets')}
      >
        <Text style={styles.backCtaLabel} color="onSurface">← All tickets</Text>
      </PressableScale>
    </View>
  );

  return (
    <AppShell
      focused
      hero={hero}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.secondary} />}
    >
      <View style={[styles.body, { maxWidth: detailMaxWidth, alignSelf: 'center', width: '100%' }]}>
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 250 }}
          style={[styles.statusCard, { backgroundColor: tokens.colors.surfaceContainerLowest }, shadow('xs')]}
        >
          <View style={[styles.statusBar, { backgroundColor: statusAccent }]} />
          <View style={styles.statusHead}>
            <PriorityBadge priority={ticket.priority} />
            <Animated.View style={[styles.statusBadge, { backgroundColor: tokens.colors.surfaceContainer }, glowStyle]}>
              <View style={[styles.statusDot, { backgroundColor: statusAccent }]} />
              <Text style={styles.statusBadgeLabel} color="onSurface">{statusLabel}</Text>
            </Animated.View>
          </View>
          <Text style={[styles.ticketNumberMono, { color: tokens.colors.primary }]}>{ticket.ticketNumber}</Text>
        </MotiView>

        {!resolved && activeSla?.deadline ? (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 250, delay: 50 }}
          >
            <SlaCountdown
              variant="banner"
              deadlineISO={activeSla.deadline}
              totalSeconds={activeSla.total}
              label={activeSla.label}
            />
          </MotiView>
        ) : null}

        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 250, delay: 100 }}
          style={[styles.card, { backgroundColor: tokens.colors.surfaceContainerLowest }, shadow('xs')]}
        >
          <Text style={[styles.cardTitle, { borderBottomColor: tokens.colors.outlineVariant }]} color="onSurface">Support Team</Text>
          <EscalationLadder
            currentLevel={(ticket.currentLevel as 1 | 2 | 3) || 1}
            slaRemainingSeconds={activeSla?.deadline ? Math.max(0, Math.floor((new Date(activeSla.deadline).getTime() - Date.now()) / 1000)) : null}
            acknowledgedAtCurrentLevel={!!ticket.acknowledgedAt && (ticket.currentLevel || 1) === 1}
          />
        </MotiView>

        <View style={[styles.twoCol, !isPhone && styles.twoColWide]}>
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 250, delay: 150 }}
            style={[styles.card, !isPhone && styles.colFlex, { backgroundColor: tokens.colors.surfaceContainerLowest }, shadow('xs')]}
          >
            <View style={[styles.cardTitleRow, { borderBottomColor: tokens.colors.outlineVariant }]}>
              <Snowflake size={16} color={tokens.colors.onSurface} />
              <Text style={styles.cardTitleInline} color="onSurface">Ticket Details</Text>
            </View>

            <DetailRow label="Asset" value={`${ticket.acBrand || ''} ${ticket.acModel || ''} — ${ticket.acUnitRoom || ''}`} styles={styles} />
            <DetailRow
              label="Reported Issue"
              value={[
                PROBLEM_LABEL[ticket.problemCategory] || ticket.problemCategory,
                ticket.errorCode ? `Code ${ticket.errorCode}` : null,
              ].filter(Boolean).join(' + ')}
              valueColor={tokens.colors.error}
              styles={styles}
            />

            {ticket.problemDescription ? (
              <View style={[styles.descBlock, { backgroundColor: tokens.colors.surfaceContainerLow, borderLeftColor: tokens.colors.secondary }]}>
                <Text style={styles.detailLabel} color="onSurfaceVariant">Description</Text>
                <Text variant="bodySm" color="onSurface" style={styles.descText}>{ticket.problemDescription}</Text>
              </View>
            ) : null}

            {ticket.scheduledDate ? (
              <View style={[styles.scheduleBlock, { backgroundColor: tokens.colors.secondarySoft, borderColor: tokens.colors.secondaryLight }]}>
                <CalendarDays size={18} color={tokens.colors.secondaryInk} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailLabel} color="onSurfaceVariant">Scheduled Visit</Text>
                  <Text style={styles.scheduleText} color="onSurface">
                    {`${new Date(ticket.scheduledDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}${ticket.scheduledSlot ? ` · ${slotLabel(ticket.scheduledSlot)}` : ''}`}
                  </Text>
                </View>
              </View>
            ) : null}

            {ticket.propertyLabel || ticket.propertyId ? (
              <DetailRow
                label="Property"
                value={ticket.propertyLabel || '—'}
                icon={<MapPin size={14} color={tokens.colors.onSurface} />}
                styles={styles}
              />
            ) : null}
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 250, delay: 200 }}
            style={[styles.card, !isPhone && styles.colFlex, { backgroundColor: tokens.colors.surfaceContainerLowest }, shadow('xs')]}
          >
            <View style={[styles.cardTitleRow, { borderBottomColor: tokens.colors.outlineVariant }]}>
              <History size={16} color={tokens.colors.onSurface} />
              <Text style={styles.cardTitleInline} color="onSurface">Timeline</Text>
            </View>
            <ActivityTimeline activities={ticket.activities || []} createdAt={ticket.createdAt} styles={styles} tokens={tokens} />
          </MotiView>
        </View>

        {pendingQuote && isCustomer ? (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            style={[styles.card, { backgroundColor: tokens.colors.surfaceContainerLowest }, shadow('xs')]}
          >
            <View style={[styles.cardTitleRow, { borderBottomColor: tokens.colors.outlineVariant }]}>
              <FileText size={16} color={tokens.colors.onSurface} />
              <Text style={styles.cardTitleInline} color="onSurface">Estimate awaiting your decision</Text>
            </View>
            <Text variant="bodySm" color="onSurfaceVariant" style={styles.quoteBlurb}>
              {`We've prepared a quote of ₹${Number(pendingQuote.total || 0).toLocaleString('en-IN')}. Tap below to review and accept, negotiate, or reject.`}
            </Text>
            <Button
              variant="primary"
              fullWidth
              onPress={() => { setOpenQuote(pendingQuote); quoteSheetRef.current?.present(); }}
            >
              Review estimate
            </Button>
          </MotiView>
        ) : null}

        {!resolved && isCustomer && canRequest ? (
          <View style={[styles.actionRow, !isPhone && styles.actionRowWide]}>
            <Button variant="outline" fullWidth leftIcon={<CalendarDays size={16} color={tokens.colors.primary} />} onPress={() => rescheduleSheetRef.current?.present()}>
              Reschedule visit
            </Button>
            <Button variant="soft" fullWidth leftIcon={<ArrowUp size={16} color={tokens.colors.primary} />} onPress={() => escalateSheetRef.current?.present()}>
              Escalate to manager
            </Button>
            <Button variant="danger" fullWidth leftIcon={<Phone size={16} color={tokens.colors.onError} />} onPress={() => Linking.openURL('tel:+914023540000')}>
              Emergency? Call us
            </Button>
          </View>
        ) : null}

        {canReopen ? (
          <View style={styles.actionRow}>
            <Button variant="primary" fullWidth leftIcon={<RotateCcw size={16} color={tokens.colors.onSecondary} />} onPress={() => reopenSheetRef.current?.present()}>
              Re-open this ticket
            </Button>
          </View>
        ) : null}

        {ticket.status === 'RESOLVED' && !ticket.customerRating ? (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            style={[styles.rateCard, isPhone && styles.rateCardPhone, { borderColor: tokens.colors.secondaryLight }]}
          >
            <Star size={22} color="#f59e0b" fill="#f59e0b" />
            <View style={{ flex: 1 }}>
              <Text style={styles.rateCardTitle} color="onSurface">How did we do?</Text>
              <Text variant="bodySm" color="onSurfaceVariant">Tap to rate your service experience.</Text>
            </View>
            <Button variant="primary" onPress={() => rateSheetRef.current?.present()}>Rate Service</Button>
          </MotiView>
        ) : null}

        {ticket.customerRating ? (
          <View style={[styles.rateCard, isPhone && styles.rateCardPhone, { borderColor: tokens.colors.secondaryLight, backgroundColor: tokens.colors.surfaceContainerLowest }]}>
            <View style={styles.ratedStars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={18} color="#f59e0b" fill={n <= (ticket.customerRating || 0) ? '#f59e0b' : 'transparent'} />
              ))}
            </View>
            <Text variant="bodySm" color="onSurface" style={{ flex: 1 }}>
              {`You rated this service ${ticket.customerRating}/5${ticket.customerFeedback ? ` — "${ticket.customerFeedback}"` : ''}`}
            </Text>
          </View>
        ) : null}
      </View>

      <RateSheet ref={rateSheetRef} ticket={ticket} onSubmit={handleRate} />
      <RescheduleSheet ref={rescheduleSheetRef} ticket={ticket} onSubmit={handleReschedule} />
      <EscalateSheet ref={escalateSheetRef} ticket={ticket} onSubmit={handleEscalate} />
      <ReopenSheet ref={reopenSheetRef} ticket={ticket} onSubmit={handleReopen} />
      <QuoteReviewSheet ref={quoteSheetRef} quote={openQuote} onSubmit={handleQuoteDecision} />
    </AppShell>
  );
}

type Styles = ReturnType<typeof makeStyles>;
type Tokens = ReturnType<typeof useTheme>['tokens'];

function DetailRow({
  label, value, valueColor, icon, styles,
}: { label: string; value: string; valueColor?: string; icon?: React.ReactNode; styles: Styles }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel} color="onSurfaceVariant">{label}</Text>
      <View style={styles.detailValueRow}>
        {icon}
        <Text style={[styles.detailValue, valueColor ? { color: valueColor } : null]} color="onSurface">{value}</Text>
      </View>
    </View>
  );
}

interface TimelineItem {
  type: ActivityType | string;
  desc?: string;
  stamp?: string;
}

function ActivityTimeline({
  activities, createdAt, styles, tokens,
}: { activities: TicketActivity[]; createdAt: string; styles: Styles; tokens: Tokens }) {
  const items: TimelineItem[] = activities.map((a) => ({
    type: a.activityType, desc: a.description, stamp: a.createdAt,
  }));
  if (!items.find((i) => i.type === 'TICKET_RAISED')) {
    items.push({ type: 'TICKET_RAISED', desc: 'Ticket raised', stamp: createdAt });
  }
  items.sort((a, b) => new Date(b.stamp || 0).getTime() - new Date(a.stamp || 0).getTime());

  if (items.length === 0) {
    return <Text variant="bodySm" color="onSurfaceVariant" align="center" style={styles.timelineEmpty}>No activity yet.</Text>;
  }

  return (
    <View style={styles.timeline}>
      {items.map((it, i) => (
        <MotiView
          key={`${it.type}-${it.stamp}-${i}`}
          from={{ opacity: 0, translateX: -8 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'timing', duration: 220, delay: i * 60 }}
          style={styles.timelineRow}
        >
          <View style={[styles.timelineDot, { backgroundColor: tokens.colors.surfaceContainerHigh }]}>
            {activityIcon(it.type, tokens.colors.secondaryInk)}
          </View>
          <View style={styles.timelineMain}>
            <Text style={[styles.timelineStamp, { color: tokens.colors.outline }]}>{formatStamp(it.stamp)}</Text>
            <Text variant="bodySm" color="onSurface" style={styles.timelineDesc}>
              {it.desc || it.type.replace(/_/g, ' ').toLowerCase()}
            </Text>
          </View>
        </MotiView>
      ))}
    </View>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  notFound: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: space[2],
  },
  heroRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'space-between' as const,
    gap: space[6],
    flexWrap: 'wrap' as const,
  },
  heroRowPhone: {
    flexDirection: 'column-reverse' as const,
    alignItems: 'stretch' as const,
    gap: space[3],
  },
  heroText: {
    gap: 6,
    maxWidth: 720,
  },
  heroEyebrow: {
    fontFamily: font('mono', 400),
    fontSize: 11,
    letterSpacing: 0.10 * 11,
    textTransform: 'uppercase' as const,
  },
  heroTitle: {
    fontVariant: ['tabular-nums'] as ('tabular-nums')[],
  },
  backCta: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderRadius: radius.full,
  },
  backCtaPhone: {
    alignItems: 'center' as const,
  },
  backCtaLabel: {
    fontFamily: font('body', 500),
    fontSize: 13,
  },

  body: {
    gap: 18,
  },

  statusCard: {
    position: 'relative' as const,
    borderRadius: radius.md,
    padding: 16,
    overflow: 'hidden' as const,
    gap: 10,
  },
  statusBar: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  statusHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  statusBadgeLabel: {
    fontFamily: font('body', 600),
    fontSize: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ticketNumberMono: {
    fontFamily: font('mono', 700),
    fontSize: 24,
    letterSpacing: -0.01 * 24,
  },

  card: {
    borderRadius: radius.md,
    padding: 16,
    gap: 12,
  },
  colFlex: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: font('body', 700),
    fontSize: 15,
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 4,
  },
  cardTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 4,
  },
  cardTitleInline: {
    fontFamily: font('body', 700),
    fontSize: 15,
  },

  twoCol: {
    gap: 16,
  },
  twoColWide: {
    flexDirection: 'row' as const,
    gap: 20,
  },

  detailRow: {
    gap: 2,
  },
  detailLabel: {
    fontFamily: font('body', 700),
    fontSize: 11,
    letterSpacing: 0.06 * 11,
    textTransform: 'uppercase' as const,
  },
  detailValueRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  detailValue: {
    fontFamily: font('body', 600),
    fontSize: 14,
  },

  descBlock: {
    padding: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    gap: 4,
  },
  descText: {
    lineHeight: 20,
  },

  scheduleBlock: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  scheduleText: {
    fontFamily: font('body', 700),
    fontSize: 14,
    marginTop: 2,
  },

  timeline: {
    gap: 12,
    paddingLeft: 4,
  },
  timelineRow: {
    flexDirection: 'row' as const,
    gap: 10,
    alignItems: 'flex-start' as const,
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  timelineMain: {
    flex: 1,
    gap: 2,
  },
  timelineStamp: {
    fontSize: 11.5,
    letterSpacing: 0.02 * 11.5,
    textTransform: 'uppercase' as const,
  },
  timelineDesc: {
    lineHeight: 19,
    textTransform: 'capitalize' as const,
  },
  timelineEmpty: {
    paddingVertical: 14,
  },

  quoteBlurb: {
    marginTop: -4,
  },

  actionRow: {
    gap: 8,
  },
  actionRowWide: {
    flexDirection: 'row' as const,
  },

  rateCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: 'rgba(242, 231, 196, 0.5)',
  },
  rateCardPhone: {
    flexDirection: 'column' as const,
    alignItems: 'stretch' as const,
  },
  rateCardTitle: {
    fontFamily: font('body', 700),
    fontSize: 15,
  },
  ratedStars: {
    flexDirection: 'row' as const,
    gap: 2,
  },
});
