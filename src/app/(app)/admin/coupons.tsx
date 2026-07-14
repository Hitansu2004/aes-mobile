import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  Plus, Tag, Power, Trash2, Calendar, Hash, Percent, Users, Wallet, CheckCircle2, AlertTriangle,
} from 'lucide-react-native';

import { AppShell } from '@/components/shell/AppShell';
import {
  Text, Button, Skeleton, EmptyState, PressableScale, CountUp, ShakeView,
} from '@/components/primitives';
import { Input, NumberInput, Select } from '@/components/primitives/Input';
import { Sheet, SheetRef } from '@/components/primitives/Sheet';
import { DatePickerSheet, DatePickerSheetRef } from '@/components/ui/DatePickerSheet';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { coupons as couponsApi } from '@/lib/api';
import type { DiscountCoupon } from '@/types/api';

// Ported from ../../aes-frontend/src/app/admin/coupons/page.js +
// coupons.module.css.
const APPLIES = [
  { id: 'TICKET', label: 'Service tickets' },
  { id: 'INSTALL', label: 'New installations' },
  { id: 'BOTH', label: 'Both' },
];

export default function AdminCouponsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const haptics = useHaptics();
  const { tokens } = useTheme();
  const { isPhone } = useBreakpoint();
  const styles = useThemedStyles(makeStyles);

  const [list, setList] = useState<DiscountCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const formSheetRef = useRef<SheetRef>(null);
  const confirmSheetRef = useRef<SheetRef>(null);
  const [deleteTarget, setDeleteTarget] = useState<DiscountCoupon | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/admin/coupons'); return; }
    if (!['ADMIN', 'SERVICE_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
      router.replace(defaultRouteForRole(user.role));
    }
  }, [user, authLoading, router]);

  const reload = useCallback(async (background = false) => {
    try {
      if (background) setRefreshing(true); else setLoading(true);
      const data = await couponsApi.list();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load coupons');
    } finally { setLoading(false); setRefreshing(false); }
  }, [toast]);

  useEffect(() => { reload(); }, [reload]);

  const handleToggle = async (c: DiscountCoupon) => {
    haptics.selection();
    try { await couponsApi.toggle(c.id); reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };

  const requestDelete = (c: DiscountCoupon) => {
    haptics.tapLight();
    setDeleteTarget(c);
    confirmSheetRef.current?.present();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await couponsApi.remove(deleteTarget.id);
      toast.success('Coupon deleted');
      haptics.success();
      confirmSheetRef.current?.dismiss();
      setList((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setDeleteBusy(false);
    }
  };

  if (authLoading || !user) {
    return (
      <AppShell hero={<Text variant="headlineXl">Discount Coupons</Text>}>
        <View style={{ gap: space[3] }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={110} radius={16} />)}
        </View>
      </AppShell>
    );
  }

  const activeCount = list.filter((c) => c.isActive).length;
  const redeemedCount = list.reduce((a, c) => a + (c.timesUsed || 0), 0);

  const hero = (
    <View style={[styles.heroRow, isPhone && styles.heroRowPhone]}>
      <View style={{ gap: space[2], flex: 1, maxWidth: 600 }}>
        <Text variant="headlineXl" color="onSurfaceStrong">Discount Coupons</Text>
        <Text variant="bodyLg" color="onSurfaceVariant">
          Create percent-off codes to hand to customers over the phone — Ops will see them apply at
          checkout for tickets and installations.
        </Text>
      </View>
      <Button
        fullWidth={isPhone}
        leftIcon={<Plus size={15} color={tokens.colors.onSecondary} />}
        onPress={() => formSheetRef.current?.present()}
      >
        New coupon
      </Button>
    </View>
  );

  return (
    <AppShell
      hero={hero}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={tokens.colors.secondary} />}
    >
      {/* Summary tiles */}
      <View style={styles.tiles}>
        <Tile icon={Tag} label="Total" value={list.length} styles={styles} tokens={tokens} index={0} />
        <Tile icon={CheckCircle2} label="Active" value={activeCount} positive styles={styles} tokens={tokens} index={1} />
        <Tile icon={Wallet} label="Redeemed" value={redeemedCount} styles={styles} tokens={tokens} index={2} />
      </View>

      {loading ? (
        <View style={{ gap: space[3] }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={110} radius={16} />)}
        </View>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Tag size={26} color={tokens.colors.secondaryInk} />}
          headline="No coupons yet"
          body="Create your first percent-off code and share it with customers over the phone."
          ctaLabel="Create coupon"
          onCtaPress={() => formSheetRef.current?.present()}
        />
      ) : (
        <View style={{ gap: space[3] }}>
          <AnimatePresence>
            {list.map((c) => (
              <CouponCard
                key={c.id}
                c={c}
                onToggle={() => handleToggle(c)}
                onDelete={() => requestDelete(c)}
                styles={styles}
                tokens={tokens}
              />
            ))}
          </AnimatePresence>
        </View>
      )}

      <NewCouponSheet ref={formSheetRef} onSaved={reload} />

      <Sheet ref={confirmSheetRef} snapPoints={['42%']}>
        <View style={{ padding: space[5], gap: space[4], alignItems: 'center' }}>
          <View style={[styles.confirmIcon, { backgroundColor: tokens.colors.errorContainer }]}>
            <AlertTriangle size={26} color={tokens.colors.error} />
          </View>
          <Text variant="headlineSm" align="center">Delete this coupon?</Text>
          <Text variant="bodyMd" color="onSurfaceVariant" align="center">
            Customers who have used it earlier are not affected.
          </Text>
          <View style={{ width: '100%', gap: space[2] }}>
            <Button variant="danger" size="lg" fullWidth loading={deleteBusy} onPress={confirmDelete}>
              Delete coupon
            </Button>
            <Button variant="ghost" size="lg" fullWidth onPress={() => confirmSheetRef.current?.dismiss()}>
              Cancel
            </Button>
          </View>
        </View>
      </Sheet>
    </AppShell>
  );
}

