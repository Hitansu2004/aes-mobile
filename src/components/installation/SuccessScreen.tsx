import React, { useEffect } from 'react';
import { Linking, View } from 'react-native';
import { MotiView } from 'moti';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { Check, MessageCircle, Phone, Sparkles } from 'lucide-react-native';

import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives/Text';
import { Button } from '@/components/primitives/Button';
import { PressableScale } from '@/components/primitives/PressableScale';
import { AnimatedCheckmark } from '@/components/primitives/AnimatedCheckmark';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { slotLabel } from '@/lib/constants';
import type { InstallationRequest } from '@/types/api';

// Success screen. Ported from installation/page.js's `SuccessScreen` +
// its .successCheckRing/.timeline/.successContactCard classes.
const TIMELINE = [
  { state: 'done' as const, label: 'Request received', sub: 'We have your details' },
  { state: 'active' as const, label: 'Team reviews & confirms', sub: 'Within 2 hours' },
  { state: 'pending' as const, label: 'Engineer visits your site', sub: 'On the scheduled day' },
  { state: 'pending' as const, label: 'Quote shared within 24h', sub: 'You can accept and schedule installation' },
];

export interface InstallationSuccessScreenProps {
  request: InstallationRequest;
  onTrack: () => void;
  onHome: () => void;
}

export function InstallationSuccessScreen({ request, onTrack, onHome }: InstallationSuccessScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const { tokens } = useTheme();

  const dateLabel = request.scheduledDate
    ? new Date(request.scheduledDate).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' })
    : null;

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
            from={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 100 }}
            style={[styles.check, { backgroundColor: tokens.colors.secondary }, shadow('glow')]}
          >
            <AnimatedCheckmark size={40} color={tokens.colors.onSecondary} strokeWidth={3} />
          </MotiView>
        </View>

        <Text variant="headlineLg" color="primaryDark" align="center" style={styles.heading}>
          Request Submitted!
        </Text>
        <Text style={styles.ref} color="onSurfaceVariant" align="center">
          Request No: <Text style={styles.refStrong} color="secondaryInk">{request.requestNumber || 'PENDING'}</Text>
        </Text>

        <View style={[styles.infoBox, { backgroundColor: tokens.colors.infoLight, borderColor: tokens.colors.secondaryLight }]}>
          <Sparkles size={18} color={tokens.colors.secondaryInk} />
          <Text style={[styles.infoBoxText, { color: tokens.colors.secondaryInk }]}>
            {'Our team will contact you within '}
            <Text style={[styles.infoBoxStrong, { color: tokens.colors.secondaryInk }]}>2 hours</Text>
            {' to confirm your site visit'}
            {dateLabel ? (
              <>
                {' on '}
                <Text style={[styles.infoBoxStrong, { color: tokens.colors.secondaryInk }]}>{dateLabel}</Text>
              </>
            ) : '.'}
            {request.scheduledSlot ? ` (${slotLabel(request.scheduledSlot)})` : ''}
          </Text>
        </View>

        <View style={[styles.timeline, { borderColor: tokens.colors.borderLight }]}>
          <Text style={styles.timelineTitle} color="onSurfaceVariant">What happens next</Text>
          <View style={styles.timelineList}>
            <View style={[styles.timelineRail, { backgroundColor: tokens.colors.borderLight }]} />
            {TIMELINE.map((step, i) => (
              <View key={i} style={styles.timelineItem}>
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineLabel} color={step.state === 'pending' ? 'onSurfaceVariant' : 'onSurface'}>
                    {step.label}
                  </Text>
                  <Text style={styles.timelineSub} color="onSurfaceVariant">{step.sub}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.contactCard, { borderColor: tokens.colors.borderLight }]}>
          <Text style={styles.contactTitle} color="onSurface" align="center">Need to change or cancel?</Text>
          <View style={{ gap: space[2] }}>
            <PressableScale
              style={[styles.contactBtn, { backgroundColor: tokens.colors.primary }]}
              onPress={() => Linking.openURL('tel:+914023540000')}
            >
              <Phone size={14} color={tokens.colors.onPrimary} />
              <Text style={[styles.contactBtnLabel, { color: tokens.colors.onPrimary }]}>+91 40-2354-XXXX</Text>
            </PressableScale>
            <PressableScale
              style={[styles.contactBtn, { borderWidth: 1.5, borderColor: tokens.colors.secondary }]}
              onPress={() => Linking.openURL('https://wa.me/914023540000')}
            >
              <MessageCircle size={14} color={tokens.colors.secondaryInk} />
              <Text style={[styles.contactBtnLabel, { color: tokens.colors.secondaryInk }]}>WhatsApp Us</Text>
            </PressableScale>
          </View>
        </View>

        <View style={styles.actions}>
          <Button variant="outline" fullWidth onPress={onTrack}>Track this request</Button>
          <Button variant="primary" fullWidth onPress={onHome}>Back to home</Button>
        </View>
      </MotiView>
    </View>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  root: {
    flex: 1,
  },
  inner: {
    alignItems: 'center' as const,
    gap: space[4],
    paddingTop: space[4],
    paddingBottom: space[8],
  },
  checkRingWrap: {
    width: 96,
    height: 96,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: space[4],
  },
  pulse: {
    position: 'absolute' as const,
    width: 96,
    height: 96,
    borderRadius: radius.full,
    borderWidth: 2,
  },
  check: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  heading: {
    marginTop: space[1],
  },
  ref: {
    fontFamily: font('body', 400),
    fontSize: 14,
  },
  refStrong: {
    fontFamily: font('mono', 500),
    fontSize: 15,
    letterSpacing: 0.02 * 15,
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
  timelineTitle: {
    fontFamily: font('body', 700),
    fontSize: 11,
    letterSpacing: 0.12 * 11,
    textTransform: 'uppercase' as const,
    marginBottom: space[3],
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
    alignItems: 'flex-start' as const,
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
    fontFamily: font('body', 600),
    fontSize: 14,
  },
  timelineSub: {
    fontFamily: font('body', 400),
    fontSize: 12,
    marginTop: 2,
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
    fontSize: 14,
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
    fontSize: 14,
  },
  actions: {
    width: '100%' as const,
    gap: space[2] + 2,
    marginTop: space[1],
  },
});
