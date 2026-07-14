import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';

import { getJson, setJson, removeItem, INSTALL_DRAFT_KEY } from '@/lib/storage';

// Ported from ../../aes-frontend/src/store/installationStore.js.
// sessionStorage → AsyncStorage. Hydrate on mount, gate persistence on a
// `hydrated` flag — otherwise the empty DEFAULT_STATE overwrites the saved
// draft on the very first render, before AsyncStorage has resolved.

/** Steps in the install wizard. */
export const INSTALL_STEPS = [
  { key: 'space', label: 'Space' },
  { key: 'ac-type', label: 'AC Type' },
  { key: 'brand', label: 'Brand & Model' },
  { key: 'property', label: 'Property & Rooms' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'success', label: 'Done' },
] as const;

export interface InstallRoom {
  roomType: string;
  sizeSqft: string;
  acType: string;
}

const EMPTY_ROOM: InstallRoom = { roomType: 'Master Bedroom', sizeSqft: '', acType: '' };

export interface InstallState {
  buildingType: string;
  acType: string;
  brand: string;
  modelNumber: string;
  tonnage: string;
  energyRating: number;
  propertyId: string | null;
  propertyAddress: string;
  rooms: InstallRoom[];
  notes: string;
  scheduledDate: string;
  scheduledSlot: string;
}

const DEFAULT_STATE: InstallState = {
  buildingType: '',
  acType: '',
  brand: '',
  modelNumber: '',
  tonnage: '1.5',
  energyRating: 5,
  propertyId: null,
  propertyAddress: '',
  rooms: [EMPTY_ROOM],
  notes: '',
  scheduledDate: '',
  scheduledSlot: 'MORNING',
};

interface InstallContextValue {
  state: InstallState;
  hydrated: boolean;
  set: (patch: Partial<InstallState>) => void;
  reset: () => void;
  addRoom: (acType?: string) => void;
  updateRoom: (index: number, patch: Partial<InstallRoom>) => void;
  removeRoom: (index: number) => void;
}

const InstallContext = createContext<InstallContextValue | undefined>(undefined);

export function InstallationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<InstallState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from AsyncStorage so accidentally closing the app does not lose the draft.
  useEffect(() => {
    let cancelled = false;
    getJson<InstallState>(INSTALL_DRAFT_KEY)
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
    setJson(INSTALL_DRAFT_KEY, state).catch(() => {});
  }, [state, hydrated]);

  const set = useCallback((patch: Partial<InstallState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
    removeItem(INSTALL_DRAFT_KEY).catch(() => {});
  }, []);

  const addRoom = useCallback((acType?: string) => {
    setState((prev) => ({
      ...prev,
      rooms: [
        ...prev.rooms,
        { roomType: 'Bedroom', sizeSqft: '', acType: acType || prev.acType || '' },
      ],
    }));
  }, []);

  const updateRoom = useCallback((index: number, patch: Partial<InstallRoom>) => {
    setState((prev) => {
      const rooms = prev.rooms.map((r, i) => (i === index ? { ...r, ...patch } : r));
      return { ...prev, rooms };
    });
  }, []);

  const removeRoom = useCallback((index: number) => {
    setState((prev) => {
      if (prev.rooms.length <= 1) return prev;
      const rooms = prev.rooms.filter((_, i) => i !== index);
      return { ...prev, rooms };
    });
  }, []);

  const value = useMemo<InstallContextValue>(() => ({
    state, hydrated, set, reset, addRoom, updateRoom, removeRoom,
  }), [state, hydrated, set, reset, addRoom, updateRoom, removeRoom]);

  return <InstallContext.Provider value={value}>{children}</InstallContext.Provider>;
}

export function useInstall(): InstallContextValue {
  const ctx = useContext(InstallContext);
  if (!ctx) throw new Error('useInstall must be used within InstallationProvider');
  return ctx;
}
