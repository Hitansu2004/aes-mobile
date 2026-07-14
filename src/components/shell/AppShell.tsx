import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler, KeyboardAvoidingView, Platform, RefreshControlProps, ScrollView, StyleProp, StyleSheet, View, ViewStyle,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useAuth } from '@/context/AuthContext';
import { Text } from '@/components/primitives/Text';
import { NAV, buildBreadcrumbs, initialsForName } from './nav';
import { Sidebar } from './Sidebar';
import { Drawer } from './Drawer';
import { GlassTopBar } from './GlassTopBar';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';

// Ported from ../../aes-frontend/src/components/rose/RoseShell.js — the
// three-breakpoint app chrome every authenticated screen renders inside.
// See CLAUDE.md / the Phase 5 build prompt for the full breakdown.
export interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  hero?: React.ReactNode;
  bare?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  showSearch?: boolean;
  hideBottomNav?: boolean;
  focused?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /** Skip AppShell's own ScrollView and render a plain flex View instead —
   * for screens whose content is a FlashList (FlashList needs a bounded/flex
   * parent, not a scrolling one, or virtualization + pull-to-refresh break).
   * The screen is responsible for its own vertical scrolling/padding in
   * this mode; use FlashList's ListHeaderComponent for the hero. */
  disableScroll?: boolean;
}

const FOOTER_LINKS = ['Privacy Policy', 'Terms of Service', 'Compliance', 'Contact'];

