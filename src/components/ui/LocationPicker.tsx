import React, {
  forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Pressable, TextInput, View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import {
  AlertCircle, Check, Crosshair, Home, MapPin, Phone, Search,
} from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text, Sheet, SheetRef, Spinner } from '@/components/primitives';
import { radius, space } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { mapsProxy } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import type { AutocompleteSuggestion } from '@/types/api';

// REWRITE, not a port, of ../../aes-frontend/src/components/ui/LocationPicker.js
// (556 lines). The web version drives the BROWSER Google Maps JS SDK via a
// referrer-restricted key — none of that exists on mobile, and bundling a
// Maps key in an APK/IPA lets anyone extract it and bill the GCP account.
// This version talks ONLY to our backend Places proxy (mapsProxy in
// src/lib/api.ts, added in backend fix-pack Phase B5) and holds no key.
//
// THIS FILE IS NATIVE-ONLY. `react-native-maps` has no react-native-web
// implementation — merely importing it (even without rendering <MapView>)
// throws `codegenNativeComponent is not a function` at module-evaluation
// time in a web bundle. `LocationPicker.web.tsx` is the platform-specific
// sibling Metro picks automatically for `expo start --web` / EAS web
// builds; it duplicates this file with a static preview instead of a real
// map. Keep both in sync when changing anything other than the map itself.
//
// A single sessionToken is generated per picking session and reused across
// every keystroke, then discarded after /maps/place — this is how Google
// bills autocomplete as one session instead of one per keystroke (the
// difference between a $2 bill and a $200 bill; do not skip it).

// AES head office — Hyderabad · Banjara Hills. Used as the initial map
// centre when the caller hasn't provided one, and to detect the
// placeholder-address fallback below.
const DEFAULT_CENTER = { lat: 17.4156, lng: 78.4347 };

function uuidv4(): string {
  // No crypto.randomUUID guarantee across RN/Hermes versions and no `uuid`
  // dependency in this app — Google only requires the session token to be
  // unique per autocomplete session, not cryptographically secure.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Ported verbatim from the ticket wizard (page.js line 38). Pricing (P3)
 * depends on this exact logic — do not change the tolerance or the string
 * checks without re-checking the pricing quote effect that gates on it.
 */
export function isPlaceholderAddress(p?: {
  latitude?: number | null;
  longitude?: number | null;
  formattedAddress?: string | null;
  addressLine1?: string | null;
} | null): boolean {
  if (!p) return true;
  const { latitude: lat, longitude: lng } = p;
  if (lat == null || lng == null) return true;
  const isOfficeDefault = Math.abs(lat - DEFAULT_CENTER.lat) < 0.0001
    && Math.abs(lng - DEFAULT_CENTER.lng) < 0.0001;
  const addr = (p.formattedAddress || p.addressLine1 || '').trim().toLowerCase();
  const looksPlaceholder = !addr || addr === 'address' || addr.startsWith('address,');
  return isOfficeDefault || looksPlaceholder;
}

export interface LocationPickerResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  googlePlaceId: string | null;
  landmark: string;
  secondaryPhone: string;
  city: string;
  state: string;
  pincode: string;
}

export interface LocationPickerInitial {
  lat?: number;
  lng?: number;
  formattedAddress?: string;
  landmark?: string;
  secondaryPhone?: string;
}

export interface LocationPickerRef {
  present: () => void;
  dismiss: () => void;
}

export interface LocationPickerProps {
  initial?: LocationPickerInitial;
  onSave: (result: LocationPickerResult) => void;
  saving?: boolean;
}

