// 4px baseline spacing/radius/layout scale, ported from globals.css
// (--space-*, --radius-*, --nav-height, --max-width-*, --page-pad-x).

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 28,
  full: 9999,
} as const;

export const layout = {
  bottomNavHeight: 72,
  mobileTopBarHeight: 60,
  desktopTopBarHeight: 80,

  sidebarPhone: 280,
  sidebarTablet: 200,
  sidebarLarge: 240,

  contentMaxPhone: 480,
  contentMaxTablet: 760,
  contentMaxLarge: 980,

  pagePadPhone: 16,
  pagePadTablet: 24,
  pagePadLarge: 32,
} as const;
