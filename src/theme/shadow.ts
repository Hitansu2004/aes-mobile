import { Platform, ViewStyle } from 'react-native';

// Shadow tokens ported from globals.css (--shadow-xs/sm/(--shadow)/md/lg,
// --shadow-glow, --aes-shadow-cta). iOS renders the real
// shadowColor/Offset/Opacity/Radius; Android has no offset or colour concept
// for elevation, so it only gets `elevation` (+ `shadowColor` on API 28+,
// which some Android renderers use to tint the shadow — this is the closest
// approximation of the gold CTA/glow shadows Android supports; it will still
// render as a plain dark shadow on older Android versions).

type ShadowLevel = 'xs' | 'sm' | 'card' | 'md' | 'lg' | 'cta' | 'glow';

const iosSpec: Record<ShadowLevel, { offset: [number, number]; opacity: number; radius: number }> = {
  xs: { offset: [0, 1], opacity: 0.04, radius: 2 },
  sm: { offset: [0, 1], opacity: 0.06, radius: 3 },
  card: { offset: [0, 2], opacity: 0.08, radius: 12 },
  md: { offset: [0, 6], opacity: 0.1, radius: 18 },
  lg: { offset: [0, 12], opacity: 0.12, radius: 32 },
  cta: { offset: [0, 8], opacity: 0.5, radius: 18 },
  glow: { offset: [0, 8], opacity: 0.3, radius: 24 },
};

const elevation: Record<ShadowLevel, number> = {
  xs: 1,
  sm: 2,
  card: 3,
  md: 6,
  lg: 12,
  cta: 8,
  glow: 10,
};

const defaultShadowColor: Record<ShadowLevel, string> = {
  xs: 'rgba(15, 28, 44, 1)',
  sm: 'rgba(15, 28, 44, 1)',
  card: 'rgba(15, 28, 44, 1)',
  md: 'rgba(15, 28, 44, 1)',
  lg: 'rgba(15, 28, 44, 1)',
  cta: '#C9A84C',
  glow: '#C9A84C',
};

export function shadow(level: ShadowLevel, color?: string): ViewStyle {
  if (Platform.OS === 'ios') {
    const spec = iosSpec[level];
    return {
      shadowColor: color ?? defaultShadowColor[level],
      shadowOffset: { width: spec.offset[0], height: spec.offset[1] },
      shadowOpacity: spec.opacity,
      shadowRadius: spec.radius,
    };
  }

  // Android: elevation has no colour/offset of its own. From API 28 onward,
  // `shadowColor` tints the ambient/key shadow, so we still set it for the
  // gold cta/glow levels — on API <28 it is silently ignored and the shadow
  // renders as the default dark elevation shadow.
  return {
    elevation: elevation[level],
    shadowColor: color ?? defaultShadowColor[level],
  };
}
