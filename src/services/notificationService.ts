/**
 * notificationService.ts
 *
 * Three notification types:
 *   1. Morning briefing  — recurring daily at (earliest go-out time − 30 min)
 *   2. Spike alert       — when AQI > 200 (checked on app foreground, max once per 6h)
 *   3. Clean air alert   — when AQI drops from > 150 to < 80 (once per day)
 *
 * Daily cap: max 2 notifications per day across types 2 & 3.
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { UserProfile } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationSettings {
  morningEnabled:    boolean;
  spikeEnabled:      boolean;
  cleanAirEnabled:   boolean;
  morningHour:       number;
  morningMinute:     number;
  /** true when the user explicitly picked a time in Family tab */
  morningTimeIsCustom: boolean;
}

export const DEFAULT_NOTIF_SETTINGS: NotificationSettings = {
  morningEnabled:      true,
  spikeEnabled:        true,
  cleanAirEnabled:     true,
  morningHour:         6,
  morningMinute:       30,
  morningTimeIsCustom: false,
};

// ─── Storage keys ─────────────────────────────────────────────────────────────

const NOTIF_SETTINGS_KEY   = 'notification_settings_v1';
const LAST_SPIKE_KEY       = 'last_spike_alert_ts';
const LAST_CLEAN_KEY       = 'last_clean_alert_date';
const DAILY_COUNT_KEY      = 'daily_notif_count';
const PREV_FG_AQI_KEY      = 'prev_foreground_aqi';
const NOTIF_CITY_KEY       = 'notif_scheduled_city';
const FIRST_SCHEDULE_KEY   = 'notifications_first_scheduled';

// ─── Settings persistence ─────────────────────────────────────────────────────

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_NOTIF_SETTINGS };
    return { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_NOTIF_SETTINGS };
  }
}

export async function saveNotificationSettings(
  settings: NotificationSettings,
): Promise<void> {
  await AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings));
}

// ─── Go-out slot → hour mapping ───────────────────────────────────────────────

const SLOT_FIRST_HOUR: Record<string, number> = {
  morning:      6,
  school_drop:  7,
  work_commute: 9,
  lunch:        12,
  evening:      17,
  late_evening: 20,
};

export function getEarliestGoOutHour(profiles: UserProfile[]): number {
  let earliest = 9; // sensible fallback
  for (const profile of profiles) {
    for (const slot of profile.goOutTimes ?? []) {
      const h = SLOT_FIRST_HOUR[slot];
      if (h !== undefined) earliest = Math.min(earliest, h);
    }
  }
  return earliest;
}

export function morningTimeFromProfiles(
  profiles: UserProfile[],
): { hour: number; minute: number } {
  const earliest   = getEarliestGoOutHour(profiles);
  const totalMins  = earliest * 60 - 30; // 30 min before first go-out
  return {
    hour:   Math.max(0, Math.floor(totalMins / 60)),
    minute: ((totalMins % 60) + 60) % 60,
  };
}

// ─── Android channel ──────────────────────────────────────────────────────────

export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('saans', {
    name:              'Saans Air Alerts',
    importance:        Notifications.AndroidImportance.HIGH,
    sound:             'default',
    vibrationPattern:  [0, 250, 250, 250],
  });
}

// ─── Permission ───────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  await setupNotificationChannel();
  const { status: current } = await Notifications.getPermissionsAsync();
  if (current === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return status === 'granted';
}

// ─── Schedule morning briefing ────────────────────────────────────────────────

export async function scheduleAllNotifications(
  settings:  NotificationSettings,
  city:      string,
): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!settings.morningEnabled) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Check your air before you step out 🌅',
      body:  `Tap to see today's air quality in ${city}`,
      sound: true,
      ...(Platform.OS === 'android' ? { channelId: 'saans' } : {}),
    },
    trigger: {
      type:    Notifications.SchedulableTriggerInputTypes.CALENDAR,
      repeats: true,
      hour:    settings.morningHour,
      minute:  settings.morningMinute,
    } as Notifications.CalendarTriggerInput,
  });

  // Remember which city the notification was scheduled for
  await AsyncStorage.setItem(NOTIF_CITY_KEY, city);
}

/**
 * Called once (the first time the app gets live AQI data).
 * Schedules the morning briefing if it hasn't been scheduled yet.
 */
