import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';

import { getJson, setJson, removeItem, SERVICE_DRAFT_KEY } from '@/lib/storage';
import type { ServiceStatus } from '@/types/api';

// Ported from ../../aes-frontend/src/store/serviceStore.js.
// sessionStorage → AsyncStorage, same hydrate-before-persist rule as
// installationStore.tsx.

/** Steps in the service-ticket wizard. */
export const SERVICE_STEPS = [
  { key: 'priority', label: 'Priority' },
  { key: 'select-ac', label: 'AC Unit' },
  { key: 'problem', label: 'Problem' },
  { key: 'schedule', label: 'Schedule' },
] as const;

export interface AcUnitMeta {
  roomLabel: string;
  brand?: string;
  modelNumber?: string;
  acType?: string;
  tonnage?: number;
  serviceStatus?: ServiceStatus;
  propertyId?: string;
  propertyLabel?: string;
}

export interface ServiceState {
  // Step 1 — informational priority hint (P1/P2/P3)
  priorityHint: string;
  // Step 2 — selected AC unit (UUID string) + cached metadata for display
  acUnitId: string;
  acUnitMeta: AcUnitMeta | null;
  // Step 3 — problem details
  problemCategory: string;
  errorCode: string;
  duration: string; // 'Today' | '2-3 Days' | 'This Week' | 'Over a Week'
  description: string;
  photoUrls: string[]; // max 4
  // Step 4 — schedule
  scheduledDate: string;
  scheduledSlot: string;
}

const DEFAULT_STATE: ServiceState = {
  priorityHint: '',
  acUnitId: '',
  acUnitMeta: null,
  problemCategory: '',
  errorCode: '',
  duration: '',
  description: '',
  photoUrls: [],
  scheduledDate: '',
  scheduledSlot: 'MORNING',
};

interface ServiceContextValue {
  state: ServiceState;
  hydrated: boolean;
  set: (patch: Partial<ServiceState>) => void;
  reset: () => void;
}

const ServiceContext = createContext<ServiceContextValue | undefined>(undefined);

export function ServiceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ServiceState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getJson<ServiceState>(SERVICE_DRAFT_KEY)
      .then((saved) => {
        if (cancelled) return;
        if (saved) setState({ ...DEFAULT_STATE, ...saved });
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setJson(SERVICE_DRAFT_KEY, state).catch(() => {});
  }, [state, hydrated]);

  const set = useCallback((patch: Partial<ServiceState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
    removeItem(SERVICE_DRAFT_KEY).catch(() => {});
  }, []);

  const value = useMemo<ServiceContextValue>(() => ({
    state, hydrated, set, reset,
  }), [state, hydrated, set, reset]);

  return <ServiceContext.Provider value={value}>{children}</ServiceContext.Provider>;
}

export function useService(): ServiceContextValue {
  const ctx = useContext(ServiceContext);
  if (!ctx) throw new Error('useService must be used within ServiceProvider');
  return ctx;
}

/** Map an AC unit's serviceStatus → priority hint. */
export function priorityFromServiceStatus(serviceStatus?: ServiceStatus | string): string {
  switch (serviceStatus) {
    case 'P1_AMC': return 'P1';
    case 'P2_WARRANTY': return 'P2';
    case 'P3_PAID': return 'P3';
    default: return '';
  }
}

export interface PriorityInfoEntry {
  code: 'P1' | 'P2' | 'P3';
  badge: string;
  headline: string;
  desc: string;
  chips: string[];
  cta: string;
  sla: string;
  chargeNote: string;
  chargeTone: 'success' | 'paid';
  accent: 'amc' | 'warranty' | 'paid';
}

/** Display-friendly priority metadata used across screens. */
export const PRIORITY_INFO: Record<'P1' | 'P2' | 'P3', PriorityInfoEntry> = {
  P1: {
    code: 'P1',
    badge: 'P1 — AMC',
    headline: 'AMC — Annual Maintenance Contract',
    desc: 'You have an active AMC on your registered equipment. This guarantees priority response times and covered routine maintenance.',
    chips: ['4hr Response', 'Zero Callout Fee', 'Parts Covered'],
    cta: 'Check AMC Status',
    sla: '4h SLA',
    chargeNote: '✓ No charges for this service (AMC Covered)',
    chargeTone: 'success',
    accent: 'amc',
  },
  P2: {
    code: 'P2',
    badge: 'P2 — In Warranty',
    headline: 'In Warranty',
    desc: 'Your AC is within its AES manufacturer warranty. Repairs for manufacturing defects are covered free of charge; external damage may not be.',
    chips: ['8hr Response', 'Free Labour', 'Defect Covered'],
    cta: 'Check Warranty',
    sla: '8h SLA',
    chargeNote: '✓ No charges for this service (In Warranty)',
    chargeTone: 'success',
    accent: 'warranty',
  },
  P3: {
    code: 'P3',
    badge: 'P3 — Paid Service',
    headline: 'Paid Service · Warranty Expired',
    desc: 'Service charges apply. Our team confirms the exact amount based on your AC type and location before the visit.',
    chips: ['Starts at ₹750', '+ distance band', 'Pay now, ticket opens after'],
    cta: 'View Service Charges',
    sla: '24h SLA',
    chargeNote: 'Final amount is shown at checkout — base charge by AC type + distance band. Coupons can be applied.',
    chargeTone: 'paid',
    accent: 'paid',
  },
};
