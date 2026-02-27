import { AQIData } from '../types';

export const AQI_COLORS = {
  Good: '#00E400',
  Moderate: '#FFFF00',
  UnhealthySensitive: '#FF7E00',
  Unhealthy: '#FF0000',
  VeryUnhealthy: '#8F3F97',
  Hazardous: '#7E0023',
};

export const getAQIStatus = (aqi: number): AQIData['status'] => {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'UnhealthySensitive';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'VeryUnhealthy';
  return 'Hazardous';
};

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const STATUS_LABELS: Record<AQIData['status'], string> = {
  Good:                'GOOD',
  Moderate:            'MODERATE',
  UnhealthySensitive:  'UNHEALTHY FOR SENSITIVE',
  Unhealthy:           'UNHEALTHY',
  VeryUnhealthy:       'VERY UNHEALTHY',
  Hazardous:           'HAZARDOUS',
};

/**
 * Dark, readable variants of each AQI colour for use as **text** on a
 * white/light background.  The base AQI_COLORS are great for badges and
 * filled shapes, but e.g. Moderate (#FFFF00) is illegible as text on white.
 */
export const AQI_DARK_COLORS: Record<string, string> = {
  Good:               '#007A00', // dark green
  Moderate:           '#7A6400', // dark amber
  UnhealthySensitive: '#B85900', // dark orange
  Unhealthy:          '#C00000', // dark red
  VeryUnhealthy:      '#6B2E73', // dark purple
  Hazardous:          '#5C0018', // dark maroon
};

/**
 * Returns a high-contrast text colour (#1A1A1A or #FFFFFF)
 * for text rendered directly on top of `hexColor`.
 */
export function getAQITextOnColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Perceived luminance (ITU-R BT.601 weights)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1A1A1A' : '#FFFFFF';
}
