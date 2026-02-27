/**
 * widgetService.ts
 *
 * Writes AQI data to Android SharedPreferences so the home screen
 * widget can read it without the app being open.
 *
 * On iOS (or if the native module is unavailable, e.g. Expo Go) the
 * calls are silently no-ops — nothing breaks.
 */

import { NativeModules, Platform } from 'react-native';
import { AQI_COLORS, getAQIStatus } from '../constants/colors';
import { GuidanceCard } from '../types';

const { WidgetData } = NativeModules;

export interface WidgetPayload {
  aqi:               number;
  status:            string;
  city:              string;
  firstGuidanceCard: string;
  updatedAt:         string;   // ISO-8601
  color:             string;   // hex, e.g. "#CC0033"
}

export function setWidgetData(
  aqi:        number,
  city:       string,
  guidance:   GuidanceCard[],
): void {
  // Only Android has the widget; silently skip on iOS / Expo Go
  if (Platform.OS !== 'android' || !WidgetData?.setWidgetData) return;

  const status = getAQIStatus(aqi);
  const color  = AQI_COLORS[status];
  const first  = guidance[0]?.message ?? '';

  const payload: WidgetPayload = {
    aqi,
    status,
    city,
    firstGuidanceCard: first,
    updatedAt: new Date().toISOString(),
    color,
  };

  try {
    WidgetData.setWidgetData(JSON.stringify(payload));
  } catch (e) {
    // Non-fatal — widget just won't update
    console.log('[WidgetService] setWidgetData failed:', e);
  }
}
