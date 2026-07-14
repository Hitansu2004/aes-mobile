import { useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Live countdown hook driven by a deadline ISO string.
 * Returns { remainingSeconds, isBreached, displayText, tone }.
 *
 *   tone: 'safe' (>20m), 'warning' (10–20m), 'critical' (<10m), 'breached'
 *
 * Ported from ../../aes-frontend/src/hooks/useSlaCountdown.js. The countdown
 * anchors on the absolute deadline timestamp (never a drifting offset) so it
 * survives the device sleeping.
 *
 * MOBILE ADDITION: the 1s interval is paused whenever AppState is not
 * 'active' and recomputed immediately on resume — a background timer both
 * drains battery and gets throttled by the OS, which would make the
 * countdown drift.
 */
export type SlaTone = 'safe' | 'warning' | 'critical' | 'breached';

export interface SlaCountdown {
  remainingSeconds: number | null;
  isBreached: boolean;
  displayText: string;
  tone: SlaTone;
}

export default function useSlaCountdown(
  deadlineISO?: string | null,
  { initialOffsetSeconds }: { initialOffsetSeconds?: number } = {},
): SlaCountdown {
  const targetMs = useMemo(() => {
    if (deadlineISO) return new Date(deadlineISO).getTime();
    if (initialOffsetSeconds != null) return Date.now() + initialOffsetSeconds * 1000;
    return null;
  }, [deadlineISO, initialOffsetSeconds]);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (targetMs == null) return undefined;

    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id) return;
      setNow(Date.now());
      id = setInterval(() => setNow(Date.now()), 1000);
    };
    const stop = () => {
      if (id) clearInterval(id);
      id = null;
    };

    if (AppState.currentState === 'active') start();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') start();
      else stop();
    });

    return () => {
      stop();
      sub.remove();
    };
  }, [targetMs]);

  if (targetMs == null) {
    return {
      remainingSeconds: null, isBreached: false, displayText: '—', tone: 'safe',
    };
  }

  const remainingSeconds = Math.floor((targetMs - now) / 1000);
  const isBreached = remainingSeconds <= 0;
  const tone: SlaTone = isBreached
    ? 'breached'
    : remainingSeconds < 600
      ? 'critical'
      : remainingSeconds < 1200
        ? 'warning'
        : 'safe';

  return {
    remainingSeconds, isBreached, displayText: formatRemaining(remainingSeconds), tone,
  };
}

export function formatRemaining(seconds: number): string {
  if (seconds <= 0) return 'BREACHED';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m >= 10) return `${m} min`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}
