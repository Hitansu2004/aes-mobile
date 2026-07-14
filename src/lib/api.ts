/**
 * AES Mobile — API Gateway
 *
 * Ports ../../aes-frontend/src/lib/api.js method-for-method, endpoint-for-
 * endpoint. Mobile-only additions: devices/uploads/appMeta/mapsProxy
 * namespaces, X-App-Version / X-App-Platform headers, a 20s request
 * timeout, and RN-shaped multipart uploads.
 *
 * Token storage differs from the web: SecureStore is async, so rawRequest
 * reads the token from an in-memory cache (see ../lib/storage.ts) that must
 * be hydrated once at app boot via hydrateTokenCache().
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';

import {
  getToken,
  getRefreshToken,
  setToken,
  setRefreshToken,
  clearTokens,
} from './storage';
import type {
  User,
  Property,
  AcUnit,
  ServiceTicket,
  SlaStatus,
  InstallationRequest,
  Quote,
  PartRequest,
  AmcContract,
  Notification,
  AssignmentOffer,
  DiscountCoupon,
  PaymentIntent,
  PaymentConfirmation,
  Payment,
  PriceQuote,
  SlotAvailability,
  DashboardStats,
  AuthResponse,
  AutocompleteResult,
  PlaceDetails,
  TicketRoute,
  AppConfig,
  UploadResult,
  DeviceRegistrationResult,
  TimeSlot,
  CrmPoolResponse,
  CrmTeam,
  CustomerSearchHit,
  CrmDashboardResponse,
  EscalationDashboardResponse,
  AdminRevenueDashboard,
  EngineerAvailability,
} from '../types/api';

// EXPO_PUBLIC_API_URL is set to 10.0.2.2 for the Android emulator (see .env).
// That address is meaningless outside an Android emulator's virtual network —
// when running via `expo start --web`, the app executes directly in the
// browser on the host machine, so it must talk to localhost instead.
const resolveApiBase = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
  return Platform.OS === 'web' ? envUrl.replace('10.0.2.2', 'localhost') : envUrl;
};

const API_BASE = resolveApiBase();

const REQUEST_TIMEOUT_MS = 20000;

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  skipAuth?: boolean;
};

let refreshInFlight: Promise<string | null> | null = null;
let onAuthFail: (() => void) | null = null;

export function setAuthFailureHandler(fn: (() => void) | null): void {
  onAuthFail = fn;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) return null;
      const newAccess: string | undefined = json?.data?.accessToken;
      if (newAccess) await setToken(newAccess);
      return newAccess || null;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

const APP_VERSION = Application.nativeApplicationVersion || Constants.expoConfig?.version || '0.0.0';
const APP_PLATFORM = Platform.OS;

async function rawRequest<T>(endpoint: string, options: RequestOptions = {}, attempt = 0): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = getToken();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-App-Version': APP_VERSION,
    'X-App-Platform': APP_PLATFORM,
    ...options.headers,
  };
  const bodyIsObject = options.body !== undefined && typeof options.body === 'object' && !isFormData(options.body);
  if (bodyIsObject) {
    headers['Content-Type'] = 'application/json';
  }
  if (token && !options.skipAuth) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method,
      headers,
      body: bodyIsObject ? JSON.stringify(options.body) : (options.body as BodyInit | undefined),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Cannot reach the server. Check your connection.', 0);
  } finally {
    clearTimeout(timeoutId);
  }

  // Try refresh on 401 once. The backend returns 401 (not 403) when the JWT
  // is expired or missing.
  if (res.status === 401 && !options.skipAuth && attempt === 0) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return rawRequest<T>(endpoint, options, attempt + 1);
    }
    await clearTokens();
    if (onAuthFail) onAuthFail();
    throw new ApiError('UNAUTHORIZED', 'Your session has expired. Please sign in again.', 401);
  }

  let json: Record<string, unknown>;
  try {
    json = await res.json();
  } catch {
    json = {};
  }

  if (!res.ok || json?.success === false) {
    const error = json?.error as { code?: string; message?: string } | undefined;
    throw new ApiError(
      error?.code || 'UNKNOWN_ERROR',
      error?.message || `Request failed with status ${res.status}`,
      res.status,
    );
  }

  return (json?.data !== undefined ? json.data : json) as T;
}

const request = <T>(endpoint: string, options?: RequestOptions) => rawRequest<T>(endpoint, options);

// ─── Auth ───────────────────────────────────────────────────
export const auth = {
  login: (identifier: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { identifier, password }, skipAuth: true }),

  refresh: (refreshToken: string) =>
    request<AuthResponse>('/auth/refresh', { method: 'POST', body: { refreshToken }, skipAuth: true }),

  logout: (refreshToken: string, deviceToken?: string) =>
    request<void>('/auth/logout', { method: 'POST', body: { refreshToken, deviceToken } }),
};

// ─── User / Profile ─────────────────────────────────────────
export const user = {
  getMe: () => request<User>('/users/me'),
  updateMe: (data: Partial<User>) => request<User>('/users/me', { method: 'PUT', body: data }),
};

// ─── Properties ─────────────────────────────────────────────
export const properties = {
  list: () => request<Property[]>('/properties'),
  create: (data: Partial<Property>) => request<Property>('/properties', { method: 'POST', body: data }),
  get: (id: string) => request<Property>(`/properties/${id}`),
  update: (id: string, data: Partial<Property>) =>
    request<Property>(`/properties/${id}`, { method: 'PUT', body: data }),
};

// ─── AC Units ───────────────────────────────────────────────
export const acUnits = {
  list: (propertyId: string) => request<AcUnit[]>(`/properties/${propertyId}/ac-units`),
  create: (propertyId: string, data: Partial<AcUnit>) =>
    request<AcUnit>(`/properties/${propertyId}/ac-units`, { method: 'POST', body: data }),
  update: (acUnitId: string, data: Partial<AcUnit>) =>
    request<AcUnit>(`/ac-units/${acUnitId}`, { method: 'PUT', body: data }),
};

// ─── Installation Requests ──────────────────────────────────
export const installations = {
  create: (data: Record<string, unknown>) =>
    request<InstallationRequest>('/installation-requests', { method: 'POST', body: data }),
  list: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<InstallationRequest[]>(`/installation-requests${query ? `?${query}` : ''}`);
  },
  get: (id: string) => request<InstallationRequest>(`/installation-requests/${id}`),
  getByNumber: (requestNumber: string) =>
    request<InstallationRequest>(`/installation-requests/by-number/${requestNumber}`),
};

// ─── Service Tickets ────────────────────────────────────────
export const tickets = {
  create: (data: Record<string, unknown>) => request<ServiceTicket>('/service-tickets', { method: 'POST', body: data }),
  list: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<ServiceTicket[]>(`/service-tickets${query ? `?${query}` : ''}`);
  },
  get: (ticketNumber: string) => request<ServiceTicket>(`/service-tickets/${ticketNumber}`),
  getSlaStatus: (ticketNumber: string) => request<SlaStatus>(`/service-tickets/${ticketNumber}/sla-status`),
};

// ─── Ticket Actions ─────────────────────────────────────────
export const ticketActions = {
  acknowledge: (ticketNumber: string) =>
    request<ServiceTicket>(`/service-tickets/${ticketNumber}/acknowledge`, { method: 'POST' }),
  assignEngineer: (ticketNumber: string, data: Record<string, unknown>) =>
    request<ServiceTicket>(`/service-tickets/${ticketNumber}/assign-engineer`, { method: 'POST', body: data }),
  dispatchEngineer: (ticketNumber: string, data: Record<string, unknown>) =>
    request<ServiceTicket>(`/service-tickets/${ticketNumber}/dispatch-engineer`, { method: 'POST', body: data }),
  escalate: (ticketNumber: string, data: Record<string, unknown>) =>
    request<ServiceTicket>(`/service-tickets/${ticketNumber}/escalate`, { method: 'POST', body: data }),
  resolve: (ticketNumber: string, data: Record<string, unknown>) =>
    request<ServiceTicket>(`/service-tickets/${ticketNumber}/resolve`, { method: 'POST', body: data }),
  rate: (ticketNumber: string, data: Record<string, unknown>) =>
    request<ServiceTicket>(`/service-tickets/${ticketNumber}/rate`, { method: 'POST', body: data }),
  customerEscalate: (ticketNumber: string, data: Record<string, unknown>) =>
    request<ServiceTicket>(`/service-tickets/${ticketNumber}/customer-escalate`, { method: 'POST', body: data }),
  reschedule: (ticketNumber: string, data: Record<string, unknown>) =>
    request<ServiceTicket>(`/service-tickets/${ticketNumber}/reschedule`, { method: 'POST', body: data }),
  reopen: (ticketNumber: string, data: Record<string, unknown>) =>
    request<ServiceTicket>(`/service-tickets/${ticketNumber}/reopen`, { method: 'POST', body: data }),
};

// ─── Ops Manager (triage + assignment) ──────────────────────
export const ops = {
  inbox: () => request<unknown[]>('/ops/triage/inbox'),
  offer: (ticketOrInstall: { kind: 'INSTALL' | 'TICKET'; id: string }, data: Record<string, unknown>) =>
    request<AssignmentOffer>(
      `/ops/triage/${ticketOrInstall.kind === 'INSTALL' ? 'installs' : 'tickets'}/${ticketOrInstall.id}/offer`,
      { method: 'POST', body: data },
    ),
  offerTicket: (ticketNumber: string, data: Record<string, unknown>) =>
    request<AssignmentOffer>(`/ops/triage/tickets/${ticketNumber}/offer`, { method: 'POST', body: data }),
  offerInstall: (installNumber: string, data: Record<string, unknown>) =>
    request<AssignmentOffer>(`/ops/triage/installs/${installNumber}/offer`, { method: 'POST', body: data }),
};

// ─── Offers (recipient inbox) ───────────────────────────────
export const offers = {
  mine: () => request<AssignmentOffer[]>('/offers/mine'),
  accept: (offerId: string) => request<AssignmentOffer>(`/offers/${offerId}/accept`, { method: 'POST' }),
  decline: (offerId: string, data: Record<string, unknown>) =>
    request<AssignmentOffer>(`/offers/${offerId}/decline`, { method: 'POST', body: data }),
  withdraw: (offerId: string) => request<AssignmentOffer>(`/offers/${offerId}/withdraw`, { method: 'POST' }),
};

// ─── V14 — CRM Dispatch Pool ────────────────────────────────
export const crmPool = {
  list: () => request<CrmPoolResponse>('/crm/pool'),
  pick: (ticketNumber: string) => request<ServiceTicket>(`/crm/pool/${ticketNumber}/pick`, { method: 'POST' }),
  assignTeam: (ticketNumber: string, teamName: string) =>
    request<ServiceTicket>(`/crm/tickets/${ticketNumber}/assign-team`, { method: 'POST', body: { teamName } }),
  assignEngineer: (ticketNumber: string, engineerId: string) =>
    request<ServiceTicket>(`/crm/tickets/${ticketNumber}/assign-engineer`, { method: 'POST', body: { engineerId } }),
  teams: () => request<CrmTeam[]>('/crm/teams'),
  searchCustomers: (q: string) => request<CustomerSearchHit[]>(`/crm/customers/search?q=${encodeURIComponent(q)}`),
  customerProperties: (customerId: string) => request<Property[]>(`/crm/customers/${customerId}/properties`),
  createOnBehalf: (customerId: string, body: Record<string, unknown>) =>
    request<ServiceTicket>(`/crm/tickets/on-behalf/${customerId}`, { method: 'POST', body }),
};

// ─── V14 — Super Admin / Revenue ────────────────────────────
export const adminRevenue = {
  fetch: () => request<AdminRevenueDashboard>('/admin/revenue'),
};

// ─── Service Engineer (mobile dashboard) ────────────────────
export const engineer = {
  dashboard: () => request<unknown>('/engineer/dashboard'),
  myJobs: () => request<ServiceTicket[]>('/engineer/my-jobs'),
  enRoute: (ticketNumber: string, data?: Record<string, unknown>) =>
    request<ServiceTicket>(`/engineer/tickets/${ticketNumber}/en-route`, { method: 'POST', body: data || {} }),
  onSite: (ticketNumber: string, data?: Record<string, unknown>) =>
    request<ServiceTicket>(`/engineer/tickets/${ticketNumber}/on-site`, { method: 'POST', body: data || {} }),
  inProgress: (ticketNumber: string, data?: Record<string, unknown>) =>
    request<ServiceTicket>(`/engineer/tickets/${ticketNumber}/in-progress`, { method: 'POST', body: data || {} }),
  cannotAttend: (ticketNumber: string, data: Record<string, unknown>) =>
    request<ServiceTicket>(`/engineer/tickets/${ticketNumber}/cannot-attend`, { method: 'POST', body: data }),
  needHelp: (ticketNumber: string, data: Record<string, unknown>) =>
    request<ServiceTicket>(`/engineer/tickets/${ticketNumber}/need-help`, { method: 'POST', body: data }),
};

// ─── Part Requests ──────────────────────────────────────────
export const parts = {
  forTicket: (ticketNumber: string) => request<PartRequest[]>(`/service-tickets/${ticketNumber}/parts`),
  raise: (ticketNumber: string, data: Record<string, unknown>) =>
    request<PartRequest>(`/service-tickets/${ticketNumber}/parts`, { method: 'POST', body: data }),
  approve: (partId: string) => request<PartRequest>(`/parts/${partId}/approve`, { method: 'POST' }),
  reject: (partId: string, reason?: string) =>
    request<PartRequest>(`/parts/${partId}/reject${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`, {
      method: 'POST',
    }),
  markOrdered: (partId: string, data?: Record<string, unknown>) =>
    request<PartRequest>(`/parts/${partId}/ordered`, { method: 'POST', body: data || {} }),
  markDelivered: (partId: string) => request<PartRequest>(`/parts/${partId}/delivered`, { method: 'POST' }),
  markInstalled: (partId: string) => request<PartRequest>(`/parts/${partId}/installed`, { method: 'POST' }),
  queue: () => request<PartRequest[]>('/parts/queue'),
  mine: () => request<PartRequest[]>('/parts/mine'),
};

// ─── Quotes ─────────────────────────────────────────────────
export const quotes = {
  draft: (data: Record<string, unknown>) => request<Quote>('/quotes', { method: 'POST', body: data }),
  revise: (quoteNumber: string, data: Record<string, unknown>) =>
    request<Quote>(`/quotes/${quoteNumber}/revise`, { method: 'POST', body: data }),
  submit: (quoteNumber: string) => request<Quote>(`/quotes/${quoteNumber}/submit`, { method: 'POST' }),
  approve: (quoteNumber: string) => request<Quote>(`/quotes/${quoteNumber}/approve`, { method: 'POST' }),
  reject: (quoteNumber: string, reason?: string) =>
    request<Quote>(`/quotes/${quoteNumber}/reject${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`, {
      method: 'POST',
    }),
  send: (quoteNumber: string) => request<Quote>(`/quotes/${quoteNumber}/send`, { method: 'POST' }),
  customerDecision: (quoteNumber: string, data: Record<string, unknown>) =>
    request<Quote>(`/quotes/${quoteNumber}/customer-decision`, { method: 'POST', body: data }),
  get: (quoteNumber: string) => request<Quote>(`/quotes/${quoteNumber}`),
  queue: () => request<Quote[]>('/quotes/queue'),
  mine: () => request<Quote[]>('/quotes/mine'),
  forInstall: (installId: string) => request<Quote[]>(`/quotes/install/${installId}`),
  forTicket: (ticketId: string) => request<Quote[]>(`/quotes/ticket/${ticketId}`),
};

// ─── Staff (shift toggle) ───────────────────────────────────
export const staff = {
  toggleShift: (data: Record<string, unknown>) => request<User>('/staff/me/shift', { method: 'PUT', body: data }),
};

// ─── AMC ────────────────────────────────────────────────────
export const amc = {
  myContracts: () => request<AmcContract[]>('/amc/my-contracts'),
  getContract: (id: string) => request<AmcContract>(`/amc/contracts/${id}`),
  scheduleVisit: (visitId: string, data: Record<string, unknown>) =>
    request<AmcContract>(`/amc/visits/${visitId}/schedule`, { method: 'POST', body: data }),
};

// ─── Dashboard ──────────────────────────────────────────────
export const dashboard = {
  customer: () => request<DashboardStats>('/dashboard/customer'),
  crm: () => request<CrmDashboardResponse>('/dashboard/crm'),
  ops: () => request<unknown>('/dashboard/ops'),
  escalation: () => request<EscalationDashboardResponse>('/dashboard/escalation'),
};

// ─── Workload boards ────────────────────────────────────────
export const workload = {
  engineers: () => request<EngineerAvailability[]>('/ops/workload/engineers'),
  crm: () => request<unknown[]>('/ops/workload/crm'),
};

// ─── Maps (route helper, etc.) ──────────────────────────────
export const maps = {
  route: (ticketNumber: string) => request<TicketRoute>(`/maps/route/${ticketNumber}`),
  // GET /maps/static — Static Maps thumbnail proxy (raw PNG, auth required).
  // Returns a URL, not a fetch() call: callers pass it straight into an
  // <Image source={{ uri, headers: { Authorization: `Bearer ${getToken()}` } }} />
  // since the endpoint isn't behind the JSON envelope.
  staticUrl: (lat: number, lng: number, opts: { zoom?: number; w?: number; h?: number } = {}) => {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (opts.zoom !== undefined) params.set('zoom', String(opts.zoom));
    if (opts.w !== undefined) params.set('w', String(opts.w));
    if (opts.h !== undefined) params.set('h', String(opts.h));
    return `${API_BASE}/maps/static?${params.toString()}`;
  },
};

// ─── Slot availability (BookMyShow-style day / slot picker feed) ─
export const slots = {
  availability: ({ from, days = 14 }: { from?: string; days?: number } = {}) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    params.set('days', String(days));
    return request<SlotAvailability>(`/slots/availability?${params.toString()}`);
  },
};

// ─── Pricing (dynamic service charge calculator) ────────────
export const pricing = {
  quote: ({ acType, lat, lng, couponCode }: { acType: string; lat: number; lng: number; couponCode?: string }) => {
    const params = new URLSearchParams({ acType, lat: String(lat), lng: String(lng) });
    if (couponCode) params.set('couponCode', couponCode);
    return request<PriceQuote>(`/pricing/quote?${params.toString()}`);
  },
};

// ─── Payments (mock gateway today, real later) ──────────────
export const payments = {
  createIntent: (body: Record<string, unknown>) =>
    request<PaymentIntent>('/payments/intent', { method: 'POST', body }),
  confirm: (paymentId: string, body: Record<string, unknown>) =>
    request<PaymentConfirmation>(`/payments/${paymentId}/confirm`, { method: 'POST', body }),
  get: (paymentId: string) => request<Payment>(`/payments/${paymentId}`),
};

// ─── Discount Coupons (admin) ───────────────────────────────
export const coupons = {
  list: () => request<DiscountCoupon[]>('/admin/coupons'),
  create: (body: Record<string, unknown>) => request<DiscountCoupon>('/admin/coupons', { method: 'POST', body }),
  toggle: (id: string) => request<DiscountCoupon>(`/admin/coupons/${id}/toggle`, { method: 'POST' }),
  remove: (id: string) => request<void>(`/admin/coupons/${id}`, { method: 'DELETE' }),
};

// ─── AMC Upgrade Requests ───────────────────────────────────
export const amcUpgrades = {
  create: (body: Record<string, unknown>) => request<unknown>('/amc-upgrades', { method: 'POST', body }),
  mine: () => request<unknown[]>('/amc-upgrades/mine'),
  open: () => request<unknown[]>('/amc-upgrades/open'),
  assign: (id: string, crmId: string) =>
    request<unknown>(`/amc-upgrades/${id}/assign`, { method: 'POST', body: { crmId } }),
  contacted: (id: string) => request<unknown>(`/amc-upgrades/${id}/contacted`, { method: 'POST' }),
  cancel: (id: string, reason: string) =>
    request<unknown>(`/amc-upgrades/${id}/cancel`, { method: 'POST', body: { reason } }),
};

// ─── Notifications ──────────────────────────────────────────
export const notifications = {
  list: (limit = 50) => request<Notification[]>(`/notifications?limit=${limit}`),
  unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => request<Notification>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => request<void>('/notifications/read-all', { method: 'POST' }),
};

// ─── Mobile-only: device push tokens (Phase B3) ──────────────
export const devices = {
  register: (token: string, platform: 'ios' | 'android', deviceName?: string, appVersion?: string) =>
    request<DeviceRegistrationResult>('/devices/register', {
      method: 'POST',
      body: { token, platform, deviceName, appVersion },
    }),
  unregister: (token: string) => request<{ removed: true }>(`/devices/${token}`, { method: 'DELETE' }),
};

// ─── Mobile-only: image uploads (Phase B4) ───────────────────
// RN's fetch FormData expects { uri, name, type } file objects, not Blobs.
// Content-Type is intentionally left unset so fetch generates the
// multipart boundary itself.
export type RNFile = { uri: string; name: string; type: string };

export const uploads = {
  images: (files: RNFile[]) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file as unknown as Blob);
    });
    return request<UploadResult>('/uploads', { method: 'POST', body: formData });
  },
};

// ─── Mobile-only: app config / kill switch (Phase B...) ──────
export const appMeta = {
  config: (platform: 'ios' | 'android', version: string) =>
    request<AppConfig>(`/app/config?platform=${platform}&version=${encodeURIComponent(version)}`, {
      skipAuth: true,
    }),
};

// ─── Mobile-only: Google Places/Geocoding proxy (Phase B5) ───
export const mapsProxy = {
  autocomplete: (q: string, sessionToken?: string, lat?: number, lng?: number) => {
    const params = new URLSearchParams({ q });
    if (sessionToken) params.set('sessionToken', sessionToken);
    if (lat !== undefined) params.set('lat', String(lat));
    if (lng !== undefined) params.set('lng', String(lng));
    return request<AutocompleteResult>(`/maps/autocomplete?${params.toString()}`);
  },
  place: (placeId: string, sessionToken?: string) => {
    const params = new URLSearchParams();
    if (sessionToken) params.set('sessionToken', sessionToken);
    const query = params.toString();
    return request<PlaceDetails>(`/maps/place/${placeId}${query ? `?${query}` : ''}`);
  },
  reverseGeocode: (lat: number, lng: number) =>
    request<PlaceDetails>(`/maps/reverse-geocode?lat=${lat}&lng=${lng}`),
};

// Re-exported so callers building slot-availability UIs don't need to
// import TimeSlot from two different modules.
export type { TimeSlot };
