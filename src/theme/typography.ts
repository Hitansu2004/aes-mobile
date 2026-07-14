import { TextStyle } from 'react-native';

// Font family + weight → loaded font family name. React Native does NOT
// synthesise font weights on Android — a `fontWeight: '700'` on a family that
// only has the Regular cut renders as Regular. Every weight below must be
// loaded as its own family in `useFonts` (see src/app/_layout.tsx) and picked
// by NAME here, never by fontWeight.
export type FontFamily = 'display' | 'body' | 'mono';

const FAMILY_MAP: Record<FontFamily, Record<number, string>> = {
  display: {
    500: 'CormorantGaramond_500Medium',
    600: 'CormorantGaramond_600SemiBold',
    700: 'CormorantGaramond_700Bold',
  },
  body: {
    300: 'Inter_300Light',
    400: 'Inter_400Regular',
    500: 'Inter_500Medium',
    600: 'Inter_600SemiBold',
    700: 'Inter_700Bold',
    800: 'Inter_800ExtraBold',
  },
  mono: {
    400: 'JetBrainsMono_400Regular',
    500: 'JetBrainsMono_500Medium',
    600: 'JetBrainsMono_600SemiBold',
  },
};

export function font(family: FontFamily, weight: number): string {
  const weights = FAMILY_MAP[family];
  return weights[weight] ?? weights[400] ?? Object.values(weights)[0];
}

type TypeStyle = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'>;

export const typography: Record<
  | 'headlineXl'
  | 'headlineLg'
  | 'headlineMd'
  | 'headlineSm'
  | 'bodyLg'
  | 'bodyMd'
  | 'bodySm'
  | 'labelLg'
  | 'labelMd'
  | 'eyebrow'
  | 'mono',
  TypeStyle
> = {
  headlineXl: { fontFamily: font('display', 700), fontSize: 28, lineHeight: 36, letterSpacing: 0.02 * 28 },
  headlineLg: { fontFamily: font('display', 700), fontSize: 22, lineHeight: 28, letterSpacing: 0.02 * 22 },
  headlineMd: { fontFamily: font('display', 600), fontSize: 18, lineHeight: 24, letterSpacing: 0.015 * 18 },
  headlineSm: { fontFamily: font('display', 600), fontSize: 16, lineHeight: 22, letterSpacing: 0.01 * 16 },

  bodyLg: { fontFamily: font('body', 400), fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  bodyMd: { fontFamily: font('body', 400), fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  bodySm: { fontFamily: font('body', 400), fontSize: 13, lineHeight: 18, letterSpacing: 0 },

  labelLg: { fontFamily: font('body', 600), fontSize: 14, lineHeight: 20, letterSpacing: 0.05 * 14 },
  labelMd: { fontFamily: font('body', 500), fontSize: 12, lineHeight: 16, letterSpacing: 0.06 * 12 },

  eyebrow: { fontFamily: font('body', 700), fontSize: 11, lineHeight: 14, letterSpacing: 0.12 * 11 },

  mono: { fontFamily: font('mono', 500), fontSize: 14, lineHeight: 20, letterSpacing: 0 },
};

// Tablet (≥768px) overrides for the two headline sizes that grow — see
// globals.css `@media (min-width: 768px) { .headline-xl, .headline-lg }`.
export const headlineXlTablet: TypeStyle = { fontFamily: font('display', 700), fontSize: 36, lineHeight: 44, letterSpacing: 0.02 * 36 };
export const headlineLgTablet: TypeStyle = { fontFamily: font('display', 700), fontSize: 28, lineHeight: 36, letterSpacing: 0.02 * 28 };
