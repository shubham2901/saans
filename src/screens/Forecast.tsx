import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocation } from '../hooks/useLocation';
import { useAQI } from '../hooks/useAQI';
import { useProfiles } from '../hooks/useProfiles';
import SkeletonCard from '../components/SkeletonCard';
import { AQI_COLORS, getAQIStatus, STATUS_LABELS } from '../constants/colors';
import { HourlyForecast } from '../types';

const ORANGE = '#FF7E00';
const H_PAD  = 16; // horizontal screen padding

// ─── Go-out time → hour ranges ────────────────────────────────────────────────

const SLOT_HOURS: Record<string, number[]> = {
  morning:      [6, 7, 8],
  school_drop:  [7, 8],
  work_commute: [9],
  lunch:        [12, 13],
  evening:      [17, 18, 19],
  late_evening: [20, 21, 22],
};

function buildGoOutHours(goOutTimes: string[]): Set<number> {
  const hours = new Set<number>();
  for (const slot of goOutTimes) {
    for (const h of SLOT_HOURS[slot] ?? []) hours.add(h);
  }
  return hours;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtHour(h: number): string {
  if (h === 0)  return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function shortDate(): string {
  const d = new Date();
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Best windows ─────────────────────────────────────────────────────────────

interface BestWindow { startHour: number; endHour: number; avgAqi: number }

function findTop2Windows(forecast: HourlyForecast[]): BestWindow[] {
  if (forecast.length < 2) return [];

  const windows = forecast
    .slice(0, -1)
    .map((f, i) => ({ i, sum: f.aqi + forecast[i + 1].aqi }))
    .sort((a, b) => a.sum - b.sum);

  const result: BestWindow[] = [];
  const used = new Set<number>();

  for (const w of windows) {
    if (used.has(w.i) || used.has(w.i + 1)) continue;
    used.add(w.i);
    used.add(w.i + 1);
    result.push({
      startHour: forecast[w.i].hour,
      endHour:   forecast[w.i + 1].hour + 1,
      avgAqi:    Math.round(w.sum / 2),
    });
    if (result.length === 2) break;
  }
  return result;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HourlyCard({
  item,
  isGoOut,
}: {
  item: HourlyForecast;
  isGoOut: boolean;
}) {
  const color = AQI_COLORS[getAQIStatus(item.aqi)];

  return (
    <View style={[styles.hourCard, isGoOut && styles.hourCardActive]}>
      <Text style={styles.hourLabel}>{fmtHour(item.hour)}</Text>
      <View style={[styles.aqiCircle, { backgroundColor: color }]}>
        <Text style={styles.aqiCircleText}>{item.aqi}</Text>
      </View>
    </View>
  );
}

function ColorTimelineBar({
  forecast,
  screenWidth,
}: {
  forecast: HourlyForecast[];
  screenWidth: number;
}) {
  if (forecast.length === 0) return null;
  const barWidth  = screenWidth - H_PAD * 2;
  const segWidth  = barWidth / forecast.length;
  const firstHour = forecast[0].hour;
  const totalHrs  = forecast.length;

  // Compute label positions
  const labels: Array<{ text: string; frac: number }> = [{ text: 'Now', frac: 0 }];
  for (const target of [18, 0]) { // 6pm = 18, midnight = 0
    let offset = (target - firstHour + 24) % 24;
    if (offset < totalHrs) labels.push({ text: target === 18 ? '6pm' : 'Midnight', frac: offset / totalHrs });
  }

  return (
    <View style={{ marginBottom: 20 }}>
      {/* Segment bar */}
      <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' }}>
        {forecast.map((f, i) => (
          <View
            key={i}
            style={{ width: segWidth, backgroundColor: AQI_COLORS[getAQIStatus(f.aqi)] }}
          />
        ))}
      </View>
      {/* Labels */}
      <View style={{ position: 'relative', height: 18, marginTop: 4 }}>
        {labels.map((lbl) => (
          <Text
            key={lbl.text}
            style={[styles.timelineLabel, { left: lbl.frac * barWidth }]}
          >
            {lbl.text}
          </Text>
        ))}
      </View>
    </View>
  );
}

function BestWindowCard({ win }: { win: BestWindow }) {
  const status  = getAQIStatus(win.avgAqi);
  const color   = AQI_COLORS[status];
  const label   = STATUS_LABELS[status];
  return (
    <View style={styles.bestCard}>
      <View style={[styles.bestDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.bestTime}>
          {fmtHour(win.startHour)} – {fmtHour(win.endHour)}
        </Text>
        <Text style={styles.bestSub}>AQI ~{win.avgAqi} · {label}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ForecastScreen() {
  const { width } = useWindowDimensions();
  const { lat, lng, city, subArea, permissionStatus } = useLocation();
  const { forecast, loading, refresh } = useAQI({
    lat, lng, city, enabled: permissionStatus === 'granted',
  });
  const { profiles } = useProfiles();

  // Collect all go-out hours across all profiles
  const goOutHours = useMemo(() => {
    const allTimes = profiles.flatMap((p) => p.goOutTimes);
    return buildGoOutHours(allTimes);
  }, [profiles]);

  const bestWindows = useMemo(() => findTop2Windows(forecast), [forecast]);
  const locationLine = subArea ? `${subArea} · ${city}` : city ?? 'Your location';

  const showSkeleton = loading && forecast.length === 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={ORANGE} colors={[ORANGE]} />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Today's Air</Text>
          <Text style={styles.headerSub}>{locationLine} · {shortDate()}</Text>
        </View>

        {/* ── Skeleton ── */}
        {showSkeleton && (
          <>
            <SkeletonCard height={120} style={styles.mb16} />
            <SkeletonCard height={40}  style={styles.mb16} />
            <SkeletonCard height={100} style={styles.mb16} />
          </>
        )}

        {/* ── Empty state ── */}
        {!showSkeleton && forecast.length === 0 && (
          <View style={styles.centerBox}>
            <Text style={styles.emptyIcon}>🌫️</Text>
            <Text style={styles.emptyTitle}>Forecast unavailable</Text>
            <Text style={styles.emptySub}>Pull down to retry</Text>
          </View>
        )}

        {/* ── Forecast content ── */}
        {forecast.length > 0 && !showSkeleton && (
          <>
            {/* Hourly horizontal scroll */}
            <Text style={styles.sectionTitle}>Hourly</Text>
            {goOutHours.size > 0 && (
              <Text style={styles.sectionSub}>
                Orange border = your go-out times
              </Text>
            )}
            <FlatList
              data={forecast}
              keyExtractor={(_, i) => String(i)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hourlyList}
              renderItem={({ item }) => (
                <HourlyCard item={item} isGoOut={goOutHours.has(item.hour)} />
              )}
              style={styles.mb20}
            />

            {/* Color timeline bar */}
            <Text style={styles.sectionTitle}>24-hour outlook</Text>
            <ColorTimelineBar forecast={forecast} screenWidth={width} />

            {/* Best windows */}
            {bestWindows.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Best windows to go out</Text>
                {bestWindows.map((win, i) => (
                  <BestWindowCard key={i} win={win} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F7F8FA' },
  scroll: { padding: H_PAD, paddingBottom: 36 },
  mb16:   { marginBottom: 16 },
  mb20:   { marginBottom: 20 },

  header:     { marginBottom: 24 },
  headerTitle:{ fontSize: 26, fontWeight: '800', color: '#1A1A1A' },
  headerSub:  { fontSize: 13, color: '#888', marginTop: 2 },

  sectionTitle:{ fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 6 },
  sectionSub:  { fontSize: 12, color: '#999', marginBottom: 10 },

  // Hourly list
  hourlyList: { gap: 10, paddingRight: 16 },
  hourCard: {
    width: 72,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  hourCardActive: {
    borderColor: ORANGE,
    transform: [{ scale: 1.04 }],
    shadowOpacity: 0.12,
  },
  hourLabel:      { fontSize: 12, color: '#777', fontWeight: '600' },
  aqiCircle:      { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  aqiCircleText:  { fontSize: 14, fontWeight: '800', color: '#FFF' },

  // Timeline labels
  timelineLabel: { position: 'absolute', fontSize: 10, color: '#888', fontWeight: '500' },

  // Best window cards
  bestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    gap: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  bestDot:  { width: 14, height: 14, borderRadius: 7 },
  bestTime: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  bestSub:  { fontSize: 13, color: '#777', marginTop: 2 },

  // Empty / error states
  centerBox:  { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 6 },
  emptySub:   { fontSize: 14, color: '#888' },
});
