import React, {
  useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef,
} from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import {
  AlertCircle, Building2, CheckCircle2, CreditCard, IndianRupee, Lock, ShieldCheck, Smartphone, X,
} from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import {
  Text, Sheet, SheetRef, Spinner, AnimatedCheckmark, ShakeView,
} from '@/components/primitives';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useHaptics } from '@/hooks/useHaptics';
import { radius, space } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { payments as paymentsApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import type { PaymentIntent } from '@/types/api';

// Ported from ../../aes-frontend/src/components/ui/PaymentModal.js (342
// lines) — the state machine is copied EXACTLY:
//   idle → (POST /payments/intent) → method → otp → processing → success | failed
// Renders inside <Sheet> instead of a fixed overlay (RN has no native
// backdrop). MOTION: the success state gets an animated check — a circle
// that springs in, handing off to the shared <AnimatedCheckmark> primitive
// for the self-drawing check — plus haptics.success() via useHaptics().

const METHODS = [
  {
    id: 'MOCK_UPI', label: 'UPI', hint: 'Pay via GPay / PhonePe / Paytm', Icon: Smartphone, color: '#5f6cea',
  },
  {
    id: 'MOCK_CARD', label: 'Credit / Debit Card', hint: 'Visa, Mastercard, RuPay', Icon: CreditCard, color: '#9A7B24',
  },
  {
    id: 'MOCK_NB', label: 'NetBanking', hint: 'All major banks', Icon: Building2, color: '#0B1A2C',
  },
] as const;

type Phase = 'idle' | 'method' | 'processing' | 'success' | 'failed';

export interface PaymentModalRef {
  present: () => void;
  dismiss: () => void;
}

export interface PaymentModalProps {
  amount: number;
  description?: string;
  customerName?: string;
  customerPhone?: string;
  draftId?: string;
  onClose?: () => void;
  onSuccess: (result: { paymentId: string; amount: number }) => void;
}

export const PaymentModal = forwardRef<PaymentModalRef, PaymentModalProps>(function PaymentModal({
  amount, description, customerName, customerPhone, draftId, onClose, onSuccess,
}, ref) {
  const { tokens } = useTheme();
  const toast = useToast();
  const haptics = useHaptics();
  const sheetRef = useRef<SheetRef>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [method, setMethod] = useState<string>(METHODS[0].id);
  const [otp, setOtp] = useState('');
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [error, setError] = useState('');

  useImperativeHandle(ref, () => ({
    present: () => {
      setPhase('idle');
      setOtp('');
      setError('');
      sheetRef.current?.present();
      boot();
    },
    dismiss: () => sheetRef.current?.dismiss(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const boot = useCallback(async () => {
    try {
      const data = await paymentsApi.createIntent({ amount, draftId });
      setIntent(data);
      setPhase('method');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start payment');
      setPhase('failed');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, draftId]);

  const handleConfirm = useCallback(async () => {
    if (!intent?.paymentId) return;
    setPhase('processing');
    setError('');
    await new Promise((r) => { setTimeout(r, 1500); });
    try {
      const res = await paymentsApi.confirm(intent.paymentId, { otp, method });
      if (res.status === 'SUCCESS') {
        setPhase('success');
        toast.success('Payment successful');
        haptics.success();
        setTimeout(() => onSuccess?.({ paymentId: intent.paymentId, amount }), 1200);
      } else {
        setPhase('failed');
        setError(res.failureReason || 'Payment failed — try again');
      }
    } catch (e) {
      setPhase('failed');
      setError(e instanceof Error ? e.message : 'Payment failed');
    }
  }, [intent, otp, method, amount, onSuccess, toast]);

  const inr = `₹${Number(amount || 0).toLocaleString('en-IN')}`;

  return (
    <Sheet ref={sheetRef} snapPoints={['85%']} onDismiss={onClose}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], paddingBottom: space[3],
      }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <LinearGradient
            colors={['#0B1A2C', '#17293D']}
            style={{
              width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ShieldCheck size={16} color="#ffffff" />
          </LinearGradient>
          <View>
            <Text style={{ fontFamily: font('body', 700), fontSize: 15, color: tokens.colors.onSurface }}>
              AES Payments
            </Text>
            <Text style={{ fontSize: 11, color: '#64748b' }}>
              {`Secure · Demo gateway · ${intent?.gateway || 'MOCK'}`}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => { sheetRef.current?.dismiss(); onClose?.(); }}
          accessibilityLabel="Close"
          style={{
            width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={18} color="#64748b" />
        </Pressable>
      </View>

      <LinearGradient colors={['#0f172a', '#1e293b']} style={{ padding: space[4] }}>
        <Text style={{
          fontSize: 11, color: '#94a3b8', letterSpacing: 0.55, textTransform: 'uppercase',
        }}
        >
          Amount
        </Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
        }}
        >
          <IndianRupee size={20} color="#ffffff" />
          <Text style={{ fontSize: 28, fontFamily: font('body', 800), color: '#ffffff' }}>
            {Number(amount).toLocaleString('en-IN')}
          </Text>
        </View>
        {description ? (
          <Text style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>{description}</Text>
        ) : null}
        {customerName ? (
          <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
            {`Paying as ${customerName}${customerPhone ? ` · ${customerPhone}` : ''}`}
          </Text>
        ) : null}
      </LinearGradient>

      <View style={{ padding: space[4] }}>
        {phase === 'idle' && (
          <Centered>
            <Spinner size="md" />
            <Text style={{ color: tokens.colors.onSurfaceVariant }}>Setting up secure session…</Text>
          </Centered>
        )}

        {phase === 'method' && (
          <>
            <Text style={{
              fontSize: 12, fontFamily: font('body', 600), color: '#475569', marginBottom: 10,
            }}
            >
              Select payment method
            </Text>
            <View style={{ gap: 8 }}>
              {METHODS.map(({
                id, label, hint, Icon, color,
              }) => {
                const selected = method === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => setMethod(id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: selected ? color : tokens.colors.borderLight,
                      backgroundColor: selected ? `${color}10` : tokens.colors.surfaceContainerLow,
                    }}
                  >
                    <View style={{
                      width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: color,
                    }}
                    >
                      <Icon size={16} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: font('body', 600), fontSize: 14, color: tokens.colors.onSurface }}>
                        {label}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748b' }}>{hint}</Text>
                    </View>
                    {selected && <CheckCircle2 size={18} color={color} />}
                  </Pressable>
                );
              })}
            </View>

            <View style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 12, fontFamily: font('body', 600), color: '#475569' }}>
                Enter OTP from your bank
              </Text>
              <OtpTextBox value={otp} onChange={setOtp} tokens={tokens} />
              {intent?.mockMode && (
                <View style={{
                  marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: tokens.colors.surfaceContainerLow, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
                }}
                >
                  <Lock size={12} color="#475569" />
                  <Text style={{ fontSize: 11, color: '#475569' }}>
                    {`Demo mode — use OTP `}
                    <Text style={{ fontFamily: font('body', 700), fontSize: 11, color: '#475569' }}>{intent.demoSuccessOtp}</Text>
                    {` to succeed.`}
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={handleConfirm}
              disabled={!otp}
              style={{
                marginTop: 16,
                width: '100%',
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: 'center',
                overflow: 'hidden',
                position: 'relative',
                backgroundColor: otp ? undefined : '#94a3b8',
              }}
            >
              {otp ? (
                <LinearGradient
                  colors={['#C9A84C', '#B5912E']}
                  style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 10,
                  }}
                />
              ) : null}
              <Text style={{
                fontSize: 15, fontFamily: font('body', 700), color: otp ? tokens.colors.onSecondary : '#ffffff',
              }}
              >
                {`Pay ${inr}`}
              </Text>
            </Pressable>
            <Text style={{
              fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 8,
            }}
            >
              By continuing you agree to our terms & refund policy.
            </Text>
          </>
        )}

        {phase === 'processing' && (
          <Centered>
            <Spinner size="md" />
            <Text style={{ fontFamily: font('body', 600), marginTop: 14, color: tokens.colors.onSurface }}>
              Processing your payment…
            </Text>
            <Text style={{ fontSize: 12, color: '#64748b' }}>
              {"Please don't close this window."}
            </Text>
          </Centered>
        )}

        {phase === 'success' && (
          <Centered>
            <SuccessCheck />
            <Text style={{
              fontFamily: font('body', 700), marginTop: 14, fontSize: 16, color: tokens.colors.onSurface,
            }}
            >
              Payment successful
            </Text>
            <Text style={{
              fontSize: 12, color: '#64748b', textAlign: 'center', maxWidth: 280,
            }}
            >
              {'Your ticket is being created. You\'ll see it in '}
              <Text style={{ fontFamily: font('body', 700), fontSize: 12, color: '#64748b' }}>My Tickets</Text>
              {' shortly.'}
            </Text>
          </Centered>
        )}

        {phase === 'failed' && (
          <Centered>
            <ShakeView shakeKey={error} style={{ alignItems: 'center', gap: 8 }}>
              <View style={{
                width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444',
              }}
              >
                <AlertCircle size={36} color="#ffffff" />
              </View>
              <Text style={{
                fontFamily: font('body', 700), marginTop: 14, fontSize: 15, color: tokens.colors.onSurface,
              }}
              >
                Payment failed
              </Text>
              <Text style={{
                fontSize: 12, color: '#64748b', textAlign: 'center', maxWidth: 280,
              }}
              >
                {error}
              </Text>
            </ShakeView>
            <Pressable
              onPress={() => { setPhase('method'); setOtp(''); }}
              style={{
                marginTop: 12, paddingVertical: 8, paddingHorizontal: 18, borderRadius: 8, backgroundColor: tokens.colors.surfaceContainer,
              }}
            >
              <Text style={{ fontFamily: font('body', 600), color: tokens.colors.onSurface }}>Try again</Text>
            </Pressable>
          </Centered>
        )}
      </View>

      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: space[4], borderTopWidth: 1, borderTopColor: tokens.colors.borderLight,
      }}
      >
        <Lock size={12} color="#475569" />
        <Text style={{ fontSize: 11, color: '#475569' }}>256-bit secure connection</Text>
        <Text style={{
          fontSize: 11, color: '#94a3b8', marginLeft: 'auto',
        }}
        >
          {`RBI compliant gateway · ${intent?.gateway || 'MOCK'}`}
        </Text>
      </View>
    </Sheet>
  );
});

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 24, paddingHorizontal: 12,
    }}
    >
      {children}
    </View>
  );
}

