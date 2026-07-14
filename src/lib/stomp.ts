/**
 * STOMP-over-raw-WebSocket singleton client for the AES mobile app.
 *
 * Ported from ../../aes-frontend/src/lib/websocket/stompClient.js, but this
 * is a REWRITE, not a port: the web client uses `sockjs-client`, which needs
 * a DOM (document, XHR, iframes) and cannot run in React Native. The backend
 * mounts SockJS at `/ws`, and SockJS automatically exposes a raw WebSocket
 * endpoint at `/ws/websocket` — React Native's built-in `WebSocket` global
 * talks to that endpoint directly, no SockJS session protocol involved.
 *
 * Topics exposed by the backend (subscribe-only — the app never SENDs):
 *   /topic/tickets/{ticketNumber}            → status changes / escalations
 *   /topic/crm/inbox                         → new tickets for CRM agents
 *   /topic/ops/inbox                         → new tickets/installs for ops
 *   /topic/escalation/dashboard              → admin escalation feed
 *   /topic/users/{userId}/notifications      → personal notification stream
 *   /topic/users/{userId}/offers             → personal assignment-offer stream
 *
 * Usage:
 *   import { subscribeTopic } from '@/lib/stomp';
 *   const unsubscribe = subscribeTopic('/topic/tickets/TKT-2025-0001', (msg) => …);
 *   …later: unsubscribe();
 */
import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { getToken } from './storage';

// See the matching comment in ./api.ts — 10.0.2.2 only resolves inside the
// Android emulator; the web build runs in the host browser and needs localhost.
const resolveWsUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:8080/ws/websocket';
  return Platform.OS === 'web' ? envUrl.replace('10.0.2.2', 'localhost') : envUrl;
};

const WS_URL = resolveWsUrl();

type Listener = (payload: unknown) => void;

interface SubscriptionEntry {
  count: number;
  sub: StompSubscription | null;
  listeners: Set<Listener>;
}

let client: Client | null = null;
const subscriptions = new Map<string, SubscriptionEntry>();
const reconnectListeners = new Set<() => void>();

/**
 * `connectHeaders` must be read fresh on every activation, never captured
 * once at construction — this is the bug fix from the web client, where
 * `connectHeaders` was evaluated once via an IIFE, so a client that connected
 * before a token refresh kept sending the stale JWT on every reconnect and
 * got rejected by the broker.
 */
function currentConnectHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function parseFrameBody(frame: IMessage): unknown {
  try {
    return JSON.parse(frame.body);
  } catch {
    return frame.body;
  }
}

function subscribeEntry(destination: string, entry: SubscriptionEntry): void {
  if (!client?.connected || entry.sub) return;
  entry.sub = client.subscribe(destination, (frame) => {
    const payload = parseFrameBody(frame);
    entry.listeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error('[stomp-listener]', err);
      }
    });
  });
}

function ensureClient(): Client {
  if (client) return client;

  client = new Client({
    webSocketFactory: () => new WebSocket(WS_URL),
    connectHeaders: currentConnectHeaders(),
    reconnectDelay: 4000,
    heartbeatIncoming: 15000,
    heartbeatOutgoing: 15000,
    debug: () => {},
    onConnect: () => {
      // Re-subscribe to every tracked destination — restores every screen's
      // subscriptions silently after a reconnect.
      subscriptions.forEach((entry, destination) => subscribeEntry(destination, entry));
      // MESSAGE frames sent while the socket was down are gone forever (STOMP
      // has no replay) — let screens refetch their list once on reconnect.
      reconnectListeners.forEach((fn) => {
        try {
          fn();
        } catch (err) {
          console.error('[stomp-reconnect]', err);
        }
      });
    },
    onStompError: (frame) => {
      console.warn('[stomp] broker error:', frame.headers?.message || frame);
    },
  });
  return client;
}

function activate(): void {
  const c = ensureClient();
  // Re-assign immediately before every activate() so a reconnect always
  // carries the CURRENT token, never the one captured at construction time.
  c.connectHeaders = currentConnectHeaders();
  if (!c.active) c.activate();
}

/**
 * Subscribe to a STOMP destination. Returns an unsubscribe fn.
 * Multiple listeners on the same destination share one underlying subscription.
 */
export function subscribeTopic(destination: string, listener: Listener): () => void {
  ensureClient();

  let entry = subscriptions.get(destination);
  if (!entry) {
    entry = { count: 0, sub: null, listeners: new Set() };
    subscriptions.set(destination, entry);
  }
  entry.listeners.add(listener);
  entry.count += 1;

  activate();
  subscribeEntry(destination, entry);

  return () => {
    const cur = subscriptions.get(destination);
    if (!cur) return;
    cur.listeners.delete(listener);
    cur.count = Math.max(0, cur.count - 1);
    if (cur.count === 0) {
      try {
        cur.sub?.unsubscribe();
      } catch {
        /* ignore */
      }
      subscriptions.delete(destination);
    }
  };
}

/**
 * Force a fresh connection — call after sign-in and after sign-out so the
 * next CONNECT negotiates with the new (or absent) JWT.
 */
export function reconnectStompClient(): void {
  if (client) {
    try {
      client.deactivate();
    } catch {
      /* ignore */
    }
    subscriptions.forEach((entry) => {
      entry.sub = null;
    });
    client = null;
  }
  // Any screen still holding subscriptions (e.g. NotificationProvider) needs
  // its topic re-established under the new identity right away, not on the
  // next mount.
  if (subscriptions.size > 0) activate();
}

/** Register a callback fired every time the client (re)connects. */
export function onReconnect(cb: () => void): () => void {
  reconnectListeners.add(cb);
  return () => {
    reconnectListeners.delete(cb);
  };
}

// ─── AppState awareness ──────────────────────────────────────────────────
// iOS suspends the socket within seconds of backgrounding; Android may keep
// it or kill it. Without this, the app comes back from background believing
// it is connected while the socket is dead and live updates silently stop —
// the most common realtime bug in RN apps.
AppState.addEventListener('change', (state: AppStateStatus) => {
  if (!client) return;
  if (state === 'active') {
    activate();
  } else if (state === 'background') {
    client.deactivate();
  }
});
