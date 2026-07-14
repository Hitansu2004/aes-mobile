import React, {
  forwardRef, useImperativeHandle, useRef, useState,
} from 'react';
import { View } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Star, ThumbsDown, ThumbsUp, MessageSquare } from 'lucide-react-native';

import { Sheet, SheetRef } from '@/components/primitives/Sheet';
import { Text } from '@/components/primitives/Text';
import { Button } from '@/components/primitives/Button';
import { TextArea } from '@/components/primitives/Input';
import { Chip, ChipRow } from '@/components/primitives/Chip';
import { DayPicker } from '@/components/ui/DayPicker';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import type { ServiceTicket, Quote } from '@/types/api';

// Ported from ../../aes-frontend/src/app/tickets/[ticketNumber]/page.js's
// SheetFrame + {Rating,Reschedule,Escalate,Reopen,QuoteReview}Sheet. On the
// web these are fixed-position overlays; here each wraps the Phase-2 <Sheet>
// primitive (RN has no backdrop-overlay concept) and is imperatively
// presented via a forwardRef, matching PaymentModal/LocationPicker (Phase 6).
export interface DetailSheetRef {
  present: () => void;
  dismiss: () => void;
}

const SNAP = ['60%', '92%'];

// ─── Rate ──────────────────────────────────────────────────────────────

export interface RateSheetProps {
  ticket: ServiceTicket;
  onSubmit: (rating: number, feedback: string | null) => Promise<void>;
}

export const RateSheet = forwardRef<DetailSheetRef, RateSheetProps>(function RateSheet(
  { ticket, onSubmit },
  ref,
) {
  const { tokens } = useTheme();
  const haptics = useHaptics();
  const sheetRef = useRef<SheetRef>(null);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  useImperativeHandle(ref, () => ({
    present: () => { setRating(0); setFeedback(''); sheetRef.current?.present(); },
    dismiss: () => sheetRef.current?.dismiss(),
  }), []);

  const submit = async () => {
    if (rating < 1) return;
    setSaving(true);
    await onSubmit(rating, feedback.trim() || null);
    setSaving(false);
  };

  return (
    <Sheet ref={sheetRef} snapPoints={SNAP} title="Rate your service">
      <BottomSheetScrollView contentContainerStyle={styles.body}>
        <Text variant="bodySm" color="onSurfaceVariant">
          {`How was your experience with ticket ${ticket.ticketNumber}?`}
        </Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Button key={n} variant="ghost" onPress={() => { haptics.selection(); setRating(n); }}>
              <Star size={36} strokeWidth={1.5} color="#f59e0b" fill={rating >= n ? '#f59e0b' : 'transparent'} />
            </Button>
          ))}
        </View>
        <TextArea
          minHeight={72}
          maxLength={500}
          placeholder="Tell us what went well or what we can improve (optional)"
          value={feedback}
          onChangeText={setFeedback}
        />
        <Button variant="primary" size="lg" fullWidth disabled={rating < 1} loading={saving} onPress={submit}>
          Submit Rating
        </Button>
      </BottomSheetScrollView>
    </Sheet>
  );
});

// ─── Reschedule ────────────────────────────────────────────────────────

export interface RescheduleSheetProps {
  ticket: ServiceTicket;
  onSubmit: (data: { scheduledDate: string; scheduledSlot: string; reason: string | null }) => Promise<void>;
}

const RESCHEDULE_SLOTS = [
  { value: 'MORNING', label: 'Morning · 9 AM – 12 PM' },
  { value: 'AFTERNOON', label: 'Afternoon · 12 PM – 3 PM' },
  { value: 'EVENING', label: 'Evening · 3 PM – 6 PM' },
];

