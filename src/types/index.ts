export interface AQIData {
  aqi: number;
  pm25: number;
  pm10: number;
  o3: number;
  no2: number;
  dominantPollutant: string;
  status: 'Good' | 'Moderate' | 'UnhealthySensitive' | 'Unhealthy' | 'VeryUnhealthy' | 'Hazardous';
  stationName: string;
  stationDistanceKm: number;
  city: string;
  updatedAt: Date;
  isStale: boolean; // true if data is older than 4 hours
}

export interface UserProfile {
  id: string;
  type: 'self' | 'kid' | 'elderly' | 'runner' | 'asthma';
  name: string;
  goOutTimes: string[]; // e.g. ['morning', 'evening']
}

export interface GuidanceCard {
  emoji: string;
  profileLabel: string;
  message: string;
  detail: string;
  profileType: string;
}

export interface HourlyForecast {
  hour: number; // 0-23
  aqi: number;
  dominantPollutant: string;
}

export interface StoredDayReading {
  date: string; // YYYY-MM-DD
  aqi: number;
  status: string;
}
