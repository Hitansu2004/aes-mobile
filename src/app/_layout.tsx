import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';

import {
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} from '@expo-google-fonts/jetbrains-mono';

import { ThemeProvider } from '@/theme/ThemeProvider';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { ErrorBoundary } from '@/components/ErrorBoundary';

SplashScreen.preventAutoHideAsync();

// Every screen already ports the web's own custom focus treatment (gold
// border + tinted ring via onFocus/onBlur state — see Input.tsx, login.tsx,
// etc.), matching .inputWrap:focus-within in every *.module.css. But
// react-native-web renders <TextInput> as a plain HTML <input>, and Chrome
// draws its OWN default blue focus outline on top of that unless something
// removes it — the web app's globals.css does `input, textarea { outline:
// none }` implicitly via its own reset; RN-Web has no such reset built in.
// Inject the same rule once, web-only, rather than adding outlineStyle to
// every one of the ~15 files with a raw <TextInput>.
if (Platform.OS === 'web') {
  const styleId = 'aes-web-input-outline-reset';
  if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = 'input, textarea, select { outline: none !important; }';
    document.head.appendChild(styleEl);
  }
}

// Mounted once, inside every provider it depends on (AuthProvider for the
// current user + router redirect, NotificationProvider for the bell-badge
// refresh) — see usePushRegistration.ts. Renders nothing.
function PushBootstrap() {
  usePushRegistration();
  return null;
}

// Provider order (see CLAUDE.md): GestureHandlerRootView > SafeAreaProvider >
// ThemeProvider > BottomSheetModalProvider > AuthProvider > ToastProvider >
// NotificationProvider > Slot. NotificationProvider must sit inside
// ToastProvider (it calls useToast() to surface live notifications) and
// inside AuthProvider (it calls useAuth() for the current user).
// BottomSheetModalProvider is required by every Sheet/SelectSheet in
// src/components/primitives/Sheet.tsx — without it, .present() no-ops.
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
  });

  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Keep the native splash on screen until fonts resolve — rendering before
  // that would flash the system font for one frame, the same "white flash"
  // ThemeContext.js's themeBootScript exists to prevent on the web.
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <BottomSheetModalProvider>
              <AuthProvider>
                <ToastProvider>
                  <NotificationProvider>
                    <PushBootstrap />
                    <Slot />
                  </NotificationProvider>
                </ToastProvider>
              </AuthProvider>
            </BottomSheetModalProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
