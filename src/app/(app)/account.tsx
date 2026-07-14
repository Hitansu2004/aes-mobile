import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  Linking, Platform, RefreshControl, View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import {
  User, Home, ClipboardCheck, LogOut, Trash2, Moon, Sun, Monitor, Bell,
  RefreshCw, Shield, FileText, ChevronRight, Snowflake, Star,
} from 'lucide-react-native';

import { AppShell } from '@/components/shell/AppShell';
import { Splash } from '@/components/shell/Splash';
import { Text } from '@/components/primitives/Text';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { Badge } from '@/components/primitives/Badge';
import { Divider } from '@/components/primitives/Divider';
import { PressableScale } from '@/components/primitives/PressableScale';
import {
  AddPropertySheet, AddAcUnitSheet, ConfirmSheet, AccountSheetRef, AddAcUnitSheetHandle,
} from '@/components/account/AccountSheets';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useHaptics } from '@/hooks/useHaptics';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  user as userApi, properties as propertiesApi, acUnits as acUnitsApi, amc as amcApi,
  amcUpgrades as amcUpgradesApi, appMeta,
} from '@/lib/api';
import { getItem, setItem } from '@/lib/storage';
import { getRegisteredDeviceToken, setRegisteredDeviceToken } from '@/hooks/usePushRegistration';
import { PUSH_PREF_KEY, registerForPushNotifications, unregisterPushToken } from '@/lib/push';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL, SUPPORT_EMAIL } from '@/lib/constants';
import type { AcUnit, AmcContract, Property } from '@/types/api';

// Ported from ../../aes-frontend/src/app/account/page.js +
// account.module.css. Mobile-only additions (Preferences card, push toggle,
// app version/update check, legal links, delete-account row, confirm sheets
// around Sign Out / Delete) are called out inline — see CLAUDE.md Phase 14.

type TabKey = 'profile' | 'properties' | 'amc';

const TABS: { key: TabKey; label: string; Icon: typeof User }[] = [
  { key: 'profile', label: 'Profile', Icon: User },
  { key: 'properties', label: 'Properties', Icon: Home },
  { key: 'amc', label: 'AMC', Icon: ClipboardCheck },
];

function initials(name: string | undefined): string {
  return (name || 'U').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'U';
}

const APP_VERSION = Application.nativeApplicationVersion || Constants.expoConfig?.version || '0.0.0';

