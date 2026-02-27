import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from '../services/storageService';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface LocationState {
  lat: number | null;
  lng: number | null;
  city: string | null;
  subArea: string | null;
  permissionStatus: PermissionStatus;
  loading: boolean;
  error: string | null;
}

interface CachedLocation {
  lat: number;
  lng: number;
  city: string;
  subArea: string | null;
}

// GPS timeout — if the emulator / device can't get a fix within this many ms,
// fall through to the IP-geolocation fallback.
const GPS_TIMEOUT_MS = 8_000;

async function resolveByGPS(): Promise<{ lat: number; lng: number } | null> {
  try {
    const position = await Promise.race<Location.LocationObject | null>([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), GPS_TIMEOUT_MS)),
    ]);
    if (!position) return null;
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch {
    return null;
  }
}

async function resolveByIP(): Promise<{ lat: number; lng: number; city: string } | null> {
  // Try ipapi.co first
  try {
    const res  = await fetch('https://ipapi.co/json/');
    const data = await res.json() as {
      latitude?: number; longitude?: number; city?: string; error?: boolean;
    };
    if (!data.error && data.latitude && data.longitude) {
      return {
        lat:  data.latitude,
        lng:  data.longitude,
        city: data.city ?? 'Unknown',
      };
    }
  } catch {
    // fall through to secondary
  }

  // Secondary: ip-api.com (45 req/min, no key, works on emulators)
  try {
    const res  = await fetch('https://ip-api.com/json/');
    const data = await res.json() as {
      status?: string; lat?: number; lon?: number; city?: string;
    };
    if (data.status === 'success' && data.lat && data.lon) {
      return {
        lat:  data.lat,
        lng:  data.lon,
        city: data.city ?? 'Unknown',
      };
    }
  } catch {
    // both failed
  }

  return null;
}

export function useLocation() {
  const [state, setState] = useState<LocationState>({
    lat: null,
    lng: null,
    city: null,
    subArea: null,
    permissionStatus: 'undetermined',
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      // ── 1. Return cached location immediately if still fresh (30 min TTL) ──
      const cached = await getCache<CachedLocation>(CACHE_KEYS.LOCATION);
      if (cached && !cancelled) {
        setState({
          lat: cached.lat,
          lng: cached.lng,
          city: cached.city,
          subArea: cached.subArea ?? null,
          permissionStatus: 'granted',
          loading: false,
          error: null,
        });
        return;
      }

      // ── 2. Request foreground permission ────────────────────────────────────
      const { status } = await Location.requestForegroundPermissionsAsync();
      const permissionStatus: PermissionStatus =
        status === 'granted' ? 'granted'
        : status === 'denied'  ? 'denied'
        : 'undetermined';

      if (status !== 'granted') {
        // Permission denied — try silent IP fallback (no permission needed)
        const ipResult = await resolveByIP();
        if (ipResult && !cancelled) {
          const locData = { lat: ipResult.lat, lng: ipResult.lng, city: ipResult.city, subArea: null };
          await setCache<CachedLocation>(CACHE_KEYS.LOCATION, locData, CACHE_TTL.LOCATION);
          // Treat IP fallback as 'granted' so AQI loading is enabled
          setState({ ...locData, permissionStatus: 'granted', loading: false, error: null });
        } else if (!cancelled) {
          setState({
            lat: null, lng: null, city: null, subArea: null,
            permissionStatus,
            loading: false,
            error: 'Location permission denied. Enable it in Settings to get local AQI.',
          });
        }
        return;
      }

      // ── 3. Try GPS (with timeout) ────────────────────────────────────────────
      const gpsResult = await resolveByGPS();

      let lat: number;
      let lng: number;
      let city    = 'Unknown';
      let subArea: string | null = null;

      if (gpsResult) {
        lat = gpsResult.lat;
        lng = gpsResult.lng;

        // ── 4. Reverse geocode ────────────────────────────────────────────────
        try {
          const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          city =
            place?.city ??
            place?.district ??
            place?.subregion ??
            place?.region ??
            'Unknown';
          const rawSubArea = place?.district ?? place?.subregion ?? null;
          subArea = rawSubArea && rawSubArea !== city ? rawSubArea : null;
        } catch {
          // non-fatal — city stays 'Unknown'
        }
      } else {
        // ── 5. GPS failed / timed out → fall back to IP geolocation ──────────
        const ipResult = await resolveByIP();
        if (!ipResult) {
          if (!cancelled) {
            setState((prev) => ({
              ...prev,
              permissionStatus: 'granted',
              loading: false,
              error: 'Could not determine your location. Try again.',
            }));
          }
          return;
        }
        lat    = ipResult.lat;
        lng    = ipResult.lng;
        city   = ipResult.city;
        subArea = null;
      }

      // ── 6. Cache result for 30 minutes ──────────────────────────────────────
      const locData = { lat, lng, city, subArea };
      await setCache<CachedLocation>(CACHE_KEYS.LOCATION, locData, CACHE_TTL.LOCATION);

      if (!cancelled) {
        setState({
          ...locData,
          permissionStatus: 'granted',
          loading: false,
          error: null,
        });
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, []);

  return state;
}
