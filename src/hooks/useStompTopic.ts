import { useEffect, useRef } from 'react';

import { subscribeTopic } from '@/lib/stomp';

/**
 * Subscribe to a STOMP topic for the lifetime of the component.
 *
 *   useStompTopic('/topic/tickets/TKT-2025-0001', (msg) => …, [ticketNumber])
 *
 * The destination can be `null`/`undefined` while you're waiting on data —
 * the hook will skip subscribing until it becomes truthy.
 *
 * Ported verbatim from ../../aes-frontend/src/hooks/useStompTopic.js. The
 * freshest listener is held in a ref — updated in an effect (never during
 * render) — so callers don't need useCallback.
 */
export default function useStompTopic(
  destination: string | null | undefined,
  listener: (payload: unknown) => void,
  deps: unknown[] = [],
): void {
  const listenerRef = useRef(listener);
  useEffect(() => {
    listenerRef.current = listener;
  }, [listener]);

  useEffect(() => {
    if (!destination) return undefined;
    const unsubscribe = subscribeTopic(destination, (payload) => {
      listenerRef.current?.(payload);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, ...deps]);
}