/* ─── Tiles ──────────────────────────────────────────────── */
function Tile({
  icon: Icon, label, value, positive, styles, tokens, index = 0,
}: {
  icon: typeof Tag; label: string; value: number; positive?: boolean;
  styles: ReturnType<typeof makeStyles>; tokens: ReturnType<typeof useTheme>['tokens']; index?: number;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300, delay: Math.min(index, 10) * 60 }}
      style={[styles.tile, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: positive ? tokens.colors.successLight : tokens.colors.secondarySoft }]}>
        <Icon size={14} color={positive ? tokens.colors.success : tokens.colors.secondaryInk} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <CountUp value={value} style={[styles.tileValue, positive && { color: tokens.colors.success }]} />
    </MotiView>
  );
}

/* ─── Coupon card ───────────────────────────────────────── */
function CouponCard({
  c, onToggle, onDelete, styles, tokens,
}: {
  c: DiscountCoupon; onToggle: () => void; onDelete: () => void;
  styles: ReturnType<typeof makeStyles>; tokens: ReturnType<typeof useTheme>['tokens'];
}) {
  const remaining = c.maxUses === -1 || !c.maxUses ? '∞' : Math.max(0, (c.maxUses || 0) - (c.timesUsed || 0));
  const expiry = c.validUntil
    ? new Date(c.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const isExpired = !!c.validUntil && new Date(c.validUntil) < new Date();
  const isOff = !c.isActive || isExpired;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, scale: 0.94, translateX: -24 }}
      transition={{ type: 'timing', duration: 220 }}
      style={[
        styles.card,
        { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant },
        isOff && { opacity: 0.62 },
      ]}
    >
      <View style={[styles.cardAccent, { backgroundColor: isOff ? tokens.colors.outlineVariant : tokens.colors.secondary }]} />

      <View style={[styles.pctBadge, { backgroundColor: tokens.colors.secondarySoft }]}>
        <Percent size={14} color={tokens.colors.secondaryInk} />
        <Text style={{ fontFamily: font('display', 800), fontSize: 22, lineHeight: 24, color: tokens.colors.secondaryInk }}>
          {c.discountPct}
        </Text>
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <View style={[styles.codePill, { backgroundColor: tokens.colors.onSurfaceStrong }]}>
            <Text style={{ fontFamily: font('mono', 700), fontSize: 13, letterSpacing: 1.04, color: tokens.colors.surfaceContainerLowest }}>
              {c.code}
            </Text>
          </View>
          <View style={[styles.metaChip, { backgroundColor: tokens.colors.surfaceContainerLow }]}>
            <Text style={{ fontFamily: font('mono', 700), fontSize: 9.5, letterSpacing: 0.76, color: tokens.colors.onSurfaceVariant, textTransform: 'uppercase' }}>
              {(c.appliesTo || '').replace('_', ' ')}
            </Text>
          </View>
          {!c.isActive && (
            <View style={[styles.metaChip, { backgroundColor: tokens.colors.warningLight }]}>
              <Text style={{ fontFamily: font('mono', 700), fontSize: 9.5, letterSpacing: 0.76, color: tokens.colors.warning, textTransform: 'uppercase' }}>Paused</Text>
            </View>
          )}
          {isExpired && (
            <View style={[styles.metaChip, { backgroundColor: tokens.colors.errorContainer }]}>
              <Text style={{ fontFamily: font('mono', 700), fontSize: 9.5, letterSpacing: 0.76, color: tokens.colors.error, textTransform: 'uppercase' }}>Expired</Text>
            </View>
          )}
        </View>
        {c.description ? (
          <Text numberOfLines={2} style={{ fontFamily: font('body', 400), fontSize: 13.5, color: tokens.colors.onSurfaceVariant, lineHeight: 19 }}>
            {c.description}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 2 }}>
          <MetaItem icon={Users} text={`${c.timesUsed || 0} used`} tokens={tokens} />
          <MetaItem icon={Hash} text={`${remaining} left`} tokens={tokens} />
          {expiry ? <MetaItem icon={Calendar} text={`Until ${expiry}`} tokens={tokens} /> : null}
          {c.minAmount > 0 ? <MetaItem icon={Wallet} text={`Min ₹${c.minAmount}`} tokens={tokens} /> : null}
        </View>
      </View>

      <View style={{ gap: space[2] }}>
        <ToggleButton active={c.isActive} onPress={onToggle} styles={styles} tokens={tokens} />
        <PressableScale
          scaleTo={0.85}
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel="Delete"
          hitSlop={8}
          style={[styles.iconBtn, { backgroundColor: tokens.colors.surfaceContainerLow, borderColor: tokens.colors.outlineVariant }]}
        >
          <Trash2 size={15} color={tokens.colors.error} />
        </PressableScale>
      </View>
    </MotiView>
  );
}

