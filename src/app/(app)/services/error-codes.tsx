import React, { useCallback, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import {
  AlertTriangle, ArrowRight, Lightbulb, RotateCcw, Search, Wrench,
} from 'lucide-react-native';

import { AppShell } from '@/components/shell/AppShell';
import { Text } from '@/components/primitives/Text';
import { PressableScale } from '@/components/primitives/PressableScale';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { radius, space } from '@/theme/spacing';
import { shadow } from '@/theme/shadow';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { ERROR_CODE_BRANDS, ERROR_CODES } from '@/lib/errorCodes';
import type { ErrorCodeBrand } from '@/lib/errorCodes';

// Ported from ../../aes-frontend/src/app/services/error-codes/page.js +
// error.module.css. The `?from=wizard` round-trip is load-bearing: it makes
// this screen's cards return control to the ticket wizard at step 3 with the
// error code pre-filled, rather than starting a fresh ticket flow.
export default function ErrorCodesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const fromWizard = params.from === 'wizard';
  const { tokens } = useTheme();
  const { isPhone } = useBreakpoint();
  const styles = useThemedStyles(makeStyles);

  const [activeBrand, setActiveBrand] = useState<ErrorCodeBrand>(ERROR_CODE_BRANDS[0]);
  const [query, setQuery] = useState('');

  const codes = useMemo(() => {
    const list = ERROR_CODES[activeBrand] || [];
    if (!query.trim()) return list;
    const needle = query.trim().toLowerCase();
    return list.filter((c) => (
      c.code.toLowerCase().includes(needle)
      || c.title.toLowerCase().includes(needle)
      || c.desc.toLowerCase().includes(needle)
    ));
  }, [activeBrand, query]);

  const pickCode = useCallback((code: string) => {
    const target = `/services/ticket?step=3&code=${encodeURIComponent(code)}`;
    if (fromWizard) router.replace(target);
    else router.push(target);
  }, [fromWizard, router]);

  const goBookService = useCallback(() => {
    if (fromWizard) router.back();
    else router.push('/services/ticket');
  }, [fromWizard, router]);

  const selectBrand = useCallback((brand: ErrorCodeBrand) => {
    setActiveBrand(brand);
    setQuery('');
  }, []);

  const hero = (
    <View style={[styles.heroRow, isPhone && styles.heroRowPhone]}>
      <View style={styles.heroText}>
        <Text variant="headlineXl" color="onSurfaceStrong">Error Code Guide</Text>
        <Text variant="bodyLg" color="onSurfaceVariant">
          Look up your AC&apos;s error code, learn what it means, and pick the right
          fix — or apply it directly to a new service ticket.
        </Text>
      </View>
      <PressableScale
        style={[styles.heroCta, { backgroundColor: tokens.colors.secondary }, shadow('cta')]}
        haptic
        onPress={goBookService}
      >
        <Wrench size={14} color={tokens.colors.onSecondary} />
        <Text style={[styles.heroCtaLabel, { color: tokens.colors.onSecondary }]}>
          {fromWizard ? 'Back to ticket' : 'Book service'}
        </Text>
      </PressableScale>
    </View>
  );

  return (
    <AppShell hero={hero}>
      {/* Brand pills */}
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 200 }}
        style={[styles.brandTabs, { backgroundColor: tokens.colors.surfaceContainerLowest }]}
      >
        {ERROR_CODE_BRANDS.map((brand) => {
          const isActive = brand === activeBrand;
          return (
            <PressableScale
              key={brand}
              scaleTo={0.96}
              style={[styles.brandTab, isActive && { backgroundColor: tokens.colors.secondary }]}
              onPress={() => selectBrand(brand)}
            >
              <Text style={[styles.brandTabLabel, { color: isActive ? tokens.colors.onSecondary : tokens.colors.onSurfaceVariant }]}>
                {brand}
              </Text>
            </PressableScale>
          );
        })}
      </MotiView>

      {/* Search */}
      <View
        style={[
          styles.searchRow,
          { backgroundColor: tokens.colors.surfaceContainerLowest, borderColor: tokens.colors.outlineVariant },
        ]}
      >
        <Search size={16} color={tokens.colors.onSurfaceVariant} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${activeBrand} codes — e.g. E1, H6, P1…`}
          placeholderTextColor={tokens.colors.outline}
          style={[styles.searchInput, { color: tokens.colors.onSurface }]}
        />
        {query.length > 0 && (
          <PressableScale
            style={[styles.searchClear, { backgroundColor: tokens.colors.surfaceContainerLow }]}
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
          >
            <RotateCcw size={14} color={tokens.colors.onSurfaceVariant} />
          </PressableScale>
        )}
      </View>

      {/* Cards */}
      <MotiView
        key={activeBrand}
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 220 }}
        style={styles.list}
      >
        {codes.length === 0 ? (
          <View style={[styles.empty, { borderColor: tokens.colors.outlineVariant }]}>
            <View style={[styles.emptyIcon, { backgroundColor: tokens.colors.secondarySoft }]}>
              <Search size={26} color={tokens.colors.secondaryInk} />
            </View>
            <Text variant="headlineSm" color="onSurface" align="center">No matching codes</Text>
            <Text variant="bodyMd" color="onSurfaceVariant" align="center">
              Try a different brand or clear the search.
            </Text>
          </View>
        ) : (
          codes.map((c, i) => (
            <MotiView
              key={`${activeBrand}-${c.code}`}
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 260, delay: i < 10 ? i * 25 : 0 }}
              style={isPhone ? styles.cardFullItem : styles.cardWideItem}
            >
              <PressableScale
                scaleTo={0.98}
                haptic
                style={[styles.card, { backgroundColor: tokens.colors.surfaceContainerLowest }]}
                onPress={() => pickCode(c.code)}
                accessibilityLabel={`Apply error code ${c.code} to your ticket`}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.codePill, { backgroundColor: tokens.colors.secondarySoft }]}>
                    <Text style={[styles.codePillLabel, { color: tokens.colors.secondaryInk }]}>{c.code}</Text>
                  </View>
                  <View style={styles.cardTitleCol}>
                    <Text variant="headlineSm" color="onSurfaceStrong">{c.title}</Text>
                    <View
                      style={[
                        styles.severity,
                        { backgroundColor: c.severity === 'TECH' ? tokens.colors.errorContainer : tokens.colors.warningLight },
                      ]}
                    >
                      {c.severity === 'TECH'
                        ? <AlertTriangle size={11} color={tokens.colors.error} />
                        : <RotateCcw size={11} color={tokens.colors.warning} />}
                      <Text
                        style={[
                          styles.severityLabel,
                          { color: c.severity === 'TECH' ? tokens.colors.error : tokens.colors.warning },
                        ]}
                      >
                        {c.severity === 'TECH' ? 'Requires Technician' : 'Try Reset First'}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text variant="bodyMd" color="onSurfaceVariant">{c.desc}</Text>

                <View style={[styles.cardTip, { backgroundColor: tokens.colors.surfaceContainerLow, borderLeftColor: tokens.colors.secondary }]}>
                  <Lightbulb size={14} color={tokens.colors.secondaryInk} style={styles.cardTipIcon} />
                  <Text variant="bodySm" color="onSurface" style={styles.cardTipText}>{c.tip}</Text>
                </View>

                <View style={styles.applyHint}>
                  <Text style={[styles.applyHintLabel, { color: tokens.colors.secondaryInk }]}>Apply to my ticket</Text>
                  <ArrowRight size={12} color={tokens.colors.secondaryInk} />
                </View>
              </PressableScale>
            </MotiView>
          ))
        )}
      </MotiView>
    </AppShell>
  );
}

const makeStyles = (tokens: ReturnType<typeof useTheme>['tokens']) => ({
  heroRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'space-between' as const,
    gap: space[6],
  },
  heroRowPhone: {
    flexDirection: 'column' as const,
    alignItems: 'flex-start' as const,
    gap: space[3],
  },
  heroText: {
    flex: 1,
    gap: space[2],
  },
  heroCta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[2],
    paddingVertical: space[3] - 2,
    paddingHorizontal: space[5] - 2,
    borderRadius: radius.full,
  },
  heroCtaLabel: {
    fontFamily: font('body', 600),
    fontSize: 13,
  },

  brandTabs: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: space[2],
    padding: space[2] + 2,
    borderRadius: radius.full,
    marginBottom: space[4],
    alignSelf: 'flex-start' as const,
  },
  brandTab: {
    paddingVertical: space[2],
    paddingHorizontal: space[4],
    borderRadius: radius.full,
  },
  brandTabLabel: {
    fontFamily: font('body', 500),
    fontSize: 13,
  },

  searchRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[2] + 2,
    paddingHorizontal: space[5] - 2,
    height: 48,
    borderWidth: 1,
    borderRadius: radius.full,
    marginBottom: space[6],
  },
  searchInput: {
    flex: 1,
    fontFamily: font('body', 400),
    fontSize: 14,
  },
  searchClear: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  list: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    marginHorizontal: -space[2],
    gap: space[3],
  },
  cardFullItem: {
    width: '100%' as const,
    paddingHorizontal: space[2],
  },
  cardWideItem: {
    width: '50%' as const,
    paddingHorizontal: space[2],
  },
  card: {
    flex: 1,
    gap: space[3],
    padding: space[5],
    borderWidth: 1,
    borderColor: 'rgba(11, 26, 44, 0.06)',
    borderRadius: radius.lg,
    ...shadow('card'),
  },
  cardTop: {
    flexDirection: 'row' as const,
    gap: space[4] - 2,
    alignItems: 'flex-start' as const,
  },
  codePill: {
    minWidth: 48,
    height: 36,
    paddingHorizontal: space[3],
    borderRadius: radius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  codePillLabel: {
    fontFamily: font('mono', 700),
    fontSize: 14,
    letterSpacing: 0.08 * 14,
  },
  cardTitleCol: {
    flex: 1,
    gap: space[2] - 2,
  },
  severity: {
    flexDirection: 'row' as const,
    alignSelf: 'flex-start' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: radius.full,
  },
  severityLabel: {
    fontFamily: font('mono', 600),
    fontSize: 9.5,
    letterSpacing: 0.10 * 9.5,
    textTransform: 'uppercase' as const,
  },
  cardTip: {
    flexDirection: 'row' as const,
    gap: space[2],
    padding: space[3],
    borderLeftWidth: 3,
    borderRadius: radius.sm,
  },
  cardTipIcon: {
    marginTop: 2,
  },
  cardTipText: {
    flex: 1,
  },
  applyHint: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingTop: 4,
  },
  applyHintLabel: {
    fontFamily: font('body', 600),
    fontSize: 13,
  },

  empty: {
    width: '100%' as const,
    alignItems: 'center' as const,
    gap: space[3],
    paddingVertical: space[12] + 2,
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
