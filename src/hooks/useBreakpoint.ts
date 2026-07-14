import { useWindowDimensions } from 'react-native';

import { layout } from '@/theme/spacing';

export type Breakpoint = 'phone' | 'tablet' | 'large';

interface BreakpointInfo {
  bp: Breakpoint;
  width: number;
  isPhone: boolean;
  isTablet: boolean;
  isLarge: boolean;
  contentMaxWidth: number;
  pagePad: number;
  sidebarWidth: number;
}

// Reads useWindowDimensions() (not Dimensions.get()) so it recomputes on
// rotation — see globals.css breakpoints: phone ≤768, tablet 769–1023,
// large ≥1024 (sidebar widens again to 260 at ≥1440, per the web's
// --aes-sidebar-width rules).
export function useBreakpoint(): BreakpointInfo {
  const { width } = useWindowDimensions();

  let bp: Breakpoint;
  if (width <= 768) bp = 'phone';
  else if (width <= 1023) bp = 'tablet';
  else bp = 'large';

  const contentMaxWidth =
    bp === 'phone' ? layout.contentMaxPhone : bp === 'tablet' ? layout.contentMaxTablet : layout.contentMaxLarge;

  const pagePad = bp === 'phone' ? layout.pagePadPhone : bp === 'tablet' ? layout.pagePadTablet : layout.pagePadLarge;

  const sidebarWidth =
    bp === 'phone' ? layout.sidebarPhone : bp === 'tablet' ? layout.sidebarTablet : width >= 1440 ? 260 : layout.sidebarLarge;

  return {
    bp,
    width,
    isPhone: bp === 'phone',
    isTablet: bp === 'tablet',
    isLarge: bp === 'large',
    contentMaxWidth,
    pagePad,
    sidebarWidth,
  };
}
