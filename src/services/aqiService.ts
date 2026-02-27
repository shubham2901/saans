import axios from 'axios';
import { AQIData, HourlyForecast, StoredDayReading } from '../types';
import { getAQIStatus } from '../constants/colors';

const WAQI_TOKEN = process.env.EXPO_PUBLIC_WAQI_TOKEN ?? '';
const OWM_TOKEN  = process.env.EXPO_PUBLIC_OWM_TOKEN ?? '';

// ─── Haversine ────────────────────────────────────────────────────────────────

function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── WAQI response validator ──────────────────────────────────────────────────

function isValidAqi(raw: unknown): boolean {
  if (raw === null || raw === undefined) return false;
  if (raw === '-') return false;
  if (raw === -999) return false;
  const n = Number(raw);
  return !isNaN(n) && n >= 0;
}

// ─── WAQI response parser ─────────────────────────────────────────────────────

function parseWaqiResponse(
  data: WAQIStationData,
  userLat: number,
  userLng: number,
): AQIData {
  const aqi = Number(data.aqi);
  const iaqi = data.iaqi ?? {};

  const updatedAt = data.time?.iso ? new Date(data.time.iso) : new Date();
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const isStale = updatedAt < fourHoursAgo;

  const stationLat = data.city?.geo?.[0] ?? userLat;
  const stationLng = data.city?.geo?.[1] ?? userLng;
  const stationDistanceKm = haversineKm(userLat, userLng, stationLat, stationLng);

  return {
    aqi,
    pm25: iaqi.pm25?.v ?? 0,
    pm10: iaqi.pm10?.v ?? 0,
    o3:   iaqi.o3?.v   ?? 0,
    no2:  iaqi.no2?.v  ?? 0,
    dominantPollutant: data.dominentpol ?? 'pm25',
    status: getAQIStatus(aqi),
    stationName: data.city?.name ?? 'Unknown station',
    stationDistanceKm: Math.round(stationDistanceKm * 10) / 10,
    city: data.city?.name?.split(',')?.[0]?.trim() ?? 'Unknown',
    updatedAt,
    isStale,
  };
}

// ─── WAQI raw types ───────────────────────────────────────────────────────────

interface WAQIIaqi {
  pm25?: { v: number };
  pm10?: { v: number };
  o3?:   { v: number };
  no2?:  { v: number };
  [key: string]: { v: number } | undefined;
}

interface WAQIStationData {
  aqi: number | string;
  dominentpol?: string;
  city?: { name?: string; geo?: [number, number] };
  iaqi?: WAQIIaqi;
  time?: { iso?: string };
}

interface WAQIResponse {
  status: string;
  data: WAQIStationData;
}

// ─── WAQI city-name fallback ──────────────────────────────────────────────────

const MAX_STATION_DISTANCE_KM = 100;

