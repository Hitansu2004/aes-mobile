import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { layout } from '@/theme/spacing';

// Ported from ../../aes-frontend/src/components/rose/RoseShell.js — the
// `.sidebar`/`.sidebarOpen`/`.backdrop` off-canvas drawer on ≤768px. Web's
// `.sidebar` transitions with `transform 280ms cubic-bezier(0.22, 1, 0.36, 1)`
// (easeOutQuint, no overshoot) — matched here with the same duration/curve
// instead of a spring, so the drawer's arrival doesn't bounce like web's
// doesn't. Drag gestures still drive `translateX` directly; only the
// settle-to-open/closed animation uses this timing curve.
const EASE_OUT_QUINT = Easing.bezier(0.22, 1, 0.36, 1);
const DRAWER_TIMING = { duration: 280, easing: EASE_OUT_QUINT } as const;

export interface DrawerProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: React.ReactNode;
}

export function Drawer({ open, onOpen, onClose, children }: DrawerProps) {
  const { tokens } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const drawerWidth = useMemo(() => Math.min(layout.sidebarPhone, screenWidth * 0.85), [screenWidth]);

  const translateX = useSharedValue(open ? 0 : -drawerWidth);
  const startX = useSharedValue(0);

  useEffect(() => {
    translateX.value = withTiming(open ? 0 : -drawerWidth, DRAWER_TIMING);
  }, [open, drawerWidth, translateX]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-drawerWidth, 0], [0, 0.5], Extrapolation.CLAMP),
  }));

  const panelPan = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      translateX.value = Math.min(0, Math.max(-drawerWidth, startX.value + e.translationX));
    })
    .onEnd((e) => {
      const shouldClose = translateX.value < -drawerWidth / 3 || e.velocityX < -500;
      translateX.value = withTiming(shouldClose ? -drawerWidth : 0, DRAWER_TIMING);
      if (shouldClose) runOnJS(onClose)();
    });

  const edgePan = Gesture.Pan()
    .activeOffsetX(10)
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      translateX.value = Math.min(0, Math.max(-drawerWidth, startX.value + e.translationX));
    })
    .onEnd((e) => {
      const shouldOpen = translateX.value > -drawerWidth * (2 / 3) || e.velocityX > 500;
      translateX.value = withTiming(shouldOpen ? 0 : -drawerWidth, DRAWER_TIMING);
      if (shouldOpen) runOnJS(onOpen)();
    });

  return (
    <>
      {!open && (
        <GestureDetector gesture={edgePan}>
          <View style={styles.edgeZone} pointerEvents="box-only" />
        </GestureDetector>
      )}

      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[styles.backdrop, backdropStyle]}
      >
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close menu" onPress={onClose} />
      </Animated.View>

      <GestureDetector gesture={panelPan}>
        <Animated.View
          style={[
            styles.panel,
            {
              width: drawerWidth,
              backgroundColor: tokens.colors.surfaceContainerLowest,
              borderRightColor: tokens.colors.outlineVariant,
            },
            panelStyle,
          ]}
        >
          {children}
        </Animated.View>
      </GestureDetector>
    </>
  );
}

const styles = StyleSheet.create({
  edgeZone: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 20,
    zIndex: 65,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 28, 44, 0.45)',
    zIndex: 55,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 60,
    borderRightWidth: StyleSheet.hairlineWidth,
    shadowColor: 'rgba(15, 28, 44, 1)',
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 16,
  },
});
