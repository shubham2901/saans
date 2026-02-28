import { useState, useEffect, useCallback, useRef } from 'react';
import { AQIData, HourlyForecast } from '../types';
import { fetchCurrentAQI, fetchHourlyForecast } from '../services/aqiService';
import {
  getCache,
  setCache,
  CACHE_KEYS,
  CACHE_TTL,
  storeDailyReading,
  saveLastKnownAQI,
  getProfiles,
} from '../services/storageService';
import { getAQIStatus } from '../constants/colors';
import { scheduleNotificationsFirstTime } from '../services/notificationService';
import { setWidgetData } from '../services/widgetService';
import { getHardcodedGuidance } from '../constants/thresholds';

interface UseAQIInput {
  lat: number | null;
  lng: number | null;
  enabled: boolean;
  city?: string | null; // passed to aqiService for smarter station selection
}

interface UseAQIResult {
  current: AQIData | null;
  forecast: HourlyForecast[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useAQI({ lat, lng, enabled, city }: UseAQIInput): UseAQIResult {
  const [current, setCurrent] = useState<AQIData | null>(null);
  const [forecast, setForecast] = useState<HourlyForecast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tracks whether we've already seeded from cache so we don't
  // flash a loading spinner when the app reopens within the TTL window.
  const hasCachedData = useRef(false);

  const load = useCallback(
    async (bust = false) => {
      if (!enabled || lat === null || lng === null) return;

      const aqiKey = CACHE_KEYS.CURRENT_AQI(lat, lng);
      const forecastKey = CACHE_KEYS.HOURLY_FORECAST(lat, lng);

      // ── 1. Show cached data immediately ──────────────────────────────────────
      if (!bust) {
        const [cachedAqi, cachedForecast] = await Promise.all([
          getCache<AQIData>(aqiKey),
          getCache<HourlyForecast[]>(forecastKey),
        ]);

        if (cachedAqi) {
          // Dates are serialised as strings in AsyncStorage — rehydrate
          cachedAqi.updatedAt = new Date(cachedAqi.updatedAt);
          setCurrent(cachedAqi);
          hasCachedData.current = true;
        }
        if (cachedForecast) {
          setForecast(cachedForecast);
        }

        // If we have both cached results, show them without a spinner
        if (cachedAqi && cachedForecast) {
          setLoading(false);
          setError(null);
        }
      }

      // ── 2. Fetch fresh data in the background ─────────────────────────────────
      if (!hasCachedData.current || bust) {
        setLoading(true);
      }

      try {
        const [freshAqi, freshForecast] = await Promise.all([
          fetchCurrentAQI(lat, lng, city ?? undefined),
          fetchHourlyForecast(lat, lng),
        ]);

        // ── 3a. Handle AQI result ───────────────────────────────────────────────
        if (freshAqi) {
          await setCache(aqiKey, freshAqi, CACHE_TTL.CURRENT_AQI);
          setCurrent(freshAqi);
          setError(null);

          await storeDailyReading({
            date: todayISO(),
            aqi: freshAqi.aqi,
            status: getAQIStatus(freshAqi.aqi),
          });

          const knownCity = freshAqi.city || freshAqi.stationName || 'your city';
          await saveLastKnownAQI(freshAqi.aqi, knownCity);

          const profiles = await getProfiles();

          // Notifications are best-effort — never let scheduling errors abort the AQI data flow
          try {
            await scheduleNotificationsFirstTime(knownCity, profiles);
          } catch (notifErr) {
            console.log('Notification scheduling skipped (non-fatal):', notifErr);
          }

          // Update Android home screen widget (no-op on iOS / Expo Go)
          const widgetGuidance = getHardcodedGuidance(freshAqi.aqi, profiles);
          setWidgetData(freshAqi.aqi, knownCity, widgetGuidance);
        } else if (!hasCachedData.current) {
          setError('Could not load air data');
        }

        // ── 3b. Handle forecast result ──────────────────────────────────────────
        if (freshForecast.length > 0) {
          if (freshAqi) {
            const diff = freshAqi.aqi - freshForecast[0].aqi;
            freshForecast.forEach((f, i) => {
              const decay = Math.max(0, 1 - i / 8);
              f.aqi = Math.max(0, Math.round(f.aqi + diff * decay));
            });
            freshForecast[0].dominantPollutant = freshAqi.dominantPollutant;
          }
          await setCache(forecastKey, freshForecast, CACHE_TTL.HOURLY_FORECAST);
          setForecast(freshForecast);
        }

        hasCachedData.current = hasCachedData.current || freshAqi !== null;
      } catch (e) {
        console.log('useAQI fetch error:', e);
        if (!hasCachedData.current) setError('Could not load air data');
      } finally {
        setLoading(false);
      }
    },
    [lat, lng, enabled, city],
  );

  // Initial load
  useEffect(() => {
    hasCachedData.current = false;
    load(false);
  }, [load]);

  // refresh() busts the cache and re-fetches
  const refresh = useCallback(() => {
    hasCachedData.current = false;
    load(true);
  }, [load]);

  return { current, forecast, loading, error, refresh };
}
