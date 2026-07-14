import React, { useEffect } from 'react';
import { Linking, View } from 'react-native';
import { MotiView } from 'moti';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import {
  CalendarDays, Check, MessageCircle, Phone,
} from 'lucide-react-native';

import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives/Text';
import { Button } from '@/components/primitives/Button';
import { PressableScale } from '@/components/primitives/PressableScale';
import { AnimatedCheckmark } from '@/components/primitives/AnimatedCheckmark';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { slotLabel } from '@/lib/constants';
import type { ServiceTicket } from '@/types/api';

// Success screen. Ported from ../../aes-frontend/src/app/services/ticket/
// page.js's SuccessScreen. Ticket number renders in the mono family — it's
// a reference number, same treatment as installation's requestNumber.
const TIMELINE = [
  { state: 'done' as const, label: 'Ticket received' },
  { state: 'active' as const, label: 'CRM team responding (within 30 min)' },
  { state: 'pending' as const, label: 'Technician dispatched on scheduled date' },
  { state: 'pending' as const, label: 'Service performed and closed out' },
];

export interface TicketSuccessScreenProps {
  ticket: ServiceTicket;
  onTrack: () => void;
  onHome: () => void;
}

export function TicketSuccessScreen({ ticket, onTrack, onHome }: TicketSuccessScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const { tokens } = useTheme();

  const dateLabel = ticket.scheduledDate
    ? new Date(ticket.scheduledDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }), -1, false);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.95 + pulse.value * 0.2 }],
    opacity: 0.4 * (1 - pulse.value),
  }));

  return (
    <View style={styles.root}>
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400 }}
        style={styles.inner}
      >
        <View style={styles.checkRingWrap}>
          <Animated.View style={[styles.pulse, { borderColor: tokens.colors.secondary }, pulseStyle]} />
          <MotiView
            from={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 18 }}
            style={[styles.check, { backgroundColor: tokens.colors.secondary }, shadow('glow')]}
          >
            <AnimatedCheckmark size={40} color={tokens.colors.onSecondary} strokeWidth={3} />
          </MotiView>
        </View>

        <Text variant="headlineLg" color="primaryDark" align="center" style={styles.heading}>
          Ticket Raised!
        </Text>
        <Text style={styles.number} color="secondaryInk">{ticket.ticketNumber}</Text>

        <View style={[styles.infoBox, { backgroundColor: tokens.colors.infoLight, borderColor: tokens.colors.secondaryLight }]}>
          <CalendarDays size={16} color={tokens.colors.secondaryInk} />
          <Text style={[styles.infoBoxText, { color: tokens.colors.secondaryInk }]}>
            {'Visit scheduled for '}
            <Text style={[styles.infoBoxStrong, { color: tokens.colors.secondaryInk }]}>{dateLabel}</Text>
            {ticket.scheduledSlot ? ` · ${slotLabel(ticket.scheduledSlot)}` : ''}
          </Text>
        </View>

        <View style={[styles.timeline, { borderColor: tokens.colors.borderLight }]}>
          <View style={styles.timelineList}>
            <View style={[styles.timelineRail, { backgroundColor: tokens.colors.borderLight }]} />
            {TIMELINE.map((step, i) => (
              <MotiView
                key={step.label}
                from={{ opacity: 0, translateX: -8 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', duration: 220, delay: 300 + i * 80 }}
                style={styles.timelineItem}
              >
                <View
                  style={[
                    styles.timelineDot,
                    {
                      backgroundColor: step.state === 'done' || step.state === 'active' ? tokens.colors.secondary : tokens.colors.surfaceContainer,
                      borderColor: step.state === 'done' || step.state === 'active' ? tokens.colors.secondary : tokens.colors.outlineVariant,
                    },
                    step.state === 'active' && { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },
                  ]}
                >
                  {step.state === 'done' && <Check size={12} strokeWidth={3} color={tokens.colors.onSecondary} />}
                </View>
                <Text style={styles.timelineLabel} color={step.state === 'pending' ? 'onSurfaceVariant' : 'onSurface'}>
                  {step.label}
                </Text>
              </MotiView>
            ))}
          </View>
        </View>

        <View style={[styles.contactCard, { borderColor: tokens.colors.borderLight }]}>
          <Text style={styles.contactTitle} color="onSurface" align="center">Need to update us before the visit?</Text>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <PressableScale
              style={[styles.contactBtn, { flex: 1, backgroundColor: tokens.colors.primary }]}
              onPress={() => Linking.openURL('tel:+914023540000')}
            >
              <Phone size={13} color={tokens.colors.onPrimary} />
              <Text style={[styles.contactBtnLabel, { color: tokens.colors.onPrimary }]}>Call AES</Text>
            </PressableScale>
            <PressableScale
              style={[styles.contactBtn, { flex: 1, borderWidth: 1.5, borderColor: tokens.colors.secondary }]}
              onPress={() => Linking.openURL('https://wa.me/914023540000')}
            >
              <MessageCircle size={13} color={tokens.colors.secondaryInk} />
              <Text style={[styles.contactBtnLabel, { color: tokens.colors.secondaryInk }]}>WhatsApp</Text>
            </PressableScale>
          </View>
        </View>

        <View style={styles.actions}>
          <Button variant="outline" fullWidth onPress={onTrack}>Track This Ticket</Button>
          <Button variant="primary" fullWidth onPress={onHome}>Back to Home</Button>
        </View>
      </MotiView>
    </View>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  root: { flex: 1 },
  inner: {
    alignItems: 'center' as const,
    gap: space[4],
    paddingTop: space[4],
    paddingBottom: space[8],
  },
  checkRingWrap: {
    width: 104,
    height: 104,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: space[4],
  },
  pulse: {
    position: 'absolute' as const,
    width: 104,
    height: 104,
    borderRadius: radius.full,
    borderWidth: 2,
  },
  check: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  heading: { marginTop: space[1] },
  number: {
    fontFamily: font('mono', 600),
    fontSize: 16,
    letterSpacing: 0.02 * 16,
  },
  infoBox: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: space[3],
    width: '100%' as const,
    padding: space[4],
    borderWidth: 1,
    borderRadius: radius.md,
  },
  infoBoxText: {
    flex: 1,
    fontFamily: font('body', 400),
    fontSize: 13,
    lineHeight: 19.5,
  },
  infoBoxStrong: {
    fontFamily: font('body', 700),
    fontSize: 13,
  },
  timeline: {
    width: '100%' as const,
    padding: space[4] + 2,
    borderWidth: 1,
    borderRadius: radius.lg - 2,
    backgroundColor: tokens.colors.surfaceContainerLowest,
  },
  timelineList: {
    gap: space[4] - 2,
    position: 'relative' as const,
    marginLeft: 6,
  },
  timelineRail: {
    position: 'absolute' as const,
    left: 9,
    top: 6,
    bottom: 6,
    width: 2,
    borderRadius: 2,
  },
  timelineItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[3] + 2,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  timelineLabel: {
    flex: 1,
    fontFamily: font('body', 500),
    fontSize: 13,
  },
  contactCard: {
    width: '100%' as const,
    padding: space[4],
    borderWidth: 1,
    borderRadius: radius.lg - 2,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    gap: space[3],
  },
  contactTitle: {
    fontFamily: font('body', 700),
    fontSize: 13,
  },
  contactBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: space[2],
    paddingVertical: space[3],
    borderRadius: radius.md - 2,
  },
  contactBtnLabel: {
    fontFamily: font('body', 600),
    fontSize: 13,
  },
  actions: {
    width: '100%' as const,
    gap: space[2] + 2,
    marginTop: space[1],
  },
});