export default function AccountScreen() {
  const search = useLocalSearchParams<{ tab?: string }>();
  const { user, logout } = useAuth();
  const { tokens, theme, setTheme } = useTheme();
  const { isPhone } = useBreakpoint();
  const haptics = useHaptics();
  const toast = useToast();
  const styles = useThemedStyles(makeStyles);

  const [tab, setTab] = useState<TabKey>('profile');
  const [propList, setPropList] = useState<Property[]>([]);
  const [contracts, setContracts] = useState<AmcContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const [propSaving, setPropSaving] = useState(false);
  const [acSaving, setAcSaving] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const addPropertyRef = useRef<AccountSheetRef>(null);
  const addAcUnitRef = useRef<AddAcUnitSheetHandle>(null);
  const logoutConfirmRef = useRef<AccountSheetRef>(null);
  const deleteConfirmRef = useRef<AccountSheetRef>(null);

  useEffect(() => {
    const t = search.tab;
    if (t === 'profile' || t === 'properties' || t === 'amc') setTab(t);
  }, [search.tab]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const load = useCallback(async () => {
    const [props, amcData] = await Promise.allSettled([propertiesApi.list(), amcApi.myContracts()]);
    if (props.status === 'fulfilled') setPropList(Array.isArray(props.value) ? props.value : []);
    if (amcData.status === 'fulfilled') setContracts(Array.isArray(amcData.value) ? amcData.value : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [load]);

  // Restore push-toggle state — a granted OS permission plus a previously
  // persisted "on" preference means we re-register (the Expo push token can
  // rotate between app installs).
  useEffect(() => {
    (async () => {
      const pref = await getItem(PUSH_PREF_KEY);
      if (pref !== '1') return;
      const perm = await Notifications.getPermissionsAsync();
      if (perm.status === 'granted') {
        setPushEnabled(true);
      } else {
        await setItem(PUSH_PREF_KEY, '0');
      }
    })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await userApi.updateMe({ name, email });
      setEditing(false);
      toast.success('Profile saved.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save profile.');
    }
    setSaving(false);
  };

  const handleAddProperty = async (data: Parameters<typeof propertiesApi.create>[0]) => {
    setPropSaving(true);
    try {
      await propertiesApi.create(data);
      toast.success('Property added.');
      addPropertyRef.current?.dismiss();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add property.');
    } finally {
      setPropSaving(false);
    }
  };

  const [acTarget, setAcTarget] = useState<Property | null>(null);
  const handleAddAcUnit = async (data: Parameters<typeof acUnitsApi.create>[1]) => {
    if (!acTarget) return;
    setAcSaving(true);
    try {
      await acUnitsApi.create(acTarget.id, data);
      toast.success(`AC added to ${acTarget.label}.`);
      addAcUnitRef.current?.dismiss();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add AC unit.');
    } finally {
      setAcSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    logoutConfirmRef.current?.dismiss();
  };

  const handleDeleteAccount = () => {
    deleteConfirmRef.current?.dismiss();
    Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Delete my account')}&body=${encodeURIComponent(
        `Please delete my Arial Engineering account.\n\nName: ${user?.name || ''}\nPhone: ${user?.phoneNumber || ''}\nEmail: ${user?.email || ''}`,
      )}`,
    ).catch(() => toast.error('Could not open your mail app.'));
  };

  const handleTogglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    haptics.selection();
    try {
      if (pushEnabled) {
        const existing = getRegisteredDeviceToken();
        if (existing) await unregisterPushToken(existing);
        setRegisteredDeviceToken(null);
        setPushEnabled(false);
        toast.info('Push notifications turned off.');
        return;
      }

      const token = await registerForPushNotifications(APP_VERSION);
      if (!token) {
        toast.warning('Notification permission was denied — enable it in system settings.');
        return;
      }
      setRegisteredDeviceToken(token);
      setPushEnabled(true);
      toast.success('Push notifications turned on.');
    } catch {
      toast.error('Could not update push notification settings.');
    } finally {
      setPushBusy(false);
    }
  };

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const config = await appMeta.config(Platform.OS === 'ios' ? 'ios' : 'android', APP_VERSION);
      if (config.updateRequired) {
        toast.warning('A required update is available — please update to continue.');
      } else if (config.updateAvailable) {
        toast.info(`Version ${config.latestVersion} is available.`);
      } else {
        toast.success("You're on the latest version.");
      }
    } catch {
      toast.error('Could not check for updates.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  if (loading) return <Splash message="Loading your account…" />;

  const hero = (
    <View style={[styles.heroRow, isPhone && styles.heroRowPhone]}>
      <View style={[styles.heroAvatar, { backgroundColor: tokens.colors.primary }, shadow('cta')]}>
        <Text style={{ fontFamily: font('display', 700), fontSize: 26, color: '#ffffff' }}>{initials(user?.name)}</Text>
      </View>
      <View style={[styles.heroText, isPhone && { alignItems: 'center' }]}>
        <Text variant="headlineXl" color="onSurfaceStrong">{user?.name || 'Your Account'}</Text>
        <View style={[styles.heroSubRow, isPhone && { justifyContent: 'center' }]}>
          <Text variant="bodyMd" color="onSurfaceVariant">{user?.phoneNumber || user?.email}</Text>
          {user?.role ? (
            <View style={[styles.rolePill, { backgroundColor: tokens.colors.secondarySoft }]}>
              <Text style={{
                fontFamily: font('mono', 600), fontSize: 10, letterSpacing: 0.1, textTransform: 'uppercase',
              }}
              color="secondaryInk"
              >
                {user.role.replace(/_/g, ' ')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <PressableScale
        style={[styles.heroSignOut, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }, isPhone && styles.heroSignOutPhone]}
        haptic
        onPress={() => logoutConfirmRef.current?.present()}
      >
        <LogOut size={14} color={tokens.colors.onSurfaceStrong} />
        <Text style={{ fontFamily: font('body', 600), fontSize: 13 }} color="onSurfaceStrong">Sign Out</Text>
      </PressableScale>
    </View>
  );

  return (
    <AppShell
      hero={hero}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.secondary} />}
    >
      <View style={[styles.tabs, { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant }, shadow('card')]}>
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <PressableScale
              key={key}
              style={[styles.tab, active && { backgroundColor: tokens.colors.secondary }]}
              onPress={() => setTab(key)}
            >
              {/* account.module.css's .tabActive on the web reads
                  `background: var(--aes-primary)` — a leftover pre-Rose-redesign
                  token name whose value is gold (#C9A84C), not the Rose
                  redesign's `--primary` (navy) tokens.ts is otherwise built
                  from. The actual rendered web pixel is gold fill + navy
                  text, so this matches that ground truth rather than the
                  "primary" name. */}
              <Icon size={15} color={active ? tokens.colors.onSecondary : tokens.colors.onSurfaceVariant} />
              <Text style={{ fontFamily: font('body', 500), fontSize: 13 }} color={active ? 'onSecondary' : 'onSurfaceVariant'}>
                {label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {tab === 'profile' && (
        <ProfileTab
          styles={styles}
          tokens={tokens}
          editing={editing}
          setEditing={setEditing}
          name={name}
          setName={setName}
          email={email}
          setEmail={setEmail}
          saving={saving}
          onSave={handleSaveProfile}
          phoneNumber={user?.phoneNumber}
          role={user?.role}
          theme={theme}
          setTheme={setTheme}
          pushEnabled={pushEnabled}
          pushBusy={pushBusy}
          onTogglePush={handleTogglePush}
          checkingUpdate={checkingUpdate}
          onCheckForUpdates={handleCheckForUpdates}
          onOpenLogout={() => logoutConfirmRef.current?.present()}
          onOpenDelete={() => deleteConfirmRef.current?.present()}
        />
      )}

      {tab === 'properties' && (
        <PropertiesTab
          styles={styles}
          tokens={tokens}
          isPhone={isPhone}
          properties={propList}
          onAddProperty={() => addPropertyRef.current?.present()}
          onAddAcUnit={(p) => { setAcTarget(p); addAcUnitRef.current?.presentFor(p); }}
          onUpgrade={async (property, acUnit) => {
            await amcUpgradesApi.create({
              propertyId: property.id,
              acUnitId: acUnit.id,
              preferredPlan: 'PREMIUM',
              notes: `Customer requested AMC upgrade for ${acUnit.roomLabel} (${acUnit.brand} ${acUnit.modelNumber || ''})`,
            });
          }}
        />
      )}

      {tab === 'amc' && <AmcTab styles={styles} tokens={tokens} contracts={contracts} />}

      <AddPropertySheet
        ref={addPropertyRef}
        saving={propSaving}
        onWarn={(msg) => toast.warning(msg)}
        onSubmit={handleAddProperty}
      />
      <AddAcUnitSheet
        ref={addAcUnitRef}
        saving={acSaving}
        onWarn={(msg) => toast.warning(msg)}
        onSubmit={handleAddAcUnit}
      />
      <ConfirmSheet
        ref={logoutConfirmRef}
        title="Sign out?"
        body="You'll need to sign in again to access your tickets, projects and AMC contracts."
        confirmLabel="Sign Out"
        onConfirm={handleLogout}
      />
      <ConfirmSheet
        ref={deleteConfirmRef}
        title="Delete your account?"
        body="This opens a pre-filled email to our support team — we don't yet delete accounts automatically. They'll confirm and complete the deletion for you."
        confirmLabel="Email support to delete my account"
        onConfirm={handleDeleteAccount}
      />
    </AppShell>
  );
}

type Styles = ReturnType<typeof makeStyles>;
type Tokens = ReturnType<typeof useTheme>['tokens'];

// ─── Profile tab ─────────────────────────────────────────────────────────

function ProfileTab({
  styles, tokens, editing, setEditing, name, setName, email, setEmail, saving, onSave,
  phoneNumber, role, theme, setTheme, pushEnabled, pushBusy, onTogglePush,
  checkingUpdate, onCheckForUpdates, onOpenLogout, onOpenDelete,
}: {
  styles: Styles; tokens: Tokens; editing: boolean; setEditing: (v: boolean) => void;
  name: string; setName: (v: string) => void; email: string; setEmail: (v: string) => void;
  saving: boolean; onSave: () => void; phoneNumber?: string; role?: string;
  theme: 'light' | 'dark' | 'system'; setTheme: (t: 'light' | 'dark' | 'system') => void;
  pushEnabled: boolean; pushBusy: boolean; onTogglePush: () => void;
  checkingUpdate: boolean; onCheckForUpdates: () => void;
  onOpenLogout: () => void; onOpenDelete: () => void;
}) {
  return (
    <View style={styles.tabContent}>
      <Card>
        <View style={styles.cardHeader}>
          <Text variant="headlineSm" color="onSurfaceStrong">Personal Information</Text>
          {!editing && <Button variant="ghost" size="sm" onPress={() => setEditing(true)}>Edit ✎</Button>}
        </View>
        {editing ? (
          <View style={{ gap: space[4] }}>
            <Input label="Full Name" value={name} onChangeText={setName} />
            <Input label="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
            <View style={styles.formActions}>
              <Button variant="ghost" onPress={() => setEditing(false)}>Cancel</Button>
              <Button variant="primary" loading={saving} onPress={onSave}>Save Changes</Button>
            </View>
          </View>
        ) : (
          <View style={{ gap: space[4] }}>
            <InfoRow label="Name" value={name || '—'} />
            <InfoRow label="Phone" value={phoneNumber || '—'} />
            <InfoRow label="Email" value={email || '—'} />
            <InfoRow label="Role" value={role ? role.replace(/_/g, ' ') : '—'} />
          </View>
        )}
      </Card>

      <Card>
        <Text variant="headlineSm" color="onSurfaceStrong" style={{ marginBottom: space[4] }}>Preferences</Text>

        <Text style={styles.prefLabel} color="onSurfaceVariant">Appearance</Text>
        <View style={[styles.themeRow, { backgroundColor: tokens.colors.surfaceContainerLow }]}>
          {([
            { key: 'light', label: 'Light', Icon: Sun },
            { key: 'dark', label: 'Dark', Icon: Moon },
            { key: 'system', label: 'System', Icon: Monitor },
          ] as const).map(({ key, label, Icon }) => {
            const active = theme === key;
            return (
              <PressableScale
                key={key}
                style={[styles.themeChip, active && { backgroundColor: tokens.colors.secondary }]}
                onPress={() => setTheme(key)}
              >
                <Icon size={14} color={active ? tokens.colors.onSecondary : tokens.colors.onSurfaceVariant} />
                <Text style={{ fontFamily: font('body', 600), fontSize: 12.5 }} color={active ? 'onSecondary' : 'onSurfaceVariant'}>
                  {label}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        <Divider />

        <SwitchRow
          tokens={tokens}
          icon={<Bell size={16} color={tokens.colors.secondaryInk} />}
          label="Push notifications"
          description="Get notified about ticket updates, escalations and reminders."
          value={pushEnabled}
          busy={pushBusy}
          onToggle={onTogglePush}
        />
      </Card>

      <Card>
        <Text variant="headlineSm" color="onSurfaceStrong" style={{ marginBottom: space[3] }}>About</Text>
        <InfoRow label="App version" value={Application.nativeApplicationVersion || Constants.expoConfig?.version || '—'} />
        <PressableScale style={styles.linkRow} onPress={onCheckForUpdates} disabled={checkingUpdate}>
          <View style={styles.linkRowLeft}>
            <RefreshCw size={16} color={tokens.colors.onSurfaceVariant} />
            <Text variant="bodyMd">{checkingUpdate ? 'Checking…' : 'Check for updates'}</Text>
          </View>
          <ChevronRight size={16} color={tokens.colors.onSurfaceVariant} />
        </PressableScale>
      </Card>

      <Card>
        <PressableScale style={styles.linkRow} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
          <View style={styles.linkRowLeft}>
            <Shield size={16} color={tokens.colors.onSurfaceVariant} />
            <Text variant="bodyMd">Privacy Policy</Text>
          </View>
          <ChevronRight size={16} color={tokens.colors.onSurfaceVariant} />
        </PressableScale>
        <Divider spacing={space[3]} />
        <PressableScale style={styles.linkRow} onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}>
          <View style={styles.linkRowLeft}>
            <FileText size={16} color={tokens.colors.onSurfaceVariant} />
            <Text variant="bodyMd">Terms of Service</Text>
          </View>
          <ChevronRight size={16} color={tokens.colors.onSurfaceVariant} />
        </PressableScale>
      </Card>

      <Card>
        <PressableScale style={styles.linkRow} onPress={onOpenDelete}>
          <View style={styles.linkRowLeft}>
            <Trash2 size={16} color={tokens.colors.error} />
            <Text variant="bodyMd" color="error">Delete my account</Text>
          </View>
          <ChevronRight size={16} color={tokens.colors.error} />
        </PressableScale>
      </Card>

      <Button variant="outline" fullWidth onPress={onOpenLogout}>Sign Out</Button>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{
        fontFamily: font('body', 700), fontSize: 11, letterSpacing: 0.06 * 11, textTransform: 'uppercase',
      }}
      color="onSurfaceVariant"
      >
        {label}
      </Text>
      <Text variant="bodyLg" color="onSurfaceStrong" style={{ marginTop: 4, fontFamily: font('body', 600) }}>{value}</Text>
    </View>
  );
}

function SwitchRow({
  tokens, icon, label, description, value, busy, onToggle,
}: {
  tokens: Tokens; icon: React.ReactNode; label: string; description: string; value: boolean; busy: boolean; onToggle: () => void;
}) {
  const knobX = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    knobX.value = withSpring(value ? 1 : 0, { damping: 16, stiffness: 220 });
  }, [value, knobX]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: knobX.value > 0.5 ? tokens.colors.secondary : tokens.colors.outlineVariant,
  }));
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: knobX.value * 20 }] }));

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: space[3], paddingTop: space[3],
    }}
    >
      <View style={{
        width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.secondarySoft,
      }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyMd" style={{ fontFamily: font('body', 600) }}>{label}</Text>
        <Text variant="bodySm" color="onSurfaceVariant" style={{ marginTop: 2 }}>{description}</Text>
      </View>
      <PressableScale onPress={onToggle} disabled={busy} accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value, disabled: busy }}>
        <Animated.View
          style={[{
            width: 48, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center',
          }, trackStyle, { opacity: busy ? 0.6 : 1 }]}
        >
          <Animated.View style={[{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#ffffff' }, knobStyle]} />
        </Animated.View>
      </PressableScale>
    </View>
  );
}

// ─── Properties tab ──────────────────────────────────────────────────────

function PropertiesTab({
  styles, tokens, isPhone, properties, onAddProperty, onAddAcUnit, onUpgrade,
}: {
  styles: Styles; tokens: Tokens; isPhone: boolean; properties: Property[];
  onAddProperty: () => void; onAddAcUnit: (p: Property) => void;
  onUpgrade: (property: Property, acUnit: AcUnit) => Promise<void>;
}) {
  if (properties.length === 0) {
    return (
      <View style={styles.tabContent}>
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300 }}
          style={[styles.empty, { borderColor: tokens.colors.outlineVariant }]}
        >
          <View style={[styles.emptyIcon, { backgroundColor: tokens.colors.secondarySoft }]}>
            <Home size={26} color={tokens.colors.secondaryInk} />
          </View>
          <Text variant="headlineSm" align="center">No properties yet</Text>
          <Text variant="bodyMd" color="onSurfaceVariant" align="center" style={{ maxWidth: 420 }}>
            Add a property and at least one AC unit before raising a service ticket.
          </Text>
          <View style={{ marginTop: space[4] }}>
            <Button variant="primary" onPress={onAddProperty}>＋ Add New Property</Button>
          </View>
        </MotiView>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {properties.map((prop, i) => {
        const units = prop.acUnits || [];
        return (
          <MotiView
            key={prop.id}
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 220, delay: i < 10 ? i * 40 : 0 }}
          >
            <Card>
              <View style={styles.propertyHead}>
                <View style={[styles.propIcon, { backgroundColor: tokens.colors.surfaceContainer }]}>
                  <Home size={22} color={tokens.colors.onSurfaceVariant} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="headlineSm" color="onSurfaceStrong">{prop.label}</Text>
                  <Text variant="bodySm" color="onSurfaceVariant" style={{ marginTop: 2 }} numberOfLines={1}>
                    {prop.addressLine1}{prop.city ? `, ${prop.city}` : ''}{prop.pincode ? ` · ${prop.pincode}` : ''}
                  </Text>
                  <View style={{
                    flexDirection: 'row', gap: 6, marginTop: 6,
                  }}
                  >
                    <View style={[styles.propTag, { backgroundColor: tokens.colors.surfaceContainer }]}>
                      <Text style={{ fontFamily: font('body', 700), fontSize: 11 }} color="onSurfaceVariant">
                        {prop.propertyType || 'RESIDENTIAL'}
                      </Text>
                    </View>
                    <View style={[styles.propTag, { backgroundColor: tokens.colors.surfaceContainer }]}>
                      <Text style={{ fontFamily: font('body', 700), fontSize: 11 }} color="onSurfaceVariant">
                        {units.length} AC unit{units.length === 1 ? '' : 's'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {units.length > 0 && (
                <View style={{ gap: space[2], marginTop: space[3] }}>
                  {units.map((u) => (
                    <AcUnitRow key={u.id} unit={u} tokens={tokens} onUpgrade={() => onUpgrade(prop, u)} />
                  ))}
                </View>
              )}

              <View style={{ marginTop: space[3], alignSelf: 'flex-start' }}>
                <Button variant="outline" size="sm" onPress={() => onAddAcUnit(prop)}>
                  ＋ Add AC unit
                </Button>
              </View>
            </Card>
          </MotiView>
        );
      })}

      <Button variant="outline" fullWidth onPress={onAddProperty}>＋ Add New Property</Button>
    </View>
  );
}

const AcUnitRow = React.memo(function AcUnitRow({
  unit, tokens, onUpgrade,
}: { unit: AcUnit; tokens: Tokens; onUpgrade: () => Promise<void> }) {
  const toast = useToast();
  const [requesting, setRequesting] = useState(false);

  const badge = unit.warrantyBadge || 'No Warranty';
  const daysLeft = unit.warrantyDaysLeft;
  const isExpired = badge === 'Expired';

  let detail = 'No warranty info on file';
  if (unit.warrantyExpiry) {
    const dateStr = new Date(unit.warrantyExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    if (typeof daysLeft === 'number' && daysLeft >= 0) detail = `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} · ${dateStr}`;
    else if (typeof daysLeft === 'number') detail = `Expired ${Math.abs(daysLeft)} day${daysLeft === -1 ? '' : 's'} ago · ${dateStr}`;
  }

  const tone = badge === 'In Warranty'
    ? { bg: tokens.colors.successLight, fg: tokens.colors.success }
    : badge === 'Expiring soon'
      ? { bg: tokens.colors.warningLight, fg: tokens.colors.warning }
      : isExpired
        ? { bg: tokens.colors.errorContainer, fg: tokens.colors.error }
        : { bg: tokens.colors.surfaceContainer, fg: tokens.colors.onSurfaceVariant };

  // `amcContractId` isn't in the AcUnit interface (types/api.ts) but the
  // backend response includes it — ported verbatim from the web's same
  // untyped check (account/page.js AcUnitRow).
  const amcContractId = (unit as unknown as { amcContractId?: string }).amcContractId;
  const showUpgrade = isExpired || (!unit.warrantyExpiry && !amcContractId);

  const handleUpgrade = async () => {
    setRequesting(true);
    try {
      await onUpgrade();
      toast.success("AMC upgrade request sent — we'll call you within 4 working hours.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send upgrade request');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <View style={{
      padding: space[3], backgroundColor: tokens.colors.surfaceContainerLow, borderRadius: radius.sm + 2, borderWidth: 1, borderColor: tokens.colors.borderLight, gap: space[2],
    }}
    >
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}
      >
        <Snowflake size={14} color={tokens.colors.onSurfaceVariant} />
        <Text style={{ fontFamily: font('body', 700), fontSize: 14 }}>{unit.roomLabel}</Text>
        <Text variant="bodySm" color="onSurfaceVariant">
          · {unit.brand} {unit.modelNumber || ''} · {unit.tonnage || '?'}T · {unit.acType?.replace('_', '/')}
        </Text>
        <View style={{
          marginLeft: 'auto', paddingVertical: 3, paddingHorizontal: 9, borderRadius: radius.full, backgroundColor: tone.bg,
        }}
        >
          <Text
            style={{
              fontFamily: font('body', 700), fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase', color: tone.fg,
            }}
          >
            {badge}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Text variant="bodySm" color="onSurfaceVariant">{detail}</Text>
        {unit.purchasedFromAes ? <Text variant="bodySm" color="onSurfaceVariant" style={{ fontStyle: 'italic' }}>· AES installed</Text> : null}
      </View>
      {showUpgrade ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button variant="soft" size="sm" leftIcon={<Star size={13} color={tokens.colors.primary} />} loading={requesting} onPress={handleUpgrade}>
            Upgrade to AMC
          </Button>
        </View>
      ) : null}
    </View>
  );
});

// ─── AMC tab ──────────────────────────────────────────────────────────

function AmcTab({
  styles, tokens, contracts,
}: { styles: Styles; tokens: Tokens; contracts: AmcContract[] }) {
  if (contracts.length === 0) {
    return (
      <View style={styles.tabContent}>
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300 }}
          style={[styles.empty, { borderColor: tokens.colors.outlineVariant }]}
        >
          <View style={[styles.emptyIcon, { backgroundColor: tokens.colors.secondarySoft }]}>
            <ClipboardCheck size={26} color={tokens.colors.secondaryInk} />
          </View>
          <Text variant="headlineSm" align="center">No AMC Contracts</Text>
          <Text variant="bodyMd" color="onSurfaceVariant" align="center" style={{ maxWidth: 420 }}>
            You don&apos;t have any active Annual Maintenance Contracts.
          </Text>
        </MotiView>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {contracts.map((c, i) => (
        <MotiView
          key={c.id}
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 220, delay: i < 10 ? i * 40 : 0 }}
        >
          <Card>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: space[3], marginBottom: space[3],
            }}
            >
              <Badge tone={c.isActive ? 'resolved' : 'paid'}>{c.isActive ? 'ACTIVE' : 'EXPIRED'}</Badge>
              <Text variant="bodySm" color="onSurfaceVariant" style={{ fontFamily: font('mono', 500) }}>{c.contractNumber}</Text>
            </View>
            <Text variant="headlineSm" color="onSurfaceStrong" style={{ marginBottom: space[2] }}>Annual Maintenance Contract</Text>
            <Text variant="bodySm" color="onSurfaceVariant">Coverage: {c.startDate} → {c.endDate}</Text>
            <Text variant="bodySm" color="onSurfaceVariant">Visits: {c.visitsCompleted || 0}/{c.visitsPerYear || 4} completed</Text>
          </Card>
        </MotiView>
      ))}
    </View>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  heroRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[5],
    flexWrap: 'wrap' as const,
  },
  heroRowPhone: {
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
  },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  heroText: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  heroSubRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    flexWrap: 'wrap' as const,
  },
  rolePill: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  heroSignOut: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  heroSignOutPhone: {
    width: '100%' as const,
    justifyContent: 'center' as const,
  },

  tabs: {
    flexDirection: 'row' as const,
    gap: 8,
    padding: 8,
    borderWidth: 1,
    borderRadius: radius.full,
    marginBottom: space[6],
    alignSelf: 'flex-start' as const,
  },
  tab: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.full,
  },

  tabContent: {
    gap: space[4],
  },

  cardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: space[5],
  },
  formActions: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    gap: space[3],
    marginTop: space[2],
  },

  prefLabel: {
    fontFamily: font('body', 700),
    fontSize: 11,
    letterSpacing: 0.06 * 11,
    textTransform: 'uppercase' as const,
    marginBottom: space[2],
  },
  themeRow: {
    flexDirection: 'row' as const,
    gap: 6,
    padding: 6,
    borderRadius: radius.full,
    marginBottom: space[4],
  },
  themeChip: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.full,
  },

  linkRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: space[3],
  },
  linkRowLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },

  propertyHead: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: space[4],
  },
  propIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  propTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
  },

  empty: {
    alignItems: 'center' as const,
    gap: space[3],
    paddingVertical: space[10],
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
});
