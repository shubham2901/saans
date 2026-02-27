import AsyncStorage from '@react-native-async-storage/async-storage';
import { StoredDayReading, UserProfile } from '../types';

// ─── TTL Cache ────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number | null; // null = never expires
}

export async function setCache<T>(
  key: string,
  data: T,
  ttlMinutes: number | 'permanent',
): Promise<void> {
  const entry: CacheEntry<T> = {
    data,
    expiresAt:
      ttlMinutes === 'permanent'
        ? null
        : Date.now() + ttlMinutes * 60 * 1000,
  };
  await AsyncStorage.setItem(key, JSON.stringify(entry));
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

// ─── Cache TTL constants ──────────────────────────────────────────────────────

export const CACHE_KEYS = {
  CURRENT_AQI:     (lat: number, lng: number) => `aqi_current_${lat.toFixed(3)}_${lng.toFixed(3)}`,
  HOURLY_FORECAST: (lat: number, lng: number) => `aqi_forecast_${lat.toFixed(3)}_${lng.toFixed(3)}`,
  HISTORICAL_AQI:  (lat: number, lng: number) => `aqi_history_${lat.toFixed(3)}_${lng.toFixed(3)}`,
  DAILY_HISTORY:   'daily_history',
  CLAUDE_GUIDANCE: (profileId: string, aqi: number) => `claude_guidance_${profileId}_${aqi}`,
  LOCATION:        'user_location',
  CITY_RANKINGS:   'city_rankings_v1',
} as const;

export const CACHE_TTL = {
  CURRENT_AQI:     60,               // minutes
  HOURLY_FORECAST: 60,               // minutes
  HISTORICAL_AQI:  60,               // minutes — refresh once per hour
  DAILY_HISTORY:   'permanent' as const,
  CLAUDE_GUIDANCE: 120,              // minutes
  LOCATION:        30,               // minutes
  CITY_RANKINGS:   30,               // minutes
} as const;

// ─── Daily History ────────────────────────────────────────────────────────────

const MAX_HISTORY_DAYS = 30;

export async function storeDailyReading(reading: StoredDayReading): Promise<void> {
  try {
    const existing = await getDailyHistory();

    // Overwrite if today's reading already exists
    const filtered = existing.filter((r) => r.date !== reading.date);
    const updated = [...filtered, reading];

    // Keep only the most recent MAX_HISTORY_DAYS entries
    const trimmed = updated
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-MAX_HISTORY_DAYS);

    await setCache(CACHE_KEYS.DAILY_HISTORY, trimmed, 'permanent');
  } catch {
    // Silently fail — history is non-critical
  }
}

export async function getDailyHistory(): Promise<StoredDayReading[]> {
  const history = await getCache<StoredDayReading[]>(CACHE_KEYS.DAILY_HISTORY);
  if (!history) return [];
  return history.sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Onboarding ────────────────────────────────────────────────────────────────

const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';
const USER_PROFILES_KEY = 'user_profiles';
export const PREFERRED_CITY_KEY = 'preferred_city_fallback';

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
}

export async function isOnboardingComplete(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function saveProfiles(profiles: UserProfile[]): Promise<void> {
  await AsyncStorage.setItem(USER_PROFILES_KEY, JSON.stringify(profiles));
}

export async function getProfiles(): Promise<UserProfile[]> {
  try {
    const raw = await AsyncStorage.getItem(USER_PROFILES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UserProfile[];
  } catch {
    return [];
  }
}

// ─── Last-known AQI ───────────────────────────────────────────────────────────
// Stored whenever useAQI gets fresh data.
// Used by App.tsx AppState listener to check spike / clean-air conditions
// without needing a running hook.

const LAST_KNOWN_AQI_KEY = 'last_known_aqi';

export async function saveLastKnownAQI(aqi: number, city: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_KNOWN_AQI_KEY, JSON.stringify({ aqi, city }));
  } catch {}
}

export async function getLastKnownAQI(): Promise<{ aqi: number; city: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_KNOWN_AQI_KEY);
    return raw ? (JSON.parse(raw) as { aqi: number; city: string }) : null;
  } catch {
    return null;
  }
}
