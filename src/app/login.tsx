import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import {
  ArrowRight, CalendarClock, Eye, EyeOff, Lock, Mail, ShieldCheck, Snowflake, Wrench,
} from 'lucide-react-native';

import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useHaptics } from '@/hooks/useHaptics';
import { Spinner } from '@/components/primitives/Spinner';
import { Text } from '@/components/primitives/Text';
import { ShakeView } from '@/components/primitives/ShakeView';
import { Splash } from '@/components/shell/Splash';

const FEATURES = [
  { Icon: Wrench, label: 'Book repairs & service in seconds' },
  { Icon: CalendarClock, label: 'Track every ticket in real time' },
  { Icon: ShieldCheck, label: 'Secure, encrypted access' },
];

// Fixed navy/gold/cream palette lifted verbatim from the scoped CSS vars in
// ../aes-frontend/src/app/login/login.module.css. Unlike every other screen,
// login has NO dark-mode variant on the web — it never references
// globals.css's `[data-theme="dark"]` tokens — so this screen intentionally
// does not read from theme/tokens.ts and renders identically regardless of
// the device/app theme, exactly mirroring the web.
const LOGIN = {
  primary: '#C9A84C',
  primaryHover: '#B5912E',
  primaryInk: '#8F701E',
  primaryContainer: '#E6D29B',
  onPrimary: '#0B1A2C',
  navy: '#0B1A2C',
  navyDark: '#06121F',
  navyLight: '#17293D',
  onNavy: '#ffffff',
  surface: '#faf9f5',
  surfaceContainerLowest: '#ffffff',
  surfaceContainer: '#F1ECE0',
  onSurface: '#14202E',
  onSurfaceStrong: '#0B1A2C',
  onSurfaceVariant: '#5C5647',
  outline: '#A99F86',
  outlineVariant: '#E2DAC6',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
};