function MetaItem({ icon: Icon, text, tokens }: { icon: typeof Users; text: string; tokens: ReturnType<typeof useTheme>['tokens'] }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon size={11} color={tokens.colors.onSurfaceVariant} />
      <Text style={{ fontFamily: font('body', 400), fontSize: 11.5, color: tokens.colors.onSurfaceVariant }}>{text}</Text>
    </View>
  );
}

// The toggle springs on press — MOTION beyond the web's plain CSS state.
function ToggleButton({
  active, onPress, styles, tokens,
}: { active: boolean; onPress: () => void; styles: ReturnType<typeof makeStyles>; tokens: ReturnType<typeof useTheme>['tokens'] }) {
  return (
    <PressableScale
      scaleTo={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={active ? 'Deactivate coupon' : 'Activate coupon'}
      hitSlop={8}
      style={[styles.iconBtn, { backgroundColor: tokens.colors.surfaceContainerLow, borderColor: tokens.colors.outlineVariant }]}
    >
      <Power size={15} color={active ? tokens.colors.success : tokens.colors.outline} />
    </PressableScale>
  );
}

/* ─── New coupon sheet ──────────────────────────────────── */
const NewCouponSheet = React.forwardRef<SheetRef, { onSaved: () => void }>(function NewCouponSheet(
  { onSaved },
  ref,
) {
  const toast = useToast();
  const haptics = useHaptics();
  const { tokens } = useTheme();
  const sheetRef = useRef<SheetRef>(null);
  const dateSheetRef = useRef<DatePickerSheetRef>(null);
  const styles = useThemedStyles(makeStyles);

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountPct, setDiscountPct] = useState('10');
  const [maxUses, setMaxUses] = useState('');
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [appliesTo, setAppliesTo] = useState('TICKET');
  const [minAmount, setMinAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorTick, setErrorTick] = useState(0);

  const reset = () => {
    setCode(''); setDescription(''); setDiscountPct('10'); setMaxUses('');
    setValidUntil(null); setAppliesTo('TICKET'); setMinAmount('');
  };

  React.useImperativeHandle(ref, () => ({
    present: () => { reset(); sheetRef.current?.present(); },
    dismiss: () => sheetRef.current?.dismiss(),
  }), []);

  const submit = async () => {
    const pct = Number(discountPct);
    if (!code.trim()) { toast.error('Code is required'); setErrorTick((t) => t + 1); return; }
    if (!(pct >= 1 && pct <= 100)) { toast.error('Discount must be 1–100'); setErrorTick((t) => t + 1); return; }
    setSaving(true);
    try {
      await couponsApi.create({
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        discountPct: pct,
        maxUses: maxUses ? Number(maxUses) : null,
        validUntil: validUntil || null,
        appliesTo,
        minAmount: minAmount ? Number(minAmount) : 0,
      });
      toast.success('Coupon created');
      sheetRef.current?.dismiss();
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create coupon');
      setErrorTick((t) => t + 1);
    } finally {
      setSaving(false);
    }
  };

  const expiryLabel = validUntil
    ? new Date(validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'No expiry';

  return (
    <Sheet ref={sheetRef} title="New discount coupon" snapPoints={['92%']}>
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[10] }}>
      <ShakeView shakeKey={errorTick} style={{ gap: space[4] }}>
        <Input
          label="Code (uppercase, no spaces)"
          value={code}
          onChangeText={(t) => setCode(t.replace(/\s/g, '').toUpperCase())}
          placeholder="e.g. SUMMER15"
          autoCapitalize="characters"
        />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Summer special — 15% off any service"
        />
        <View style={{ flexDirection: 'row', gap: space[3] }}>
          <View style={{ flex: 1 }}>
            <NumberInput label="Discount %" value={discountPct} onChangeText={setDiscountPct} placeholder="10" />
          </View>
          <View style={{ flex: 1 }}>
            <Select
              label="Applies to"
              options={APPLIES.map((a) => ({ label: a.label, value: a.id }))}
              value={appliesTo}
              onChange={setAppliesTo}
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: space[3] }}>
          <View style={{ flex: 1 }}>
            <NumberInput label="Max uses (blank = unlimited)" value={maxUses} onChangeText={setMaxUses} placeholder="e.g. 100" />
          </View>
          <View style={{ flex: 1 }}>
            <NumberInput label="Min order ₹" value={minAmount} onChangeText={setMinAmount} placeholder="0" />
          </View>
        </View>
        <View style={{ gap: space[2] }}>
          <Text style={{ fontFamily: font('mono', 600), fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: tokens.colors.onSurfaceVariant }}>
            Valid until (optional)
          </Text>
          <Pressable
            onPress={() => dateSheetRef.current?.present()}
            style={{
              height: 52, paddingHorizontal: space[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: tokens.colors.surfaceContainerLow, borderRadius: radius.sm,
            }}
          >
            <Text variant="bodyLg" color={validUntil ? 'onSurface' : 'onSurfaceVariant'} style={{ fontSize: 15 }}>{expiryLabel}</Text>
            <Calendar size={16} color={tokens.colors.onSurfaceVariant} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[2] }}>
          <View style={{ flex: 1 }}>
            <Button variant="outline" fullWidth disabled={saving} onPress={() => sheetRef.current?.dismiss()}>
              Cancel
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button fullWidth loading={saving} onPress={submit}>
              Create coupon
            </Button>
          </View>
        </View>
      </ShakeView>
      </BottomSheetScrollView>

      <DatePickerSheet ref={dateSheetRef} value={validUntil} onChange={setValidUntil} />
    </Sheet>
  );
});