function OtpTextBox({
  value, onChange, tokens,
}: { value: string; onChange: (v: string) => void; tokens: ReturnType<typeof useTheme>['tokens'] }) {
  return (
    <TextInput
      value={value}
      onChangeText={(t: string) => onChange(t.replace(/\D/g, '').slice(0, 6))}
      keyboardType="number-pad"
      maxLength={6}
      placeholder="••••"
      placeholderTextColor={tokens.colors.onSurfaceVariant}
      style={{
        marginTop: 8,
        width: '100%',
        paddingVertical: 12,
        paddingHorizontal: 14,
        fontSize: 22,
        letterSpacing: 8,
        textAlign: 'center',
        fontWeight: '700',
        borderWidth: 1,
        borderColor: tokens.colors.borderLight,
        borderRadius: 10,
        backgroundColor: tokens.colors.surfaceContainerLow,
        color: tokens.colors.onSurface,
      }}
    />
  );
}

// A circle that scales in with a spring, then hands off to the shared
// <AnimatedCheckmark> primitive for the self-drawing check — the single
// most satisfying moment in the app, per the porting spec. Reduce Motion
// collapses the circle straight to its final scale (AnimatedCheckmark
// already handles its own reduce-motion case internally).
function SuccessCheck() {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    scale.value = withSpring(1, { damping: 10, stiffness: 180 });
  }, [scale, reduceMotion]);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[circleStyle, {
      width: 64, height: 64, borderRadius: 32, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center',
    }]}
    >
      <AnimatedCheckmark size={40} color="#ffffff" strokeWidth={4} delay={180} />
    </Animated.View>
  );
}
