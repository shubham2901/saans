import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from '../services/storageService';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface LocationState {
  lat: number | null;
  lng: number | null;
  city: string | null;
  subArea: string | null; // neighbourhood / district (e.g. "Indiranagar")
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
      // 1. Return cached location immediately if still fresh (30 min TTL)
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

      // 2. Request foreground permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      const permissionStatus: PermissionStatus =
        status === 'granted' ? 'granted'
        : status === 'denied' ? 'denied'
        : 'undetermined';

      if (status !== 'granted') {
        if (!cancelled) {
          setState({
            lat: null,
            lng: null,
            city: null,
            subArea: null,
            permissionStatus,
            loading: false,
            error: 'Location permission denied. Enable it in Settings to get local AQI.',
          });
        }
        return;
      }

      // 3. Get current GPS position
      let position: Location.LocationObject;
      try {
        position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch {
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

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // 4. Reverse geocode to get city + neighbourhood
      let city    = 'Unknown';
      let subArea: string | null = null;
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });

        // City: most specific populated locality name
        city =
          place?.city ??
          place?.district ??
          place?.subregion ??
          place?.region ??
          'Unknown';

        // Sub-area: neighbourhood / district (must differ from city to be useful)
        const rawSubArea = place?.district ?? place?.subregion ?? null;
        subArea = rawSubArea && rawSubArea !== city ? rawSubArea : null;
      } catch {
        // Non-fatal — city remains 'Unknown', subArea null
      }

      // 5. Cache result for 30 minutes
      await setCache<CachedLocation>(
        CACHE_KEYS.LOCATION,
        { lat, lng, city, subArea },
        CACHE_TTL.LOCATION,
      );

      if (!cancelled) {
        setState({
          lat,
          lng,
          city,
          subArea,
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