export function AppShell({
  children,
  title,
  subtitle,
  hero,
  bare = false,
  contentStyle,
  showSearch = true,
  hideBottomNav = false,
  focused = false,
  refreshControl,
  disableScroll = false,
}: AppShellProps) {
  const { tokens } = useTheme();
  const { bp, isPhone, width, sidebarWidth, pagePad, contentMaxWidth } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const role = user?.role || 'CUSTOMER';
  const nav = NAV[role];
  const initials = useMemo(() => initialsForName(user?.name), [user?.name]);

  const breadcrumbs = useMemo(() => buildBreadcrumbs(pathname), [pathname]);
  const isSubPage = breadcrumbs.length > 1;
  const parentCrumb = isSubPage ? breadcrumbs[breadcrumbs.length - 2] : null;
  const currentLabel = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].label : '';

  // Navigate to the logical parent derived from the breadcrumb trail —
  // deterministic, not history-dependent. Ported verbatim from RoseShell.js.
  const goBack = useCallback(() => {
    if (parentCrumb) router.push(parentCrumb.href);
  }, [parentCrumb, router]);

  // Android hardware back must agree with the on-screen back arrow, or a
  // sub-page drops the user straight out of the app.
  useEffect(() => {
    if (Platform.OS !== 'android' || focused) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSubPage) {
        goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [focused, isSubPage, goBack]);

  const navigate = useCallback(
    (href: string) => {
      setDrawerOpen(false);
      router.push(href);
    },
    [router],
  );

  const handleLogout = useCallback(async () => {
    setDrawerOpen(false);
    await logout();
  }, [logout]);

  const showFooter = !isPhone && !focused;
  const effectiveHideBottomNav = hideBottomNav || focused || !isPhone;

  // Content is centred and capped at contentMaxWidth on every tier (480
  // phone / 760 tablet / 980 large) — otherwise a 1024px-wide line of body
  // text renders edge-to-edge and becomes unreadable on tablet/large.
  const capStyle: ViewStyle = { width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' };

  const mainContent = (
    <>
      {!bare && (title || subtitle || hero) && (
        <View style={[styles.hero, { maxWidth: Math.min(760, contentMaxWidth) }]}>
          {hero ?? (
            <>
              {title && <Text variant="headlineXl" color="onSurfaceStrong">{title}</Text>}
              {subtitle && (
                <Text variant="bodyLg" color="onSurfaceVariant" style={styles.subtitle}>
                  {subtitle}
                </Text>
              )}
            </>
          )}
        </View>
      )}
      {children}
    </>
  );

  if (focused) {
    return (
      <View style={[styles.root, { backgroundColor: tokens.colors.surface }]}>
        {disableScroll ? (
          <View
            style={[
              { flex: 1, paddingHorizontal: pagePad, paddingTop: insets.top, paddingBottom: insets.bottom },
              capStyle,
              contentStyle,
            ]}
          >
            {mainContent}
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.main,
              { paddingHorizontal: pagePad, paddingTop: insets.top, paddingBottom: insets.bottom + space[6] },
              contentStyle,
            ]}
            refreshControl={refreshControl}
          >
            <View style={capStyle}>{mainContent}</View>
          </ScrollView>
        )}
      </View>
    );
  }

  if (isPhone) {
    return (
      <View style={[styles.root, { backgroundColor: tokens.colors.surface }]}>
        <GlassTopBar
          isSubPage={isSubPage}
          parentLabel={parentCrumb?.label}
          currentLabel={currentLabel}
          initials={initials}
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen((o) => !o)}
          onGoBack={goBack}
          onBrandPress={() => navigate('/dashboard')}
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={60 + insets.top}
        >
          {disableScroll ? (
            <View
              style={[
                {
                  flex: 1,
                  paddingHorizontal: pagePad,
                  paddingTop: space[4],
                  paddingBottom: effectiveHideBottomNav ? 0 : 96,
                },
                capStyle,
                contentStyle,
              ]}
            >
              {mainContent}
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[
                styles.main,
                {
                  paddingHorizontal: pagePad,
                  paddingTop: space[4],
                  paddingBottom: effectiveHideBottomNav ? space[6] + insets.bottom : 96 + insets.bottom,
                },
                contentStyle,
              ]}
              refreshControl={refreshControl}
              keyboardShouldPersistTaps="handled"
            >
              <View style={capStyle}>{mainContent}</View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>

        {!effectiveHideBottomNav && (
          <BottomNav items={nav.items} pathname={pathname} onNavigate={navigate} />
        )}

        <Drawer open={drawerOpen} onOpen={() => setDrawerOpen(true)} onClose={() => setDrawerOpen(false)}>
          <Sidebar
            nav={nav}
            pathname={pathname}
            onNavigate={navigate}
            onLogout={handleLogout}
            topInset
          />
        </Drawer>
      </View>
    );
  }

  // Tablet / large — persistent sidebar + desktop top bar. `--topbar-pad-x`
  // in RoseShell.module.css drives both the top bar AND `.main`'s horizontal
  // padding at this tier (32 tablet / 48 desktop / 64 at ≥1440) — it is not
  // the same value as the phone/tablet `pagePad` content constant.
  const isTablet = bp === 'tablet';
  const topBarPadX = isTablet ? 32 : width >= 1440 ? 64 : 48;

  return (
    <View style={[styles.root, styles.desktopRow, { backgroundColor: tokens.colors.surface }]}>
      <View
        style={[
          styles.sidebarPersistent,
          { width: sidebarWidth, borderRightColor: tokens.colors.outlineVariant },
        ]}
      >
        <Sidebar nav={nav} pathname={pathname} onNavigate={navigate} onLogout={handleLogout} compact={isTablet} />
      </View>

      <View style={{ flex: 1 }}>
        <TopBar
          isSubPage={isSubPage}
          breadcrumbs={breadcrumbs}
          initials={initials}
          showSearch={showSearch}
          paddingHorizontal={topBarPadX}
          height={80}
          onGoBack={goBack}
          onCrumbPress={navigate}
          onAvatarPress={() => navigate('/account')}
        />

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
          {disableScroll ? (
            <View style={[{ flex: 1, paddingHorizontal: topBarPadX, paddingTop: space[4] }, capStyle, contentStyle]}>
              {mainContent}
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[
                styles.main,
                { paddingHorizontal: topBarPadX, paddingTop: space[4], paddingBottom: space[16] },
                contentStyle,
              ]}
              refreshControl={refreshControl}
              keyboardShouldPersistTaps="handled"
            >
              <View style={capStyle}>{mainContent}</View>

              {showFooter && (
                <View style={[styles.footer, { borderTopColor: tokens.colors.outlineVariant, paddingHorizontal: topBarPadX }]}>
                  <View style={[styles.footerLinks, capStyle]}>
                    {FOOTER_LINKS.map((link) => (
                      <Text key={link} variant="bodySm" color="onSurfaceVariant">
                        {link}
                      </Text>
                    ))}
                  </View>
                  <Text
                    style={{ fontFamily: font('mono', 400), fontSize: 11, letterSpacing: 0.04 * 11, opacity: 0.7 }}
                    color="onSurfaceVariant"
                  >
                    © {new Date().getFullYear()} Arial Engineering Systems. All rights reserved.
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  desktopRow: {
    flexDirection: 'row',
  },
  sidebarPersistent: {
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  main: {
    flexGrow: 1,
  },
  hero: {
    gap: space[3],
    marginBottom: space[10],
  },
  subtitle: {
    marginTop: 0,
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    gap: space[3],
    paddingTop: space[10],
    paddingBottom: space[8],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[6],
    justifyContent: 'center',
  },
});
