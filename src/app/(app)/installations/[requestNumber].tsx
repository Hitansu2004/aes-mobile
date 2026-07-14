import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import {
  Building2, Calendar, MapPin, Snowflake, FileText, Clock, CheckCircle2, ArrowLeft,
} from 'lucide-react-native';

import { AppShell } from '@/components/shell/AppShell';
import { Splash } from '@/components/shell/Splash';
import { Text } from '@/components/primitives/Text';
import { Button } from '@/components/primitives/Button';
import { PressableScale } from '@/components/primitives/PressableScale';
import { QuoteReviewSheet, DetailSheetRef } from '@/components/ticket-detail/DetailSheets';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useToast } from '@/context/ToastContext';
import {
  installations as installationsApi, quotes as quotesApi,
} from '@/lib/api';
import type { InstallationRequest, InstallationStatus, Quote } from '@/types/api';

// Ported from ../../aes-frontend/src/app/installations/[requestNumber]/page.js
// + detail.module.css. STATUS_LABEL (detail's own copy, distinct from the
// list screen's), STEPS, STAGE_OF and STAGE_INDEX are copied verbatim.
const STATUS_LABEL: Record<InstallationStatus, string> = {
  PENDING: 'Awaiting triage',
  NEW: 'Awaiting triage',
  OFFERED_CRM: 'Awaiting CRM acceptance',
  CONFIRMED: 'Confirmed — site visit being scheduled',
  SURVEY_SCHEDULED: 'Site survey scheduled',
  SITE_VISITED: 'Site survey done',
  SITE_VISIT_DONE: 'Site survey done',
  QUOTE_DRAFT: 'Preparing your quote',
  QUOTE_PENDING_APPROVAL: 'Quote being approved internally',
  QUOTE_REJECTED_INTERNAL: 'Quote rework in progress',
  QUOTE_SENT: 'Estimate sent — please review',
  QUOTE_NEGOTIATING: 'Negotiating your quote',
  QUOTE_ACCEPTED: 'Quote accepted — installation will be scheduled',
  INSTALLATION_SCHEDULED: 'Installation scheduled',
  INSTALLATION_IN_PROGRESS: 'Installation in progress',
  COMPLETED: 'Installation completed',
  CANCELLED: 'Request cancelled',
};

type StageKey = 'submitted' | 'triaged' | 'survey' | 'quote' | 'install' | 'done';

const STEPS: { key: StageKey; label: string }[] = [
  { key: 'submitted', label: 'Request' },
  { key: 'triaged', label: 'CRM' },
  { key: 'survey', label: 'Survey' },
  { key: 'quote', label: 'Quote' },
  { key: 'install', label: 'Install' },
  { key: 'done', label: 'Done' },
];

function STAGE_OF(s: InstallationStatus): StageKey {
  if (s === 'COMPLETED' || s === 'CANCELLED') return 'done';
  if (s === 'INSTALLATION_IN_PROGRESS' || s === 'INSTALLATION_SCHEDULED' || s === 'QUOTE_ACCEPTED') return 'install';
  if (['QUOTE_DRAFT', 'QUOTE_PENDING_APPROVAL', 'QUOTE_REJECTED_INTERNAL', 'QUOTE_SENT', 'QUOTE_NEGOTIATING'].includes(s)) return 'quote';
  if (s === 'SURVEY_SCHEDULED' || s === 'SITE_VISITED' || s === 'SITE_VISIT_DONE') return 'survey';
  if (s === 'CONFIRMED' || s === 'OFFERED_CRM') return 'triaged';
  return 'submitted';
}
const STAGE_INDEX = (st: StageKey) => STEPS.findIndex((s) => s.key === st);