export const RescheduleSheet = forwardRef<DetailSheetRef, RescheduleSheetProps>(function RescheduleSheet(
  { ticket, onSubmit },
  ref,
) {
  const sheetRef = useRef<SheetRef>(null);
  const [date, setDate] = useState<string>('');
  const [slot, setSlot] = useState<string>('AFTERNOON');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useImperativeHandle(ref, () => ({
    present: () => {
      setDate(ticket.scheduledDate ? ticket.scheduledDate.slice(0, 10) : '');
      setSlot(ticket.scheduledSlot || 'AFTERNOON');
      setReason('');
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }), [ticket]);

  const submit = async () => {
    if (!date) return;
    setSaving(true);
    await onSubmit({ scheduledDate: date, scheduledSlot: slot, reason: reason.trim() || null });
    setSaving(false);
  };

  return (
    <Sheet ref={sheetRef} snapPoints={SNAP} title="Reschedule visit">
      <BottomSheetScrollView contentContainerStyle={styles.body}>
        <Text variant="bodySm" color="onSurfaceVariant">Pick a date and slot that works for you.</Text>
        <View style={{ gap: space[2] }}>
          <Text style={styles.label}>New date</Text>
          <DayPicker value={date} onChange={setDate} />
        </View>
        <View style={{ gap: space[2] }}>
          <Text style={styles.label}>Slot</Text>
          <ChipRow>
            {RESCHEDULE_SLOTS.map((s) => (
              <Chip key={s.value} label={s.label} selected={slot === s.value} onPress={() => setSlot(s.value)} />
            ))}
          </ChipRow>
        </View>
        <TextArea
          label="Reason (optional)"
          minHeight={52}
          placeholder="Will be out, prefer weekend, etc."
          value={reason}
          onChangeText={setReason}
        />
        <Button variant="primary" size="lg" fullWidth disabled={!date} loading={saving} onPress={submit}>
          Confirm reschedule
        </Button>
      </BottomSheetScrollView>
    </Sheet>
  );
});

// ─── Escalate ──────────────────────────────────────────────────────────

export interface EscalateSheetProps {
  ticket: ServiceTicket;
  onSubmit: (data: { reason: string; details: string | null }) => Promise<void>;
}

export const EscalateSheet = forwardRef<DetailSheetRef, EscalateSheetProps>(function EscalateSheet(
  { ticket, onSubmit },
  ref,
) {
  const sheetRef = useRef<SheetRef>(null);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);

  useImperativeHandle(ref, () => ({
    present: () => { setReason(''); setDetails(''); sheetRef.current?.present(); },
    dismiss: () => sheetRef.current?.dismiss(),
  }), []);

  const submit = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    await onSubmit({ reason: reason.trim(), details: details.trim() || null });
    setSaving(false);
  };

  return (
    <Sheet ref={sheetRef} snapPoints={SNAP} title={`Escalate ${ticket.ticketNumber}`}>
      <BottomSheetScrollView contentContainerStyle={styles.body}>
        <Text variant="bodySm" color="onSurfaceVariant">
          A Service Manager will be alerted. Use this when CRM hasn&apos;t responded or the issue is urgent.
        </Text>
        <TextArea
          label="What's wrong?*"
          minHeight={52}
          placeholder="No response for 30 min, urgent business need…"
          value={reason}
          onChangeText={setReason}
        />
        <TextArea
          label="Anything else (optional)"
          minHeight={72}
          maxLength={500}
          value={details}
          onChangeText={setDetails}
        />
        <Button variant="primary" size="lg" fullWidth disabled={!reason.trim()} loading={saving} onPress={submit}>
          Escalate
        </Button>
      </BottomSheetScrollView>
    </Sheet>
  );
});

// ─── Reopen ────────────────────────────────────────────────────────────

export interface ReopenSheetProps {
  ticket: ServiceTicket;
  onSubmit: (data: { reason: string }) => Promise<void>;
}

export const ReopenSheet = forwardRef<DetailSheetRef, ReopenSheetProps>(function ReopenSheet(
  { ticket, onSubmit },
  ref,
) {
  const sheetRef = useRef<SheetRef>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useImperativeHandle(ref, () => ({
    present: () => { setReason(''); sheetRef.current?.present(); },
    dismiss: () => sheetRef.current?.dismiss(),
  }), []);

  const submit = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    await onSubmit({ reason: reason.trim() });
    setSaving(false);
  };

  return (
    <Sheet ref={sheetRef} snapPoints={SNAP} title={`Re-open ${ticket.ticketNumber}`}>
      <BottomSheetScrollView contentContainerStyle={styles.body}>
        <Text variant="bodySm" color="onSurfaceVariant">
          Tell us what&apos;s still wrong. We&apos;ll re-open the ticket and assign it to a CRM right away.
        </Text>
        <TextArea
          label="What's still broken?*"
          minHeight={92}
          maxLength={1000}
          placeholder="Same issue came back yesterday, etc."
          value={reason}
          onChangeText={setReason}
        />
        <Button variant="primary" size="lg" fullWidth disabled={!reason.trim()} loading={saving} onPress={submit}>
          Re-open ticket
        </Button>
      </BottomSheetScrollView>
    </Sheet>
  );
});

// ─── Quote review ──────────────────────────────────────────────────────

interface ParsedLineItem {
  description: string;
  qty: number;
  unitPrice: number;
  gstPct?: number;
}

// `quote.lineItemsJson` is the only source for line items — the backend's
// QuoteResponse has no `items`/`gst` fields (unlike the web's SheetReview,
// which reads `quote.items`/`quote.gst` that don't actually exist on the
// real response shape; see aes-backend-node QuoteService#toResponse). Parsed
// here instead of porting that dead code path verbatim.
function parseLineItems(json: string): ParsedLineItem[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((it): it is ParsedLineItem => (
      typeof it === 'object' && it !== null
      && typeof (it as ParsedLineItem).description === 'string'
      && typeof (it as ParsedLineItem).qty === 'number'
      && typeof (it as ParsedLineItem).unitPrice === 'number'
    ));
  } catch {
    return [];
  }
}

function inr(n: number): string {
  return Number(n || 0).toLocaleString('en-IN');
}

export interface QuoteReviewSheetProps {
  quote: Quote | null;
  onSubmit: (decision: 'ACCEPT' | 'REJECT' | 'NEGOTIATE', comment: string | null) => Promise<void>;
}