/* ─── Styles ────────────────────────────────────────────── */
function makeStyles(tokens: ReturnType<typeof useTheme>['tokens']) {
  return {
    heroRow: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, justifyContent: 'space-between' as const, gap: space[6], flexWrap: 'wrap' as const },
    heroRowPhone: { flexDirection: 'column' as const, alignItems: 'stretch' as const },

    tiles: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space[3], marginBottom: space[6] },
    tile: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, padding: space[4], borderRadius: radius.lg, borderWidth: 1, flexBasis: '30%' as const, flexGrow: 1, minWidth: 150, ...shadow('card'),
    },
    tileIcon: { width: 30, height: 30, borderRadius: radius.full, alignItems: 'center' as const, justifyContent: 'center' as const },
    tileLabel: { fontFamily: font('mono', 400), fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: 1, color: tokens.colors.onSurfaceVariant },
    tileValue: { marginLeft: 'auto' as const, fontFamily: font('display', 700), fontSize: 22, color: tokens.colors.onSurface },

    card: {
      flexDirection: 'row' as const, gap: space[4], padding: space[5], paddingLeft: space[7], borderRadius: radius.lg, borderWidth: 1, alignItems: 'flex-start' as const, overflow: 'hidden' as const, ...shadow('card'),
    },
    cardAccent: { position: 'absolute' as const, top: 0, bottom: 0, left: 0, width: 4 },
    pctBadge: {
      alignItems: 'center' as const, justifyContent: 'center' as const, minWidth: 60, paddingVertical: 10, paddingHorizontal: 6, borderRadius: radius.sm,
    },
    codePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
    metaChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
    iconBtn: {
      width: 32, height: 32, borderRadius: radius.md, borderWidth: 1, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    confirmIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center' as const, justifyContent: 'center' as const },
  };
}