export async function scheduleNotificationsFirstTime(
  city:     string,
  profiles: UserProfile[],
): Promise<void> {
  const alreadyDone = await AsyncStorage.getItem(FIRST_SCHEDULE_KEY);
  if (alreadyDone) return;

  const settings = await getNotificationSettings();

  // Set default morning time from profiles (only if not custom)
  if (!settings.morningTimeIsCustom) {
    const { hour, minute } = morningTimeFromProfiles(profiles);
    settings.morningHour   = hour;
    settings.morningMinute = minute;
    await saveNotificationSettings(settings);
  }

  await scheduleAllNotifications(settings, city);
  await AsyncStorage.setItem(FIRST_SCHEDULE_KEY, 'true');
}

// ─── Daily cap ────────────────────────────────────────────────────────────────

const MAX_DAILY = 2;

async function canSendToday(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(DAILY_COUNT_KEY);
    if (!raw) return true;
    const { count, date } = JSON.parse(raw) as { count: number; date: string };
    const today = new Date().toISOString().slice(0, 10);
    if (date !== today) return true; // new day — reset
    return count < MAX_DAILY;
  } catch {
    return true;
  }
}

async function incrementDailyCount(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = await AsyncStorage.getItem(DAILY_COUNT_KEY);
    let count = 1;
    if (raw) {
      const data = JSON.parse(raw) as { count: number; date: string };
      count = data.date === today ? data.count + 1 : 1;
    }
    await AsyncStorage.setItem(DAILY_COUNT_KEY, JSON.stringify({ count, date: today }));
  } catch {}
}

// ─── Previous foreground AQI ──────────────────────────────────────────────────

export async function getPrevForegroundAQI(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(PREV_FG_AQI_KEY);
    return raw !== null ? Number(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

async function savePrevForegroundAQI(aqi: number): Promise<void> {
  await AsyncStorage.setItem(PREV_FG_AQI_KEY, JSON.stringify(aqi));
}

// ─── Spike & clean air checks ─────────────────────────────────────────────────

/**
 * Called from the AppState 'active' handler in App.tsx.
 * Reads the last-known cached AQI and fires a notification if warranted.
 */
export async function checkAndFireAlerts(
  currentAqi: number,
  city:       string,
): Promise<void> {
  const settings = await getNotificationSettings();
  const prevAqi  = await getPrevForegroundAQI();

  // Always update the stored "previous" value so next foreground has a reference
  await savePrevForegroundAQI(currentAqi);

  if (!(await canSendToday())) return;

  // ── Spike alert ─────────────────────────────────────────────────────────────
  if (settings.spikeEnabled && currentAqi > 200) {
    try {
      const lastSpike   = await AsyncStorage.getItem(LAST_SPIKE_KEY);
      const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
      if (!lastSpike || Number(lastSpike) < sixHoursAgo) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `⚠️ Air quality dropped in ${city}`,
            body:  'AQI just crossed 200. Close windows. Limit time outside.',
            sound: true,
            ...(Platform.OS === 'android' ? { channelId: 'saans' } : {}),
          },
          trigger: {
            type:    Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 1,
          } as Notifications.TimeIntervalTriggerInput,
        });
        await AsyncStorage.setItem(LAST_SPIKE_KEY, String(Date.now()));
        await incrementDailyCount();
        return; // one alert per foreground event
      }
    } catch {}
  }

  // ── Clean air alert ─────────────────────────────────────────────────────────
  if (
    settings.cleanAirEnabled &&
    prevAqi !== null &&
    prevAqi > 150 &&
    currentAqi < 80
  ) {
    try {
      const today     = new Date().toISOString().slice(0, 10);
      const lastClean = await AsyncStorage.getItem(LAST_CLEAN_KEY);
      if (lastClean !== today) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🌿 Air cleared up in ${city}!`,
            body:  `AQI dropped to ${currentAqi}. Good window to go outside now.`,
            sound: true,
            ...(Platform.OS === 'android' ? { channelId: 'saans' } : {}),
          },
          trigger: {
            type:    Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 1,
          } as Notifications.TimeIntervalTriggerInput,
        });
        await AsyncStorage.setItem(LAST_CLEAN_KEY, today);
        await incrementDailyCount();
      }
    } catch {}
  }
}

// ─── Time formatting helpers ──────────────────────────────────────────────────

export function formatMorningTime(hour: number, minute: number): string {
  const period = hour < 12 ? 'am' : 'pm';
  const h12    = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const mm     = minute.toString().padStart(2, '0');
  return `${h12}:${mm}${period}`;
}

export function getNextMorningLabel(hour: number, minute: number): string {
  const now      = new Date();
  const todayFire = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0,
  );
  const label = now < todayFire ? 'Today' : 'Tomorrow';
  return `${label} at ${formatMorningTime(hour, minute)}`;
}
