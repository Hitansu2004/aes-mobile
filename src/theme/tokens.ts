// Design tokens ported verbatim from ../aes-frontend/src/app/globals.css
// (`:root` = light, `[data-theme="dark"]` = dark). Never hand-pick a colour
// outside this file — see CLAUDE.md rule 4.

export const lightTokens = {
  colors: {
    primary: '#0B1A2C',
    primaryDark: '#06121F',
    primaryLight: '#17293D',
    primaryContainer: '#DDE4EC',
    onPrimary: '#ffffff',
    onPrimaryContainer: '#0B1A2C',
    inversePrimary: '#9FB4CC',

    secondary: '#C9A84C',
    secondaryStrong: '#B5912E',
    secondaryPress: '#9A7B24',
    secondarySoft: '#F2E7C4',
    secondaryLight: '#E6D29B',
    secondaryInk: '#8F701E',
    onSecondary: '#0B1A2C',

    tertiary: '#55503F',
    tertiaryStrong: '#3A3628',
    tertiarySoft: '#EDE7D6',
    onTertiary: '#ffffff',

    surface: '#faf9f5',
    background: '#faf9f5',
    surfaceDim: '#EFE9DC',
    surfaceBright: '#ffffff',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#F7F4EE',
    surfaceContainer: '#F1ECE0',
    surfaceContainerHigh: '#E9E2D2',
    surfaceContainerHighest: '#E0D7C3',

    onSurface: '#14202E',
    onSurfaceVariant: '#5C5647',
    onSurfaceStrong: '#0B1A2C',
    inverseSurface: '#0B1A2C',
    inverseOnSurface: '#F5F1E6',

    outline: '#A99F86',
    outlineVariant: '#E2DAC6',
    borderLight: '#ECE6D8',

    error: '#ba1a1a',
    errorContainer: '#ffdad6',
    onError: '#ffffff',
    success: '#16a34a',
    successLight: '#dcfce7',
    warning: '#b06800',
    warningLight: '#fef3c7',
    info: '#0B1A2C',
    infoLight: '#E7EAEF',
  },
  badges: {
    amc: { fg: '#7A5F1E', bg: '#F2E7C4' },
    warranty: { fg: '#1E3A5F', bg: '#E5E9EF' },
    paid: { fg: '#b06800', bg: '#fef3c7' },
    escalated: { fg: '#9a3412', bg: '#fed7aa' },
    resolved: { fg: '#166534', bg: '#dcfce7' },
    scheduled: { fg: '#7A5F1E', bg: '#F2E7C4' },
    open: { fg: '#0B1A2C', bg: '#E7EAEF' },
  },
  sla: {
    safe: '#16a34a',
    warning: '#b06800',
    critical: '#ba1a1a',
  },
  gradients: {
    amcCard: ['#FBF6E6', '#F0E2B8'],
    splash: ['#FBF8EF', '#faf9f5'],
    blueprintTint: 'rgba(201, 168, 76, 0.075)',
  },
  glass: {
    header: 'rgba(250, 249, 245, 0.92)',
    bottomNav: 'rgba(250, 249, 245, 0.92)',
    blurIntensity: 40,
  },
  blueprint: {
    line: 'rgba(201, 168, 76, 0.040)',
    lineStrong: 'rgba(201, 168, 76, 0.075)',
  },
};

export const darkTokens: typeof lightTokens = {
  colors: {
    primary: '#9FB4CC',
    primaryDark: '#7E96B3',
    primaryLight: '#C3D2E4',
    primaryContainer: '#16222F',
    onPrimary: '#0B1A2C',
    onPrimaryContainer: '#DDE4EC',
    inversePrimary: '#0B1A2C',

    secondary: '#E0C878',
    secondaryStrong: '#EAD68F',
    secondaryPress: '#EAD68F',
    secondarySoft: 'rgba(201, 168, 76, 0.18)',
    secondaryLight: '#F0E2B8',
    secondaryInk: '#E0C878',
    onSecondary: '#2A2008',

    tertiary: '#D8CFB8',
    tertiaryStrong: '#E7E0CC',
    tertiarySoft: 'rgba(216, 207, 184, 0.18)',
    onTertiary: '#2A2620',

    surface: '#0B141E',
    background: '#0B141E',
    surfaceDim: '#060C13',
    surfaceBright: '#101B27',
    surfaceContainerLowest: '#101B27',
    surfaceContainerLow: '#16222F',
    surfaceContainer: '#1B2836',
    surfaceContainerHigh: '#223141',
    surfaceContainerHighest: '#2B3B4D',

    onSurface: '#EAE7DF',
    onSurfaceVariant: '#B9B2A0',
    onSurfaceStrong: '#ffffff',
    inverseSurface: '#EAE7DF',
    inverseOnSurface: '#0B1A2C',

    outline: '#7C8899',
    outlineVariant: '#2E3B49',
    borderLight: '#24313F',

    error: '#ff6b6b',
    errorContainer: '#4a1414',
    onError: '#ffffff',
    success: '#4ade80',
    successLight: 'rgba(74, 222, 128, 0.16)',
    warning: '#fbbf24',
    warningLight: 'rgba(251, 191, 36, 0.18)',
    info: '#E0C878',
    infoLight: 'rgba(201, 168, 76, 0.14)',
  },
  badges: {
    amc: { fg: '#E6D29B', bg: 'rgba(201, 168, 76, 0.16)' },
    warranty: { fg: '#C3D2E4', bg: 'rgba(159, 180, 204, 0.16)' },
    paid: { fg: '#fbbf24', bg: 'rgba(245, 158, 11, 0.18)' },
    escalated: { fg: '#f97316', bg: 'rgba(249, 115, 22, 0.18)' },
    resolved: { fg: '#4ade80', bg: 'rgba(34, 197, 94, 0.16)' },
    scheduled: { fg: '#E6D29B', bg: 'rgba(201, 168, 76, 0.16)' },
    open: { fg: '#E0C878', bg: 'rgba(201, 168, 76, 0.14)' },
  },
  sla: {
    safe: '#4ade80',
    warning: '#fbbf24',
    critical: '#ff6b6b',
  },
  gradients: {
    amcCard: ['rgba(201, 168, 76, 0.14)', 'rgba(201, 168, 76, 0.05)'],
    splash: ['#0B141E', '#0B141E'],
    blueprintTint: 'rgba(201, 168, 76, 0.080)',
  },
  glass: {
    header: 'rgba(11, 20, 30, 0.88)',
    bottomNav: 'rgba(11, 20, 30, 0.88)',
    blurIntensity: 40,
  },
  blueprint: {
    line: 'rgba(201, 168, 76, 0.045)',
    lineStrong: 'rgba(201, 168, 76, 0.080)',
  },
};

export type Tokens = typeof lightTokens;
export type ColorToken = keyof typeof lightTokens.colors;