async function tryNamedCityFallback(
  userCity: string | undefined,
  stationCityName: string | undefined,
  lat: number,
  lng: number,
): Promise<AQIData | null> {
  const candidates: string[] = [];
  if (userCity) candidates.push(userCity);
  if (stationCityName) {
    const last = stationCityName.split(',').pop()?.trim();
    if (last && last !== userCity) candidates.push(last);
  }
  for (const name of candidates) {
    try {
      const url = `https://api.waqi.info/feed/${encodeURIComponent(name)}/?token=${WAQI_TOKEN}`;
      const { data } = await axios.get<WAQIResponse>(url, { timeout: 10000 });
      if (data.status === 'ok' && isValidAqi(data.data.aqi)) {
        return parseWaqiResponse(data.data, lat, lng);
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

// ─── WAQI best station (geo + distance + city-name fallback) ─────────────────

async function fetchWaqiBestStation(
  lat: number,
  lng: number,
  cityName?: string,
): Promise<AQIData | null> {
  try {
    const geoUrl = `https://api.waqi.info/feed/geo:${lat};${lng}/?token=${WAQI_TOKEN}`;
    const { data: resp } = await axios.get<WAQIResponse>(geoUrl, { timeout: 10000 });

    if (resp.status !== 'ok') return null;
    const stationData = resp.data;

    if (!isValidAqi(stationData.aqi)) {
      // WAQI returned sensor failure — try city name
      return tryNamedCityFallback(cityName, stationData.city?.name, lat, lng);
    }

    const parsed = parseWaqiResponse(stationData, lat, lng);

    if (parsed.stationDistanceKm <= MAX_STATION_DISTANCE_KM) {
      // Station is nearby — use it
      return parsed;
    }

    // Station is very far — try user's city name first
    const closer = await tryNamedCityFallback(cityName, stationData.city?.name, lat, lng);
    return closer ?? parsed;
  } catch {
    return null;
  }
}

// ─── Open-Meteo current AQI ───────────────────────────────────────────────────
// Used as a live fallback when WAQI station data is stale.
// Open-Meteo is an atmospheric model — always current, updated every hour.

interface OpenMeteoCurrentResponse {
  current: {
    time: string;
    us_aqi:            number | null;
    pm2_5:             number | null;
    pm10:              number | null;
    ozone:             number | null;
    nitrogen_dioxide:  number | null;
  };
}

async function fetchOpenMeteoCurrentAQI(
  lat: number,
  lng: number,
): Promise<AQIData | null> {
  try {
    const url =
      `https://air-quality-api.open-meteo.com/v1/air-quality` +
      `?latitude=${lat}&longitude=${lng}` +
      `&current=us_aqi,pm10,pm2_5,ozone,nitrogen_dioxide&timezone=auto`;
    const { data } = await axios.get<OpenMeteoCurrentResponse>(url, { timeout: 10000 });
    const c = data.current;
    if (!c || c.us_aqi === null || c.us_aqi === undefined) return null;

    const aqi = Math.round(c.us_aqi);
    return {
      aqi,
      pm25: Math.round(c.pm2_5  ?? 0),
      pm10: Math.round(c.pm10   ?? 0),
      o3:   Math.round(c.ozone  ?? 0),
      no2:  Math.round(c.nitrogen_dioxide ?? 0),
      dominantPollutant: 'pm25',
      status: getAQIStatus(aqi),
      stationName: 'Live atmospheric model',
      stationDistanceKm: 0,
      city: '',
      updatedAt: new Date(),
      isStale: false,
    };
  } catch {
    return null;
  }
}

// ─── Open-Meteo historical daily AQI ─────────────────────────────────────────
// Fetches hourly US AQI for the past 7 days + today and aggregates to daily avg.

interface OpenMeteoHourlyResponse {
  hourly: {
    time:   string[];
    us_aqi: (number | null)[];
  };
}

export async function fetchHistoricalDailyAQI(
  lat: number,
  lng: number,
): Promise<StoredDayReading[]> {
  try {
    // past_days=7 + forecast_days=1 ensures today is always included
    const url =
      `https://air-quality-api.open-meteo.com/v1/air-quality` +
      `?latitude=${lat}&longitude=${lng}` +
      `&hourly=us_aqi&past_days=7&forecast_days=1&timezone=auto`;
    const { data } = await axios.get<OpenMeteoHourlyResponse>(url, { timeout: 12000 });

    const times     = data.hourly.time;     // "2026-02-19T00:00"
    const aqiValues = data.hourly.us_aqi;   // number | null

    // Aggregate hourly values into per-day averages
    const byDate = new Map<string, number[]>();
    for (let i = 0; i < times.length; i++) {
      const date = times[i].slice(0, 10); // "2026-02-19"
      const val  = aqiValues[i];
      if (val !== null && val !== undefined) {
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date)!.push(Math.round(val));
      }
    }

    const readings: StoredDayReading[] = [];
    for (const [date, values] of byDate) {
      if (values.length === 0) continue;
      const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
      readings.push({ date, aqi: avg, status: getAQIStatus(avg) });
    }

    return readings.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

// ─── fetchCurrentAQI ──────────────────────────────────────────────────────────
//
// Strategy:
//   1. Try WAQI (geo → distance check → city-name fallback)
//   2. If WAQI result is fresh  → use it
//   3. If WAQI result is stale / unavailable → Open-Meteo live model
//   4. Last resort → return stale WAQI data rather than nothing

export async function fetchCurrentAQI(
  lat: number,
  lng: number,
  cityName?: string,
): Promise<AQIData | null> {
  const waqiResult = await fetchWaqiBestStation(lat, lng, cityName);

  // Fresh WAQI data — prefer sensor readings over model data
  if (waqiResult && !waqiResult.isStale) return waqiResult;

  // WAQI is stale or offline — try Open-Meteo for a live reading
  const modelResult = await fetchOpenMeteoCurrentAQI(lat, lng);
  if (modelResult) return modelResult;

  // Both failed — return stale WAQI data as a last resort
  return waqiResult;
}

// ─── OWM AQI scale conversion ─────────────────────────────────────────────────

const OWM_TO_INDIA: Record<number, number> = {
  1: 25,
  2: 75,
  3: 130,
  4: 180,
  5: 250,
};

interface OWMForecastItem {
  dt: number;
  main: { aqi: 1 | 2 | 3 | 4 | 5 };
  components: {
    pm2_5?: number;
    pm10?:  number;
    o3?:    number;
    no2?:   number;
    [key: string]: number | undefined;
  };
}

// ─── fetchHourlyForecast ──────────────────────────────────────────────────────

export async function fetchHourlyForecast(
  lat: number,
  lng: number,
): Promise<HourlyForecast[]> {
  try {
    const url =
      `https://api.openweathermap.org/data/2.5/air_pollution/forecast` +
      `?lat=${lat}&lon=${lng}&appid=${OWM_TOKEN}`;

    const { data } = await axios.get<{ list: OWMForecastItem[] }>(url, { timeout: 10000 });

    const nowMs    = Date.now();
    const cutoffMs = nowMs + 24 * 60 * 60 * 1000;

    return data.list
      .filter((item) => {
        const ms = item.dt * 1000;
        return ms >= nowMs && ms <= cutoffMs;
      })
      .map((item) => ({
        hour: new Date(item.dt * 1000).getHours(),
        aqi:  OWM_TO_INDIA[item.main.aqi] ?? 75,
        dominantPollutant: resolveDominantPollutant(item.components),
      }));
  } catch {
    return [];
  }
}

function resolveDominantPollutant(
  components: OWMForecastItem['components'],
): string {
  const candidates: [string, number][] = [
    ['pm25', components.pm2_5 ?? 0],
    ['pm10', components.pm10  ?? 0],
    ['o3',   components.o3    ?? 0],
    ['no2',  components.no2   ?? 0],
  ];
  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0][0];
}

// ─── fetchCityAQI ─────────────────────────────────────────────────────────────

export async function fetchCityAQI(cityName: string): Promise<number | null> {
  try {
    const encoded = encodeURIComponent(cityName);
    const url = `https://api.waqi.info/feed/${encoded}/?token=${WAQI_TOKEN}`;
    const { data: resp } = await axios.get<WAQIResponse>(url, { timeout: 8000 });

    if (resp.status !== 'ok' || !isValidAqi(resp.data.aqi)) return null;
    return Number(resp.data.aqi);
  } catch {
    return null;
  }
}