function fmtDate(iso?: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface Room {
  name?: string;
  roomName?: string;
  size?: number;
  units?: number;
  type?: string;
}

function parseRooms(json?: string): Room[] {
  try {
    const r: unknown = JSON.parse(json || '[]');
    return Array.isArray(r) ? (r as Room[]) : [];
  } catch {
    return [];
  }
}

export default function InstallationDetailScreen() {
  const { requestNumber: requestNumberParam } = useLocalSearchParams<{ requestNumber: string }>();
  const requestNumber = String(requestNumberParam || '');
  const router = useRouter();
  const { tokens } = useTheme();
  const { isPhone, isTablet } = useBreakpoint();
  const toast = useToast();
  const styles = useThemedStyles(makeStyles);

  const [req, setReq] = useState<InstallationRequest | null>(null);
  const [installQuotes, setInstallQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [openQuote, setOpenQuote] = useState<Quote | null>(null);

  const quoteSheetRef = useRef<DetailSheetRef>(null);

  const fetchRequest = useCallback(async (silent = false) => {
    try {
      const data = await installationsApi.getByNumber(requestNumber);
      setReq(data);
      if (data?.id) {
        quotesApi.forInstall(data.id).then(setInstallQuotes).catch(() => {});
      }
    } catch {
      if (!silent) toast.error('Could not load project');
    } finally {
      setLoading(false);
    }
  }, [requestNumber, toast]);

  useEffect(() => {
    if (!requestNumber) return;
    fetchRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestNumber]);

  const handleQuoteDecision = async (decision: 'ACCEPT' | 'REJECT' | 'NEGOTIATE', comment: string | null) => {
    if (!openQuote) return;
    try {
      await quotesApi.customerDecision(openQuote.quoteNumber, { decision, comment });
      toast.success(`Quote ${decision.toLowerCase()}ed.`);
      quoteSheetRef.current?.dismiss();
      setOpenQuote(null);
      fetchRequest(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit decision');
    }
  };

  if (loading) return <Splash message="Loading project…" />;

  if (!req) {
    return (
      <AppShell
        focused
        hero={(
          <View>
            <Text variant="headlineLg" color="onSurfaceStrong">Project not found</Text>
            <Text variant="bodyMd" color="onSurfaceVariant">It may have been removed, or you might not have access.</Text>
          </View>
        )}
      >
        <View style={styles.notFound}>
          <Building2 size={32} color={tokens.colors.onSurfaceVariant} />
          <Text variant="headlineMd" color="onSurface" align="center">We couldn&apos;t find that project.</Text>
          <PressableScale
            style={[styles.backCta, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
            onPress={() => router.push('/installations')}
          >
            <ArrowLeft size={14} color={tokens.colors.onSurface} />
            <Text style={styles.backCtaLabel} color="onSurface">Back to my projects</Text>
          </PressableScale>
        </View>
      </AppShell>
    );
  }

  const detailMaxWidth = isPhone ? 480 : isTablet ? 760 : 1120;
  const stage = STAGE_OF(req.status);
  const stageIdx = STAGE_INDEX(stage);
  const pendingQuote = installQuotes.find((q) => q.status === 'SENT_TO_CUSTOMER');
  // Real bug found in the web source, not ported: the web reads
  // q.status === 'ACCEPTED', but the backend's QuoteStatus enum never emits
  // that value — customerDecision('ACCEPT') sets CUSTOMER_ACCEPTED (see
  // aes-backend-node QuoteService#customerDecision). The web's "Accepted
  // quote" card is therefore permanently dead; fixed here, same precedent as
  // the QuoteReviewSheet lineItemsJson fix from Phase 12.
  const acceptedQuote = installQuotes.find((q) => q.status === 'CUSTOMER_ACCEPTED');
  const rooms = parseRooms(req.roomsJson);
  const scheduled = fmtDate(req.scheduledDate);
  const submitted = fmtDate(req.createdAt);

  const hero = (
    <View style={[styles.heroRow, isPhone && styles.heroRowPhone]}>
      <View style={styles.heroText}>
        <Text style={[styles.heroEyebrow, { color: tokens.colors.secondaryInk }]}>Installation project</Text>
        <Text variant="headlineLg" color="onSurfaceStrong" style={styles.heroTitle}>{req.requestNumber}</Text>
        <Text variant="bodyMd" color="onSurfaceVariant">
          {`${(req.acType || '').replace('_', '/')} installation${req.tonnage ? ` · ${req.tonnage} ton` : ''}${req.brand ? ` · ${req.brand}` : ''}`}
        </Text>
      </View>
      <PressableScale
        style={[styles.backCta, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }, isPhone && styles.backCtaPhone]}
        onPress={() => router.push('/installations')}
      >
        <Text style={styles.backCtaLabel} color="onSurface">← All projects</Text>
      </PressableScale>
    </View>
  );

  return (
    <AppShell focused hero={hero}>
      <View style={[styles.body, { maxWidth: detailMaxWidth, alignSelf: 'center', width: '100%' }]}>
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 250 }}
          style={[styles.statusCard, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
        >
          <View style={styles.statusHead}>
            <Text style={[styles.numPill, { backgroundColor: tokens.colors.surfaceContainerLow, color: tokens.colors.onSurfaceVariant }]}>
              {req.requestNumber}
            </Text>
            <Text style={[styles.statusLabel, { backgroundColor: tokens.colors.primaryContainer, color: tokens.colors.onPrimaryContainer }]}>
              {STATUS_LABEL[req.status] || req.status}
            </Text>
          </View>
          <Text style={styles.title} color="onSurface">
            {`${(req.acType || '').replace('_', '/')} Installation${req.tonnage ? ` · ${req.tonnage} ton` : ''}`}
          </Text>
          {req.brand ? (
            <Text style={styles.subtitle} color="onSurfaceVariant">
              {`${req.brand} ${req.modelNumber || ''}${req.energyRating ? ` · ${req.energyRating}-star` : ''}`}
            </Text>
          ) : null}

          <StepStrip stageIdx={stageIdx} styles={styles} tokens={tokens} />
        </MotiView>

        {pendingQuote ? (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 250, delay: 50 }}
            style={[styles.card, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
          >
            <View style={[styles.cardTitleRow]}>
              <FileText size={16} color={tokens.colors.onSurface} />
              <Text style={styles.cardTitleInline} color="onSurfaceVariant">Estimate awaiting your decision</Text>
            </View>
            <Text style={styles.cardSub} color="onSurface">
              {`We've prepared a quote of ₹${Number(pendingQuote.total || 0).toLocaleString('en-IN')}.`}
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

        {acceptedQuote ? (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 250, delay: 100 }}
            style={[styles.card, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
          >
            <View style={[styles.cardTitleRow]}>
              <CheckCircle2 size={16} color={tokens.colors.success} />
              <Text style={styles.cardTitleInline} color="onSurfaceVariant">Accepted quote</Text>
            </View>
            <Text style={styles.cardSub} color="onSurface">
              {`${acceptedQuote.quoteNumber} · ₹${Number(acceptedQuote.total || 0).toLocaleString('en-IN')}`}
            </Text>
            <Button
              variant="outline"
              fullWidth
              onPress={() => { setOpenQuote(acceptedQuote); quoteSheetRef.current?.present(); }}
            >
              View accepted estimate
            </Button>
          </MotiView>
        ) : null}

        {req.scheduledDate ? (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 250, delay: 150 }}
            style={[styles.card, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
          >
            <View style={[styles.cardTitleRow]}>
              <Calendar size={16} color={tokens.colors.onSurface} />
              <Text style={styles.cardTitleInline} color="onSurfaceVariant">Scheduled</Text>
            </View>
            <Text style={styles.cardSub} color="onSurface">
              {`${scheduled}${req.scheduledSlot ? ` · ${req.scheduledSlot}` : ''}`}
            </Text>
            {req.assignedEngineerName ? (
              <Text style={styles.cardSub} color="onSurface">
                Engineer: <Text style={{ fontFamily: font('body', 700) }} color="onSurface">{req.assignedEngineerName}</Text>
              </Text>
            ) : null}
          </MotiView>
        ) : null}

        {req.propertyLabel || req.propertyAddress ? (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 250, delay: 200 }}
            style={[styles.card, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
          >
            <View style={[styles.cardTitleRow]}>
              <MapPin size={16} color={tokens.colors.onSurface} />
              <Text style={styles.cardTitleInline} color="onSurfaceVariant">Site</Text>
            </View>
            {req.propertyLabel ? (
              <Text style={[styles.cardSub, { fontFamily: font('body', 700) }]} color="onSurface">{req.propertyLabel}</Text>
            ) : null}
            {req.propertyAddress ? (
              <Text style={styles.cardSub} color="onSurface">{req.propertyAddress}</Text>
            ) : null}
          </MotiView>
        ) : null}

        {rooms.length > 0 ? (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 250, delay: 250 }}
            style={[styles.card, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
          >
            <View style={[styles.cardTitleRow]}>
              <Snowflake size={16} color={tokens.colors.onSurface} />
              <Text style={styles.cardTitleInline} color="onSurfaceVariant">{`Rooms (${rooms.length})`}</Text>
            </View>
            <View style={{ gap: 4 }}>
              {rooms.map((r, i) => (
                <Text key={i} style={styles.roomLine} color="onSurface">
                  <Text style={{ fontFamily: font('body', 700) }} color="onSurface">
                    {r.name || r.roomName || `Room ${i + 1}`}
                  </Text>
                  {r.size ? ` · ${r.size} sq ft` : ''}
                  {r.units ? ` · ${r.units} unit${r.units > 1 ? 's' : ''}` : ''}
                  {r.type ? ` · ${r.type}` : ''}
                </Text>
              ))}
            </View>
          </MotiView>
        ) : null}

        {req.notes ? (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 250, delay: 300 }}
            style={[styles.card, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
          >
            <Text style={styles.cardTitleInline} color="onSurfaceVariant">Notes</Text>
            <Text style={styles.cardSub} color="onSurface">{req.notes}</Text>
          </MotiView>
        ) : null}

        <View style={styles.stampRow}>
          <Clock size={12} color={tokens.colors.onSurfaceVariant} />
          <Text style={styles.stamp} color="onSurfaceVariant">{`Submitted ${submitted}`}</Text>
        </View>
      </View>

      <QuoteReviewSheet ref={quoteSheetRef} quote={openQuote} onSubmit={handleQuoteDecision} />
    </AppShell>
  );
}

type Styles = ReturnType<typeof makeStyles>;
type Tokens = ReturnType<typeof useTheme>['tokens'];

function StepStrip({ stageIdx, styles, tokens }: { stageIdx: number; styles: Styles; tokens: Tokens }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.steps}
      contentContainerStyle={styles.stepsContent}
    >
      {STEPS.map((s, idx) => {
        const done = idx < stageIdx;
        const active = idx === stageIdx;
        return (
          <View key={s.key} style={styles.stepWrap}>
            <View style={styles.stepDotHaloAnchor}>
              {active && <View style={[styles.stepDotHalo, { backgroundColor: tokens.colors.primaryContainer }]} />}
              <View
                style={[
                  styles.stepDot,
                  { backgroundColor: tokens.colors.surfaceContainer, borderColor: tokens.colors.outlineVariant },
                  done && { backgroundColor: tokens.colors.success, borderColor: tokens.colors.success },
                  active && { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },
                ]}
              >
                {done ? (
                  <CheckCircle2 size={12} strokeWidth={3} color="#fff" />
                ) : (
                  <Text style={[styles.stepDotLabel, { color: active ? tokens.colors.onPrimary : tokens.colors.onSurfaceVariant }]}>
                    {idx + 1}
                  </Text>
                )}
              </View>
            </View>
            <Text
              style={[
                styles.stepLabel,
                { color: tokens.colors.onSurfaceVariant },
                done && { color: tokens.colors.onSurface },
                active && { color: tokens.colors.primary, fontFamily: font('body', 700) },
              ]}
            >
              {s.label}
            </Text>
            {idx < STEPS.length - 1 ? (
              <View style={[styles.stepLine, { backgroundColor: tokens.colors.outlineVariant }]}>
                {done ? (
                  <MotiView
                    from={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ type: 'timing', duration: 320, delay: idx * 80 }}
                    style={[styles.stepLineFill, { backgroundColor: tokens.colors.success, transformOrigin: 'left' }]}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  notFound: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: space[3],
    alignItems: 'center' as const,
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
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderRadius: radius.full,
  },
  backCtaPhone: {
    width: '100%' as const,
  },
  backCtaLabel: {
    fontFamily: font('body', 500),
    fontSize: 13,
  },

  body: {
    gap: 16,
  },

  statusCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 6,
  },
  statusHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 6,
  },
  numPill: {
    fontFamily: font('body', 700),
    fontSize: 11.5,
    fontVariant: ['tabular-nums'] as ('tabular-nums')[],
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: radius.full,
  },
  statusLabel: {
    fontFamily: font('body', 700),
    fontSize: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    letterSpacing: 0.03 * 12,
  },
  title: {
    fontFamily: font('display', 700),
    fontSize: 20,
    marginTop: 4,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: font('body', 400),
    fontSize: 13.5,
  },

  steps: {
    marginTop: 14,
  },
  stepsContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  stepWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexShrink: 0,
    gap: 6,
  },
  stepDotHaloAnchor: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stepDotHalo: {
    position: 'absolute' as const,
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1.5,
  },
  stepDotLabel: {
    fontFamily: font('body', 700),
    fontSize: 11,
  },
  stepLabel: {
    fontFamily: font('body', 600),
    fontSize: 11.5,
    marginRight: 8,
  },
  stepLine: {
    width: 22,
    height: 2,
    borderRadius: 2,
    marginRight: 8,
    overflow: 'hidden' as const,
  },
  stepLineFill: {
    width: '100%' as const,
    height: '100%' as const,
  },

  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  cardTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  cardTitleInline: {
    fontFamily: font('body', 700),
    fontSize: 13,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.04 * 13,
  },
  cardSub: {
    fontFamily: font('body', 400),
    fontSize: 14,
  },
  roomLine: {
    fontFamily: font('body', 400),
    fontSize: 13,
  },

  stampRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    alignSelf: 'center' as const,
    marginTop: 4,
  },
  stamp: {
    fontFamily: font('body', 400),
    fontSize: 11.5,
  },
});