export const LocationPicker = forwardRef<LocationPickerRef, LocationPickerProps>(function LocationPicker({
  initial, onSave, saving = false,
}, ref) {
  const { tokens } = useTheme();
  const toast = useToast();
  const sheetRef = useRef<SheetRef>(null);
  const mapRef = useRef<MapView>(null);
  const sessionToken = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  const [center, setCenter] = useState(
    initial?.lat && initial?.lng ? { lat: initial.lat, lng: initial.lng } : DEFAULT_CENTER,
  );
  const [formattedAddress, setFormattedAddress] = useState(initial?.formattedAddress || '');
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [landmark, setLandmark] = useState(initial?.landmark || '');
  const [phone, setPhone] = useState(initial?.secondaryPhone || '');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  useImperativeHandle(ref, () => ({
    present: () => {
      sessionToken.current = uuidv4();
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }), []);

  const ensureToken = () => {
    if (!sessionToken.current) sessionToken.current = uuidv4();
    return sessionToken.current;
  };

  const runSearch = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const seq = ++searchSeq.current;
      try {
        const res = await mapsProxy.autocomplete(text, ensureToken(), center.lat, center.lng);
        if (seq === searchSeq.current) setSuggestions(res.suggestions || []);
      } catch {
        if (seq === searchSeq.current) setSuggestions([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
  }, [center]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const applyPlace = (place: { lat: number; lng: number; formattedAddress: string; city: string; state: string; pincode: string }, gPlaceId: string | null) => {
    setCenter({ lat: place.lat, lng: place.lng });
    setFormattedAddress(place.formattedAddress);
    setCity(place.city);
    setState(place.state);
    setPincode(place.pincode);
    setPlaceId(gPlaceId);
    mapRef.current?.animateToRegion({
      latitude: place.lat, longitude: place.lng, latitudeDelta: 0.01, longitudeDelta: 0.01,
    }, 400);
  };

  const pickSuggestion = async (s: AutocompleteSuggestion) => {
    setQuery('');
    setSuggestions([]);
    setResolving(true);
    try {
      const detail = await mapsProxy.place(s.placeId, sessionToken.current || undefined);
      applyPlace(detail, detail.placeId);
    } catch {
      toast.error('Could not load that address — try again.');
    } finally {
      setResolving(false);
      sessionToken.current = null; // session ends once a place is resolved
    }
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    setLocationDenied(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationDenied(true);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      setResolving(true);
      const detail = await mapsProxy.reverseGeocode(latitude, longitude);
      applyPlace(detail, detail.placeId);
    } catch {
      toast.error('Could not detect your location — pick it on the map instead.');
    } finally {
      setLocating(false);
      setResolving(false);
    }
  };

  const onDragEnd = async (region: Region) => {
    const { latitude, longitude } = region;
    setCenter({ lat: latitude, lng: longitude });
    setResolving(true);
    try {
      const detail = await mapsProxy.reverseGeocode(latitude, longitude);
      setFormattedAddress(detail.formattedAddress);
      setCity(detail.city);
      setState(detail.state);
      setPincode(detail.pincode);
      setPlaceId(detail.placeId);
    } catch {
      toast.error('Could not resolve that location — try again.');
    } finally {
      setResolving(false);
    }
  };

  const handleSave = () => {
    onSave({
      lat: center.lat,
      lng: center.lng,
      formattedAddress,
      googlePlaceId: placeId,
      landmark,
      secondaryPhone: phone,
      city,
      state,
      pincode,
    });
  };

  const placeholderState = isPlaceholderAddress({
    latitude: center.lat, longitude: center.lng, formattedAddress,
  });

  return (
    <Sheet ref={sheetRef} title="Set your address" snapPoints={['92%']}>
      <View style={{ paddingHorizontal: space[4], gap: space[3] }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: tokens.colors.borderLight, borderRadius: radius.md, paddingHorizontal: space[3], backgroundColor: tokens.colors.surfaceContainerLow,
        }}
        >
          <Search size={16} color={tokens.colors.onSurfaceVariant} />
          <TextInput
            value={query}
            onChangeText={(t) => { setQuery(t); runSearch(t); }}
            placeholder="Search for area, street, landmark…"
            placeholderTextColor={tokens.colors.onSurfaceVariant}
            style={{
              flex: 1, paddingVertical: 12, fontSize: 14, color: tokens.colors.onSurface,
            }}
          />
          {searching && <ActivityIndicator size="small" color={tokens.colors.secondary} />}
        </View>

        {suggestions.length > 0 && (
          <View style={{
            borderWidth: 1, borderColor: tokens.colors.outlineVariant, borderRadius: radius.md, overflow: 'hidden',
          }}
          >
            {suggestions.map((s) => (
              <Pressable
                key={s.placeId}
                onPress={() => pickSuggestion(s)}
                style={{
                  flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: space[3], borderBottomWidth: 1, borderBottomColor: tokens.colors.outlineVariant,
                }}
              >
                <MapPin size={16} color={tokens.colors.onSurfaceVariant} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: font('body', 600), color: tokens.colors.onSurface }}>
                    {s.primaryText}
                  </Text>
                  {s.secondaryText ? (
                    <Text style={{ fontSize: 12, color: tokens.colors.onSurfaceVariant }}>{s.secondaryText}</Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          onPress={useCurrentLocation}
          disabled={locating}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: tokens.colors.surfaceContainer,
          }}
        >
          {locating ? <Spinner size="sm" /> : <Crosshair size={15} color={tokens.colors.secondaryInk} />}
          <Text style={{ fontSize: 13, fontFamily: font('body', 600), color: tokens.colors.secondaryInk }}>
            Use my current location
          </Text>
        </Pressable>

        {locationDenied && (
          <View style={{
            flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: radius.sm, backgroundColor: tokens.colors.errorContainer,
          }}
          >
            <AlertCircle size={14} color={tokens.colors.error} style={{ marginTop: 2 }} />
            <Text style={{ flex: 1, fontSize: 12, color: tokens.colors.error }}>
              Location permission denied — search or drag the pin on the map instead.
            </Text>
          </View>
        )}

        <View style={{
          height: 220, borderRadius: radius.md, overflow: 'hidden', position: 'relative',
        }}
        >
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: center.lat, longitude: center.lng, latitudeDelta: 0.01, longitudeDelta: 0.01,
            }}
          >
            <Marker
              coordinate={{ latitude: center.lat, longitude: center.lng }}
              draggable
              onDragEnd={(e) => onDragEnd({
                latitude: e.nativeEvent.coordinate.latitude,
                longitude: e.nativeEvent.coordinate.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              })}
            />
          </MapView>
          {resolving && (
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.15)',
            }}
            >
              <Spinner size="md" />
            </View>
          )}
        </View>

        <View>
          <Text style={{ fontSize: 12, fontFamily: font('body', 600), color: tokens.colors.onSurfaceVariant, marginBottom: 4 }}>
            Address
          </Text>
          <Text style={{ fontSize: 14, color: tokens.colors.onSurface, lineHeight: 20 }}>
            {formattedAddress || 'Search, use your location, or drag the pin to set an address.'}
          </Text>
        </View>

        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: tokens.colors.borderLight, borderRadius: radius.md, paddingHorizontal: space[3], backgroundColor: tokens.colors.surfaceContainerLow,
        }}
        >
          <Home size={16} color={tokens.colors.onSurfaceVariant} />
          <TextInput
            value={landmark}
            onChangeText={setLandmark}
            placeholder="Landmark (optional)"
            placeholderTextColor={tokens.colors.onSurfaceVariant}
            style={{
              flex: 1, paddingVertical: 12, fontSize: 14, color: tokens.colors.onSurface,
            }}
          />
        </View>

        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: tokens.colors.borderLight, borderRadius: radius.md, paddingHorizontal: space[3], backgroundColor: tokens.colors.surfaceContainerLow,
        }}
        >
          <Phone size={16} color={tokens.colors.onSurfaceVariant} />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Alternate phone (optional)"
            placeholderTextColor={tokens.colors.onSurfaceVariant}
            keyboardType="phone-pad"
            style={{
              flex: 1, paddingVertical: 12, fontSize: 14, color: tokens.colors.onSurface,
            }}
          />
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving || placeholderState}
          style={{
            marginTop: space[2],
            marginBottom: space[6],
            paddingVertical: 14,
            borderRadius: radius.md,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: (saving || placeholderState) ? tokens.colors.surfaceContainerHigh : tokens.colors.secondary,
          }}
        >
          {saving ? <Spinner size="sm" /> : <Check size={18} color={tokens.colors.onSecondary} />}
          <Text style={{
            fontSize: 15, fontFamily: font('body', 700), color: (saving || placeholderState) ? tokens.colors.onSurfaceVariant : tokens.colors.onSecondary,
          }}
          >
            Save address
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
});

