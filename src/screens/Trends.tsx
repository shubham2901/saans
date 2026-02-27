import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-gifted-charts';
import { useLocation } from '../hooks/useLocation';
import { getDailyHistory, getCache, setCache, CACHE_KEYS, CACHE_TTL } from '../services/storageService';
import { fetchCityAQI, fetchHistoricalDailyAQI } from '../services/aqiService';
import { AQI_COLORS, AQI_DARK_COLORS, getAQIStatus, STATUS_LABELS } from '../constants/colors';
import { StoredDayReading } from '../types';

const ORANGE = '#FF7E00';

// ─── Cities to compare ────────────────────────────────────────────────────────

const COMPARE_CITIES = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata'];

interface CityEntry { city: string; aqi: number | null }

// ─── 7-day gap-fill ───────────────────────────────────────────────────────────

interface FilledDay {
  date: string;
  aqi: number;
  status: string;
  isInterpolated: boolean;
  label: string; // "Mon", "Tue~"
}

function getLast7Dates(): string[] {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function shortDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(y, m - 1, d).getDay()];
}

function fillGaps(dates: string[], history: StoredDayReading[]): FilledDay[] {
  const map = new Map(history.map((r) => [r.date, r]));

  const raw: Array<{ date: string; aqi: number | null }> = dates.map((date) => ({
    date,
    aqi: map.has(date) ? map.get(date)!.aqi : null,
  }));

  for (let i = 0; i < raw.length; i++) {
    if (raw[i].aqi !== null) continue;

    let prev: number | null = null;
    let next: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (raw[j].aqi !== null) { prev = raw[j].aqi; break; }
    }
    for (let j = i + 1; j < raw.length; j++) {
      if (raw[j].aqi !== null) { next = raw[j].aqi; break; }
    }

    if (prev !== null && next !== null) raw[i].aqi = Math.round((prev + next) / 2);
    else if (prev !== null) raw[i].aqi = prev;
    else if (next !== null) raw[i].aqi = next;
    else raw[i].aqi = 50;
  }

  return raw.map((r) => {
    const aqi = r.aqi!;
    const interp = !map.has(r.date);
    return {
      date: r.date,
      aqi,
      status: getAQIStatus(aqi),
      isInterpolated: interp,
      label: shortDay(r.date) + (interp ? '~' : ''),
    };
  });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

interface WeekStats { avgAqi: number; avgStatus: string; worstDay: FilledDay; bestDay: FilledDay }

function calcStats(days: FilledDay[]): WeekStats | null {
  if (days.length === 0) return null;
  const avg = Math.round(days.reduce((s, d) => s + d.aqi, 0) / days.length);
  const worst = days.reduce((a, b) => (a.aqi > b.aqi ? a : b));
  const best = days.reduce((a, b) => (a.aqi < b.aqi ? a : b));
  return { avgAqi: avg, avgStatus: getAQIStatus(avg), worstDay: worst, bestDay: best };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={sStyle.row}>
      <Text style={sStyle.label}>{label}</Text>
      <Text style={[sStyle.value, { color }]}>{value}</Text>
    </View>
  );
}
const sStyle = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  label: { fontSize: 14, color: '#555' },
  value: { fontSize: 14, fontWeight: '700', textAlign: 'right', flex: 1, marginLeft: 12 },
});