export const QuoteReviewSheet = forwardRef<DetailSheetRef, QuoteReviewSheetProps>(function QuoteReviewSheet(
  { quote, onSubmit },
  ref,
) {
  const { tokens } = useTheme();
  const sheetRef = useRef<SheetRef>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useImperativeHandle(ref, () => ({
    present: () => { setComment(''); sheetRef.current?.present(); },
    dismiss: () => sheetRef.current?.dismiss(),
  }), []);

  if (!quote) return <Sheet ref={sheetRef} snapPoints={SNAP} />;

  const items = parseLineItems(quote.lineItemsJson);

  const submit = async (decision: 'ACCEPT' | 'REJECT' | 'NEGOTIATE') => {
    setSaving(true);
    await onSubmit(decision, comment.trim() || null);
    setSaving(false);
  };

  return (
    <Sheet ref={sheetRef} snapPoints={SNAP} title={`${quote.quoteNumber} · ₹${inr(quote.total)}`}>
      <BottomSheetScrollView contentContainerStyle={styles.body}>
        <Text variant="bodySm" color="onSurfaceVariant">
          {`Estimate prepared by ${quote.preparedByName || 'AES'} on ${quote.createdAt ? new Date(quote.createdAt).toLocaleDateString('en-IN') : '—'}.`}
        </Text>

        <View style={[styles.quoteBox, { borderColor: tokens.colors.outlineVariant }]}>
          {items.map((it, i) => (
            <View
              key={`${it.description}-${i}`}
              style={[
                styles.quoteRow,
                i < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: tokens.colors.outlineVariant },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.quoteItemDesc} color="onSurface">{it.description}</Text>
                <Text variant="bodySm" color="onSurfaceVariant">{`${it.qty} × ₹${inr(it.unitPrice)}`}</Text>
              </View>
              <Text style={styles.quoteItemTotal} color="onSurfaceStrong">{`₹${inr(it.qty * it.unitPrice)}`}</Text>
            </View>
          ))}
          <View style={styles.quoteSummary}>
            <Text variant="bodySm" color="onSurfaceVariant">
              {`Subtotal ₹${inr(quote.subtotal)}`}
              {quote.discount > 0 ? ` · Discount −₹${inr(quote.discount)}` : ''}
              {quote.tax > 0 ? ` · GST ₹${inr(quote.tax)}` : ''}
            </Text>
          </View>
          <View style={[styles.quoteTotalRow, { backgroundColor: tokens.colors.surfaceContainerLow, borderTopColor: tokens.colors.outlineVariant }]}>
            <Text style={{ fontFamily: font('body', 700) }} color="onSurface">Total</Text>
            <Text style={{ fontFamily: font('body', 700) }} color="onSurface">{`₹${inr(quote.total)}`}</Text>
          </View>
        </View>

        {quote.validUntil ? (
          <Text variant="bodySm" color="onSurfaceVariant">
            {`Valid until ${new Date(quote.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`}
          </Text>
        ) : null}

        <TextArea
          label="Comment (required for negotiate / reject)"
          minHeight={72}
          maxLength={500}
          value={comment}
          onChangeText={setComment}
          placeholder="What you'd like adjusted, or why you're declining"
        />

        <View style={styles.decisionRow}>
          <View style={styles.decisionCol}>
            <Button variant="outline" fullWidth disabled={saving} onPress={() => submit('REJECT')} leftIcon={<ThumbsDown size={14} color={tokens.colors.primary} />}>
              Reject
            </Button>
          </View>
          <View style={styles.decisionCol}>
            <Button variant="soft" fullWidth disabled={saving} onPress={() => submit('NEGOTIATE')} leftIcon={<MessageSquare size={14} color={tokens.colors.primary} />}>
              Negotiate
            </Button>
          </View>
          <View style={styles.decisionCol}>
            <Button variant="primary" fullWidth disabled={saving} onPress={() => submit('ACCEPT')} leftIcon={<ThumbsUp size={14} color={tokens.colors.onSecondary} />}>
              Accept
            </Button>
          </View>
        </View>
      </BottomSheetScrollView>
    </Sheet>
  );
});

const styles = {
  body: {
    gap: space[4],
    paddingHorizontal: space[5],
    paddingBottom: space[10],
  },
  label: {
    fontFamily: font('body', 600),
    fontSize: 12,
    letterSpacing: 0.06 * 12,
    textTransform: 'uppercase' as const,
  },
  starsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: 2,
  },
  quoteBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space[2],
  },
  quoteRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: space[2],
    paddingHorizontal: space[4],
    gap: space[3],
  },
  quoteItemDesc: {
    fontFamily: font('body', 600),
    fontSize: 13,
  },
  quoteItemTotal: {
    fontFamily: font('body', 700),
    fontSize: 14,
  },
  quoteSummary: {
    paddingVertical: space[2],
    paddingHorizontal: space[4],
  },
  quoteTotalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: space[3] - 2,
    paddingHorizontal: space[4],
    borderTopWidth: 1,
  },
  decisionRow: {
    flexDirection: 'row' as const,
    gap: 6,
  },
  decisionCol: {
    flex: 1,
  },
};