// Ports .brandGrid: a 52px grid of 1px white lines masked to the panel —
// fixed white-on-navy regardless of theme, distinct from the gold-tinted
// BlueprintBackground primitive used on cream surfaces elsewhere in the app.
function BrandGrid() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" width="100%" height="100%">
      <Defs>
        <Pattern id="loginGrid" width={52} height={52} patternUnits="userSpaceOnUse">
          <Line x1={0} y1={0} x2={52} y2={0} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          <Line x1={0} y1={0} x2={0} y2={52} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#loginGrid)" />
    </Svg>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { user, loading: authLoading, login } = useAuth();
  const toast = useToast();
  const haptics = useHaptics();
  const { isTablet, isLarge } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const splitLayout = isTablet || isLarge;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [errorTick, setErrorTick] = useState(0);
  const [busy, setBusy] = useState(false);

  const cardOpacity = useSharedValue(0);
  const cardY = useSharedValue(16);
  const shimmer = useSharedValue(0);
  const aurora = useSharedValue(0);

  useEffect(() => {
    cardOpacity.value = withTiming(1, { duration: 450, easing: Easing.bezier(0.22, 1, 0.36, 1) });
    cardY.value = withTiming(0, { duration: 450, easing: Easing.bezier(0.22, 1, 0.36, 1) });
    aurora.value = withRepeat(withTiming(1, { duration: 20000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [cardOpacity, cardY, aurora]);

  useEffect(() => {
    shimmer.value = busy
      ? withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false)
      : withTiming(0, { duration: 150 });
  }, [busy, shimmer]);

  const justLoggedIn = useRef(false);

  useEffect(() => {
    if (authLoading || !user) return;
    if (justLoggedIn.current) {
      justLoggedIn.current = false;
      const firstName = user.name ? user.name.split(' ')[0] : '';
      toast.success(`Welcome back${firstName ? `, ${firstName}` : ''}.`);
      haptics.success();
    }
    const target = (Array.isArray(next) ? next[0] : next) || defaultRouteForRole(user.role);
    router.replace(target as Parameters<typeof router.replace>[0]);
  }, [user, authLoading, router, next, toast, haptics]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardY.value }],
  }));

  const auroraStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (aurora.value - 0.5) * 60 },
      { translateY: (aurora.value - 0.5) * 40 },
    ],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + shimmer.value * 0.35,
  }));

  const handleLogin = async () => {
    setError('');
    const id = identifier.trim();
    if (!id) {
      setError('Enter your phone number or email.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }
    setBusy(true);
    try {
      justLoggedIn.current = true;
      await login(id, password);
    } catch (err) {
      justLoggedIn.current = false;
      const message = err instanceof Error && err.message
        ? err.message
        : 'Incorrect credentials. Please try again.';
      setError(message);
      setPassword('');
      setErrorTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || user) {
    return <Splash />;
  }

  const disabled = busy || !identifier.trim() || !password;

  return (
    <View style={styles.page}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            splitLayout ? styles.scrollSplit : styles.scrollStack,
            { paddingBottom: insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={splitLayout ? styles.layoutSplit : styles.layoutStack}>
            {/* ── Brand panel (navy) — paddingTop clears the status
                bar/notch/Dynamic Island on every device, not just the ones
                the fixed 84 decorative value happened to fit. ─────────── */}
            <View
              style={[
                styles.brandPanel,
                splitLayout ? styles.brandPanelSplit : styles.brandPanelStack,
                !splitLayout && { paddingTop: insets.top + 44 },
              ]}
            >
              <LinearGradient
                colors={[LOGIN.navyLight, LOGIN.navy, LOGIN.navyDark]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.brandGradient}
              />
              {splitLayout && (
                <Animated.View style={[styles.auroraWrap, auroraStyle]} pointerEvents="none">
                  <LinearGradient
                    colors={['rgba(201,168,76,0.16)', 'rgba(201,168,76,0)']}
                    style={styles.aurora}
                  />
                </Animated.View>
              )}
              {splitLayout && (
                <View style={styles.gridWrap} pointerEvents="none">
                  <BrandGrid />
                </View>
              )}

              <View style={splitLayout ? styles.brandInnerSplit : styles.brandInnerStack}>
                <View style={[styles.brand, !splitLayout && styles.brandCenter]}>
                  <View style={styles.brandChip}>
                    <Snowflake size={32} strokeWidth={2.2} color={LOGIN.primary} />
                  </View>
                  <Text
                    style={[
                      styles.wordmark,
                      { fontSize: splitLayout ? 34 : 28 },
                    ]}
                  >
                    Arial Engineering
                  </Text>
                  <View style={!splitLayout ? styles.brandTagRow : undefined}>
                    {!splitLayout && <View style={styles.tagRule} />}
                    <Text style={styles.brandTag}>HVAC Services Portal</Text>
                    {!splitLayout && <View style={styles.tagRule} />}
                  </View>
                </View>

                <Text style={[styles.lede, !splitLayout && styles.ledeCenter]}>
                  Repairs, maintenance and installations — managed in one place.
                </Text>

                {splitLayout && (
                  <View style={styles.features}>
                    {FEATURES.map(({ Icon, label }) => (
                      <View key={label} style={styles.feature}>
                        <View style={styles.featureIcon}>
                          <Icon size={16} strokeWidth={2.2} color={LOGIN.primary} />
                        </View>
                        <Text style={styles.featureLabel}>{label}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {splitLayout && (
                <Text style={styles.brandFoot}>
                  Need help? Call{' '}
                  <Text style={styles.brandFootLink}>+91 40-2354-XXXX</Text>
                </Text>
              )}
            </View>

            {/* ── Form panel (light) ─────────────────────────── */}
            <View style={splitLayout ? styles.formPanelSplit : styles.formPanelStack}>
              {!splitLayout && <View style={styles.grabber} />}
              <ShakeView shakeKey={errorTick} style={styles.card}>
              <Animated.View style={cardStyle}>
                <View style={styles.heading}>
                  <Text style={styles.h2}>Welcome back</Text>
                  <Text style={styles.h2sub}>Sign in to your account to continue.</Text>
                </View>

                <View style={styles.form}>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Phone or Email</Text>
                    <View style={styles.inputWrap}>
                      <Mail size={18} strokeWidth={2} color={LOGIN.outline} />
                      <TextInput
                        value={identifier}
                        onChangeText={setIdentifier}
                        placeholder="Enter your phone or email"
                        placeholderTextColor={LOGIN.outline}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType="username"
                        style={styles.input}
                      />
                    </View>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Password</Text>
                    <View style={styles.inputWrap}>
                      <Lock size={18} strokeWidth={2} color={LOGIN.outline} />
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Enter your password"
                        placeholderTextColor={LOGIN.outline}
                        secureTextEntry={!showPassword}
                        textContentType="password"
                        style={styles.input}
                      />
                      <Pressable
                        onPress={() => setShowPassword((s) => !s)}
                        hitSlop={8}
                        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff size={18} strokeWidth={2} color={LOGIN.onSurfaceVariant} />
                        ) : (
                          <Eye size={18} strokeWidth={2} color={LOGIN.onSurfaceVariant} />
                        )}
                      </Pressable>
                    </View>
                  </View>

                  {error ? (
                    <MotiView
                      from={{ opacity: 0, translateY: -4 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      style={styles.error}
                    >
                      <Text style={styles.errorText}>{error}</Text>
                    </MotiView>
                  ) : null}

                  <Pressable
                    disabled={disabled}
                    onPress={handleLogin}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.cta,
                      shadow('cta'),
                      { opacity: disabled ? 0.55 : pressed ? 0.92 : 1 },
                    ]}
                  >
                    {busy ? (
                      <>
                        <Animated.View style={[styles.ctaShimmer, shimmerStyle]} />
                        <Spinner size="sm" />
                      </>
                    ) : (
                      <>
                        <Text style={styles.ctaLabel}>Sign In</Text>
                        <ArrowRight size={18} color={LOGIN.onPrimary} />
                      </>
                    )}
                  </Pressable>

                  <View style={styles.trust}>
                    <ShieldCheck size={15} strokeWidth={2.2} color={LOGIN.primaryInk} />
                    <Text style={styles.trustLabel}>Encrypted & secure sign-in</Text>
                  </View>
                </View>

                <View style={styles.legal}>
                  <Text style={styles.legalText}>
                    By signing in, you agree to our{' '}
                    <Text style={styles.legalLink}>Terms</Text>
                    {' & '}
                    <Text style={styles.legalLink}>Privacy Policy</Text>
                  </Text>
                </View>
              </Animated.View>
              </ShakeView>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = () => ({
  page: {
    flex: 1,
    backgroundColor: LOGIN.surface,
  },
  scrollStack: {
    flexGrow: 1,
  },
  scrollSplit: {
    flexGrow: 1,
  },
  layoutStack: {
    flex: 1,
  },
  layoutSplit: {
    flex: 1,
    flexDirection: 'row' as const,
    minHeight: '100%' as const,
  },

  // Brand panel
  brandPanel: {
    overflow: 'hidden' as const,
  },
  brandPanelStack: {
    paddingTop: 84,
    paddingBottom: 48,
    paddingHorizontal: space[8],
    alignItems: 'center' as const,
  },
  brandPanelSplit: {
    flex: 1.05,
    justifyContent: 'center' as const,
    paddingHorizontal: space[16],
    paddingVertical: space[16],
  },
  brandGradient: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0,
  },
  auroraWrap: {
    position: 'absolute' as const,
    right: -80,
    bottom: -80,
    width: 420,
    height: 300,
  },
  aurora: {
    flex: 1,
    borderRadius: 300,
  },
  gridWrap: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.6,
  },

  brandInnerSplit: {
    gap: space[7],
    maxWidth: 420,
  },
  brandInnerStack: {
    gap: space[4] + 2,
    alignItems: 'center' as const,
    maxWidth: 380,
  },
  brand: {
    gap: space[4],
    alignItems: 'flex-start' as const,
  },
  brandCenter: {
    alignItems: 'center' as const,
    gap: space[3] + 2,
  },
  brandChip: {
    width: 66,
    height: 66,
    borderRadius: radius.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: LOGIN.navyLight,
  },
  wordmark: {
    fontFamily: font('display', 700),
    lineHeight: 38,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: LOGIN.onNavy,
  },
  brandTagRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[2] + 2,
  },
  tagRule: {
    width: 22,
    height: 1,
    backgroundColor: 'rgba(230, 210, 155, 0.45)',
  },
  brandTag: {
    fontFamily: font('body', 600),
    fontSize: 10.5,
    letterSpacing: 2.5,
    textTransform: 'uppercase' as const,
    color: LOGIN.primaryContainer,
  },
  lede: {
    fontFamily: font('body', 400),
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.72)',
  },
  ledeCenter: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center' as const,
  },
  features: {
    gap: space[3] + 2,
  },
  feature: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[3],
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(201, 168, 76, 0.14)',
  },
  featureLabel: {
    fontFamily: font('body', 400),
    fontSize: 14.5,
    color: 'rgba(255,255,255,0.82)',
    flexShrink: 1,
  },
  brandFoot: {
    fontFamily: font('body', 400),
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginTop: space[10],
  },
  brandFootLink: {
    fontFamily: font('body', 600),
    color: 'rgba(255,255,255,0.9)',
  },

  // Form panel
  formPanelStack: {
    marginTop: -24,
    backgroundColor: LOGIN.surfaceContainerLowest,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space[3],
    paddingHorizontal: space[6],
    paddingBottom: space[10],
    ...shadow('lg'),
  },
  formPanelSplit: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: space[8],
    paddingVertical: space[12],
  },
  grabber: {
    alignSelf: 'center' as const,
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: LOGIN.outlineVariant,
    marginBottom: space[4],
  },
  card: {
    width: '100%' as const,
    maxWidth: 400,
    gap: space[6],
  },

  heading: {
    gap: space[2] - 2,
  },
  h2: {
    fontFamily: font('display', 700),
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.3,
    color: LOGIN.onSurfaceStrong,
  },
  h2sub: {
    fontFamily: font('body', 400),
    fontSize: 14,
    lineHeight: 21,
    color: LOGIN.onSurfaceVariant,
  },

  form: {
    gap: space[4],
  },
  field: {
    gap: space[2],
  },
  fieldLabel: {
    fontFamily: font('body', 600),
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase' as const,
    color: LOGIN.onSurfaceVariant,
  },
  inputWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[3],
    height: 54,
    paddingHorizontal: space[4],
    backgroundColor: LOGIN.surface,
    borderWidth: 1.5,
    borderColor: LOGIN.outlineVariant,
    borderRadius: radius.md,
  },
  input: {
    flex: 1,
    fontFamily: font('body', 500),
    fontSize: 16,
    letterSpacing: 0.16,
    color: LOGIN.onSurface,
    padding: 0,
  },

  error: {
    backgroundColor: LOGIN.errorContainer,
    paddingVertical: space[2] + 2,
    paddingHorizontal: space[3] + 2,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: LOGIN.error,
  },
  errorText: {
    fontFamily: font('body', 500),
    fontSize: 13,
    color: LOGIN.error,
  },

  cta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: space[2] + 2,
    height: 54,
    marginTop: space[1],
    borderRadius: radius.md,
    backgroundColor: LOGIN.primary,
    overflow: 'hidden' as const,
  },
  ctaShimmer: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: LOGIN.primaryHover,
  },
  ctaLabel: {
    fontFamily: font('body', 600),
    fontSize: 16,
    letterSpacing: 0.32,
    color: LOGIN.onPrimary,
  },

  trust: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: space[2],
  },
  trustLabel: {
    fontFamily: font('body', 400),
    fontSize: 12.5,
    color: LOGIN.onSurfaceVariant,
  },

  legal: {
    borderTopWidth: 1,
    borderTopColor: LOGIN.outlineVariant,
    paddingTop: space[4] + 2,
    alignItems: 'center' as const,
  },
  legalText: {
    fontFamily: font('body', 400),
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center' as const,
    color: LOGIN.onSurfaceVariant,
  },
  legalLink: {
    fontFamily: font('body', 500),
    color: LOGIN.onSurfaceStrong,
  },
});