function CityRow({ entry, isUser, rank }: { entry: CityEntry; isUser: boolean; rank: number }) {
  const status = entry.aqi !== null ? getAQIStatus(entry.aqi) : null;
  const dotColor = status ? AQI_COLORS[status] : '#CCC'; // bright fill for the dot
  const textColor = status ? (AQI_DARK_COLORS[status] ?? '#555') : '#CCC'; // readable for text
  return (
    <View style={[cStyle.row, isUser && cStyle.rowActive]}>
      <Text style={cStyle.rank}>{rank}</Text>
      <View style={[cStyle.dot, { backgroundColor: dotColor }]} />
      <Text style={[cStyle.name, isUser && cStyle.nameActive]}>{entry.city}</Text>
      <Text style={[cStyle.aqi, { color: textColor }]}>{entry.aqi ?? '–'}</Text>
    </View>
  );
}
const cStyle = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, gap: 10 },
  rowActive: { backgroundColor: '#FFF3E8' },
  rank: { width: 20, fontSize: 13, color: '#BBB', fontWeight: '600' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { flex: 1, fontSize: 14, color: '#333', fontWeight: '500' },
  nameActive: { color: ORANGE, fontWeight: '700' },
  aqi: { fontSize: 14, fontWeight: '800' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrendsScreen() {
  const { city, lat, lng } = useLocation();

  const [days, setDays] = useState<FilledDay[]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [loadingChart, setLoadingChart] = useState(true);
  const [cities, setCities] = useState<CityEntry[]>([]);
  const [loadingCities, setLoadingCities] = useState(true);
  const [activeBar, setActiveBar] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ── Chart loader ────────────────────────────────────────────────────────────
  // Fetches 7 days of historical AQI from Open-Meteo (no app-opens needed),
  // merges with any locally-stored readings, then calls fillGaps.

  const loadChart = useCallback(async (bust = false) => {
    setLoadingChart(true);

    // 1. Local history (always fast — AsyncStorage)
    const localHistory = await getDailyHistory();

    // 2. API history — Open-Meteo provides the last 7 days + today
    let apiHistory: StoredDayReading[] = [];
    if (lat !== null && lng !== null) {
      const cacheKey = CACHE_KEYS.HISTORICAL_AQI(lat, lng);
      const cached = !bust ? await getCache<StoredDayReading[]>(cacheKey) : null;
      if (cached) {
        apiHistory = cached;
      } else {
        apiHistory = await fetchHistoricalDailyAQI(lat, lng);
        if (apiHistory.length > 0) {
          await setCache(cacheKey, apiHistory, CACHE_TTL.HISTORICAL_AQI);
        }
      }
    }

    // 3. Merge: API overwrites local for the same date (API is authoritative)
    const mergedMap = new Map<string, StoredDayReading>();
    localHistory.forEach((r) => mergedMap.set(r.date, r));
    apiHistory.forEach((r) => mergedMap.set(r.date, r));
    const merged = Array.from(mergedMap.values());

    setHistoryCount(merged.length);
    setDays(fillGaps(getLast7Dates(), merged));
    setLoadingChart(false);
  }, [lat, lng]);

  async function loadCities(bust = false) {
    setLoadingCities(true);
    if (!bust) {
      const cached = await getCache<CityEntry[]>(CACHE_KEYS.CITY_RANKINGS);
      if (cached) { setCities(cached); setLoadingCities(false); return; }
    }

    const results = await Promise.all(
      COMPARE_CITIES.map(async (c): Promise<CityEntry> => ({ city: c, aqi: await fetchCityAQI(c) })),
    );
    const sorted = [...results].sort((a, b) => {
      if (a.aqi === null) return 1;
      if (b.aqi === null) return -1;
      return a.aqi - b.aqi;
    });
    await setCache(CACHE_KEYS.CITY_RANKINGS, sorted, CACHE_TTL.CITY_RANKINGS);
    setCities(sorted);
    setLoadingCities(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadChart(true), loadCities(true)]);
    setRefreshing(false);
  }

  // Re-run chart fetch whenever lat/lng resolve (location comes in asynchronously)
  useEffect(() => { loadChart(); }, [loadChart]);
  useEffect(() => { loadCities(); }, []);

  const userCityNorm = city?.toLowerCase().trim() ?? '';
  // hasData: at least 1 real data point exists (from API or local)
  const hasData = historyCount > 0;
  const stats = calcStats(days);

  // Bar chart data — topLabelComponent is re-evaluated on every render (activeBar in closure)
  const barData = days.map((d, i) => ({
    value: d.aqi,
    label: d.label,
    frontColor: AQI_COLORS[getAQIStatus(d.aqi)],
    topLabelComponent: () =>
      activeBar === i
        ? <Text style={{ fontSize: 10, color: '#333', fontWeight: '700', marginBottom: 2 }}>{d.aqi}</Text>
        : null,
    onPress: () => setActiveBar((prev) => (prev === i ? null : i)),
  }));

  const chartMax = days.length > 0 ? Math.max(...days.map((d) => d.aqi), 100) + 30 : 300;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Air Trends</Text>
          <Text style={styles.headerSub}>Last 7 days</Text>
        </View>

        {/* ── Chart section ── */}
        {loadingChart ? (
          <ActivityIndicator color={ORANGE} style={{ marginVertical: 40 }} />
        ) : !hasData ? (
          // No data at all — API failed and no local history
          <View style={styles.noDataBox}>
            <Text style={styles.noDataEmoji}>📡</Text>
            <Text style={styles.noDataTitle}>Couldn't load air history</Text>
            <Text style={styles.noDataSub}>Pull down to try again. Make sure you have an internet connection.</Text>
          </View>
        ) : (
          <View style={styles.chartCard}>
            <Text style={styles.sectionTitle}>This week</Text>
            <Text style={styles.chartHint}>Tap a bar to see value · ~ = estimated</Text>

            <BarChart
              data={barData}
              barWidth={32}
              barBorderRadius={6}
              spacing={18}
              height={160}
              maxValue={chartMax}
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor="#EEE"
              hideRules
              isAnimated
              animationDuration={500}
              xAxisLabelTextStyle={styles.xLabel}
              noOfSections={4}
            />

            {stats && (
              <View style={styles.statsBox}>
                <StatRow
                  label="This week's average"
                  value={`${stats.avgAqi} · ${STATUS_LABELS[stats.avgStatus as keyof typeof STATUS_LABELS] ?? stats.avgStatus}`}
                  color={AQI_DARK_COLORS[stats.avgStatus] ?? '#555'}
                />
                <View style={styles.divider} />
                <StatRow
                  label="Worst day"
                  value={`${shortDay(stats.worstDay.date)} (${stats.worstDay.aqi})`}
                  color={AQI_DARK_COLORS[getAQIStatus(stats.worstDay.aqi)] ?? '#555'}
                />
                <View style={styles.divider} />
                <StatRow
                  label="Best day"
                  value={`${shortDay(stats.bestDay.date)} (${stats.bestDay.aqi})`}
                  color={AQI_DARK_COLORS[getAQIStatus(stats.bestDay.aqi)] ?? '#555'}
                />
              </View>
            )}
          </View>
        )}

        {/* ── City Comparison ── */}
        <View style={styles.citySection}>
          <Text style={styles.sectionTitle}>How does your city compare?</Text>
          <Text style={styles.sectionSub}>City averages right now · cleanest first</Text>

          {loadingCities ? (
            COMPARE_CITIES.map((c) => (
              <View key={c} style={styles.skeletonRow}>
                <View style={styles.skeletonDot} />
                <View style={styles.skeletonText} />
                <View style={styles.skeletonNum} />
              </View>
            ))
          ) : (
            <View style={styles.cityList}>
              {cities.map((entry, i) => {
                const norm = entry.city.toLowerCase();
                const isUser = !!userCityNorm && (norm === userCityNorm || userCityNorm.includes(norm) || norm.includes(userCityNorm));
                return <CityRow key={entry.city} entry={entry} isUser={isUser} rank={i + 1} />;
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FA' },
  scroll: { padding: 16, paddingBottom: 40 },

  header: { marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#1A1A1A' },
  headerSub: { fontSize: 13, color: '#888', marginTop: 2 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  sectionSub: { fontSize: 12, color: '#999', marginBottom: 12 },

  // Chart card
  chartCard: {
    backgroundColor: '#FFF', borderRadius: 18, padding: 16, marginBottom: 24,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  chartHint: { fontSize: 11, color: '#AAA', marginBottom: 14 },
  xLabel: { color: '#888', fontSize: 11 },
  statsBox: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 12 },
  divider: { height: 1, backgroundColor: '#F5F5F5' },

  // No data / error state
  noDataBox: {
    backgroundColor: '#FFF', borderRadius: 18, padding: 28, alignItems: 'center', marginBottom: 24,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  noDataEmoji: { fontSize: 40, marginBottom: 12 },
  noDataTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 8, textAlign: 'center' },
  noDataSub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },

  // City comparison
  citySection: {
    backgroundColor: '#FFF', borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cityList: { gap: 2 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
  skeletonDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#EEE' },
  skeletonText: { flex: 1, height: 14, borderRadius: 4, backgroundColor: '#EEE' },
  skeletonNum: { width: 32, height: 14, borderRadius: 4, backgroundColor: '#EEE' },
});
