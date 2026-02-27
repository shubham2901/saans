import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AQIData } from '../types';
import { AQI_COLORS, hexToRgba, STATUS_LABELS, getAQITextOnColor } from '../constants/colors';
import { pollutantLabel } from '../constants/thresholds';

interface Props {
  data: AQIData;
}

const POLLUTANT_INFO: Record<string, string> = {
  'PM2.5': 'Fine particles (≤2.5 µm) from vehicles & burning. Most harmful — penetrate deep into lungs.',
  'PM10': 'Coarser dust (≤10 µm) from roads & construction. Irritates nose and throat.',
  'O₃': 'Ozone at ground level, formed by sunlight + traffic fumes. Worsens asthma.',
  'NO₂': 'Nitrogen dioxide from vehicles & power plants. Inflames airways.',
};

function timeAgo(date: any): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return d.toLocaleDateString();
}

export default function AQICard({ data }: Props) {
  const [showPollutantInfo, setShowPollutantInfo] = useState(false);
  const color = AQI_COLORS[data.status];
  const bgColor = hexToRgba(color, 0.12);
  const badgeTextColor = getAQITextOnColor(color);

  const pills: { label: string; value: number }[] = [];
  if (data.pm25 > 0) pills.push({ label: 'PM2.5', value: data.pm25 });
  if (data.pm10 > 0) pills.push({ label: 'PM10', value: data.pm10 });
  if (data.o3 > 0) pills.push({ label: 'O₃', value: data.o3 });
  if (data.no2 > 0) pills.push({ label: 'NO₂', value: data.no2 });

  return (
    <View style={[styles.card, { backgroundColor: bgColor, borderColor: color }]}>
      {/* AQI number + status badge */}
      <View style={styles.topRow}>
        <View>
          {/* Number + "AQI" tag on the same line, tag sits at baseline */}
          <View style={styles.numberRow}>
            <Text style={styles.aqiNumber}>{data.aqi}</Text>
            <Text style={styles.aqiLabel}>AQI</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: color }]}>
            <Text style={[styles.statusLabel, { color: badgeTextColor }]}>
              {STATUS_LABELS[data.status]}
            </Text>
          </View>
        </View>
      </View>

      {/* Dominant pollutant */}
      <Text style={styles.pollutantLine}>
        {pollutantLabel(data.dominantPollutant)} is elevated today
      </Text>

      {/* Sub-pollutant pills */}
      {pills.length > 0 && (
        <>
          <View style={styles.pillRow}>
            {pills.map((p) => (
              <View key={p.label} style={styles.pill}>
                <Text style={styles.pillLabel}>{p.label}</Text>
                <Text style={styles.pillValue}>{Math.round(p.value)}</Text>
                <Text style={styles.pillUnit}>µg</Text>
              </View>
            ))}
            <TouchableOpacity
              onPress={() => setShowPollutantInfo((v) => !v)}
              style={styles.infoBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.infoBtnText}>{showPollutantInfo ? '✕' : 'ⓘ'}</Text>
            </TouchableOpacity>
          </View>
          {showPollutantInfo && (
            <View style={styles.infoBox}>
              {pills.map((p) => (
                <Text key={p.label} style={styles.infoLine}>
                  <Text style={styles.infoKey}>{p.label}</Text>{'  '}{POLLUTANT_INFO[p.label] ?? ''}
                </Text>
              ))}
            </View>
          )}
        </>
      )}

      {/* Station info */}
      <Text style={styles.stationText}>
        Updated {timeAgo(data.updatedAt)} from station {data.stationDistanceKm}km away
      </Text>

      {/* Far station warning */}
      {data.stationDistanceKm > 100 && (
        <Text style={styles.distanceWarning}>
          ⚠️  Nearest sensor is {data.stationDistanceKm} km away — readings may not reflect your local air
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 0, // stale strip sits immediately below, no gap
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  numberRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  aqiLabel: { fontSize: 12, fontWeight: '700', color: '#999', letterSpacing: 1.5, marginBottom: 10 },
  aqiNumber: { fontSize: 72, fontWeight: '800', color: '#1A1A1A', lineHeight: 80 },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
  },
  statusLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  pollutantLine: { fontSize: 15, color: '#333', fontWeight: '500', marginTop: 10, marginBottom: 12 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 },
  pill: { backgroundColor: 'rgba(0,0,0,0.07)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', gap: 4, alignItems: 'center' },
  pillLabel: { fontSize: 12, color: '#555', fontWeight: '600' },
  pillValue: { fontSize: 12, color: '#1A1A1A', fontWeight: '700' },
  pillUnit: { fontSize: 10, color: '#888', fontWeight: '500' },
  infoBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.07)', alignItems: 'center', justifyContent: 'center' },
  infoBtnText: { fontSize: 13, color: '#555' },
  infoBox: { backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 10, padding: 12, marginBottom: 10, gap: 6 },
  infoLine: { fontSize: 12, color: '#444', lineHeight: 18 },
  infoKey: { fontWeight: '700', color: '#1A1A1A' },
  stationText: { fontSize: 12, color: '#777', lineHeight: 16, marginTop: 2 },
  distanceWarning: { fontSize: 11, color: '#B05A00', marginTop: 6, lineHeight: 16, fontStyle: 'italic' },
});
