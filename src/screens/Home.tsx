import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useLocation } from '../hooks/useLocation';
import { useAQI } from '../hooks/useAQI';
import { useProfiles } from '../hooks/useProfiles';
import AQICard from '../components/AQICard';
import GuidanceCard from '../components/GuidanceCard';
import SkeletonCard from '../components/SkeletonCard';
import { claudeService } from '../services/claudeService';
import { AQI_COLORS } from '../constants/colors';
import { getHardcodedGuidance } from '../constants/thresholds';
import { HourlyForecast, GuidanceCard as GuidanceCardType } from '../types';

const ORANGE = '#FF7E00';

function getGreeting(): { text: string; timeOfDay: 'morning' | 'afternoon' | 'evening' } {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good morning', timeOfDay: 'morning' };
  if (h < 17) return { text: 'Good afternoon', timeOfDay: 'afternoon' };
  return { text: 'Good evening', timeOfDay: 'evening' };
}

function formatHour(h: number): string {
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

interface BestWindow { label: string; avgAqi: number; startHour: number }

function findBestWindow(forecast: HourlyForecast[]): BestWindow | null {
  if (forecast.length < 2) return null;
  let bestIdx = 0;
  let bestSum = forecast[0].aqi + forecast[1].aqi;
  for (let i = 1; i < forecast.length - 1; i++) {
    const sum = forecast[i].aqi + forecast[i + 1].aqi;
    if (sum < bestSum) {
      bestSum = sum;
      bestIdx = i;
    }
  }
  const h = forecast[bestIdx].hour;
  return {
    label: `${formatHour(h)} – ${formatHour(h + 2)}`,
    avgAqi: Math.round(bestSum / 2),
    startHour: h,
  };
}

function aqiDotColor(aqi: number): string {
  if (aqi <= 50) return AQI_COLORS.Good;
  if (aqi <= 100) return AQI_COLORS.Moderate;
  if (aqi <= 150) return AQI_COLORS.UnhealthySensitive;
  if (aqi <= 200) return AQI_COLORS.Unhealthy;
  return AQI_COLORS.VeryUnhealthy;
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const { lat, lng, city, subArea, permissionStatus, loading: locLoading } = useLocation();
  const { current, forecast, loading: aqiLoading, error, refresh } = useAQI({
    lat, lng, city, enabled: lat !== null && lng !== null,
  });
  const { profiles } = useProfiles();
  const [aiGuidance, setAiGuidance] = React.useState<GuidanceCardType[] | null>(null);
  const [aiLoading, setAiLoading] = React.useState(false);
  const aiFadeAnim = useRef(new Animated.Value(1)).current;

  // showSkeleton: true while location resolving OR waiting for first AQI load
  const showSkeleton = locLoading || (!current && (aqiLoading || (lat === null && permissionStatus !== 'denied')));
  const showError    = !current && !showSkeleton && !!error;
  const showDenied   = permissionStatus === 'denied' && lat === null && !showSkeleton;

  const { text: greetingText, timeOfDay } = getGreeting();

  const bestWindow = forecast.length >= 2 ? findBestWindow(forecast) : null;
  const guidanceCards = aiGuidance ?? (current ? getHardcodedGuidance(current.aqi, profiles) : []);
  const aqiColor = current ? AQI_COLORS[current.status] : ORANGE;

  const prevAqiRef = useRef<number | null>(null);
  const prevProfilesHash = useRef<string | null>(null);

  React.useEffect(() => {
    if (current && profiles && !showSkeleton) {
      // Determine if we should bust cache based on significant changes or manual refresh
      const profilesHash = profiles.map(p => `${p.id}_${p.type}_${p.name}`).sort().join('|');
      const aqiChange = prevAqiRef.current !== null && Math.abs(current.aqi - prevAqiRef.current) >= 5;
      const profilesChanged = prevProfilesHash.current !== null && profilesHash !== prevProfilesHash.current;

      // We bust if things changed significantly or if we just toggled loading from a manual refresh
      const shouldBust = aqiChange || profilesChanged;

      setAiLoading(true);
      console.log(`Home: Fetching AI Guidance (bust=${shouldBust})...`);
      claudeService.generateDailyGuidance({
        aqi: current.aqi,
        status: current.status,
        dominantPollutant: current.dominantPollutant,
        pm25: current.pm25,
        city: city ?? 'Unknown',
        profiles,
        hourlyForecast: forecast,
        bestWindowHour: bestWindow ? bestWindow.startHour : null,
        timeOfDay
      }, shouldBust).then(cards => {
        prevAqiRef.current = current.aqi;
        prevProfilesHash.current = profilesHash;
        console.log('Home: Received AI cards', cards.length);

        // Deep comparison or at least length-based to avoid redundant animations
        const isSame = aiGuidance &&
          cards.length === aiGuidance.length &&
          cards.every((c, i) => c.message === aiGuidance[i].message);

        if (!isSame) {
          console.log('Home: Updating AI cards with animation');
          Animated.timing(aiFadeAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            setAiGuidance(cards);
            setAiLoading(false);
            Animated.timing(aiFadeAnim, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }).start();
          });
        } else {
          console.log('Home: AI cards identical to current state, skipping animation');
          setAiLoading(false);
        }
      }).catch(err => {
        console.log('Home: Error fetching AI guidance', err);
        setAiLoading(false);
      });
    }
  }, [current, profiles, showSkeleton]);


  const staleHoursAgo = current?.isStale
    ? Math.round((Date.now() - new Date(current.updatedAt).getTime()) / 3_600_000)
    : 0;

  const locationLine = locLoading
    ? '…'
    : subArea ? `${subArea} · ${city}` : city ?? 'Your location';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={aqiLoading && !!current}
            onRefresh={refresh}
            tintColor={ORANGE}
            colors={[ORANGE]}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{greetingText}</Text>
            <Text style={styles.city} numberOfLines={1}>{locationLine}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Settings' as never)}
              style={styles.iconBtn} activeOpacity={0.7}
            >
              <Text style={styles.iconBtnText}>⚙️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={refresh} style={styles.iconBtn} activeOpacity={0.7}>
              <Text style={styles.iconBtnText}>↻</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Skeletons ── */}
        {showSkeleton && (
          <>
            <SkeletonCard height={220} style={styles.mb16} />
            <SkeletonCard height={70} style={styles.mb10} />
            <SkeletonCard height={70} style={styles.mb10} />
            <SkeletonCard height={70} style={styles.mb10} />
          </>
        )}

        {/* ── Location denied ── */}
        {showDenied && (
          <View style={styles.centerBox}>
            <Text style={styles.errorIcon}>📍</Text>
            <Text style={styles.errorTitle}>Location not enabled</Text>
            <Text style={styles.errorSub}>Enable location in Settings to get real-time local AQI</Text>
          </View>
        )}

        {/* ── Hard error ── */}
        {showError && (
          <View style={styles.centerBox}>
            <Text style={styles.errorIcon}>🌫️</Text>
            <Text style={styles.errorTitle}>Couldn't reach air sensors</Text>
            <Text style={styles.errorSub}>Check your connection and try again</Text>
            <TouchableOpacity onPress={refresh} style={styles.retryBtn} activeOpacity={0.8}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Main content ── */}
        {current && !showSkeleton && (
          <>
            {/* AQI card (no stale strip inside — avoids overflow:hidden touch issues) */}
            <AQICard data={current} />

            {/* Stale banner — lives OUTSIDE the card so touch always works */}
            {current.isStale && (
              <View style={styles.staleRow}>
                <Text style={styles.staleRowText}>
                  ⚠️  Nearest station hasn't reported in {staleHoursAgo}h — readings may be outdated
                </Text>
              </View>
            )}

            <View style={styles.spacer} />

            {/* Best time strip */}
            {bestWindow && (
              <TouchableOpacity
                style={styles.bestTimeStrip}
                activeOpacity={0.75}
                onPress={() => navigation.navigate('Forecast' as never)}
              >
                <View style={[styles.bestTimeDot, { backgroundColor: aqiDotColor(bestWindow.avgAqi) }]} />
                <Text style={styles.bestTimeText}>
                  Best window: <Text style={styles.bestTimeHighlight}>{bestWindow.label}</Text>
                  {'  '}(AQI ~{bestWindow.avgAqi})
                </Text>
                <Text style={styles.bestTimeChevron}>›</Text>
              </TouchableOpacity>
            )}

            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Your Guide Today</Text>
              {aiLoading && <Text style={styles.aiLoadingText}>✨ Loading AI...</Text>}
              {!aiLoading && aiGuidance !== null && (
                <TouchableOpacity
                  style={styles.aiChip}
                  activeOpacity={0.7}
                  onPress={() => alert('Personalized by AI based on your profiles')} // Note: ideally a nice toast or modal
                >
                  <Text style={styles.aiChipText}>✨ AI</Text>
                </TouchableOpacity>
              )}
            </View>

            {profiles.length === 0 ? (
              <TouchableOpacity
                style={styles.noProfilesBox}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Settings' as never)}
              >
                <Text style={styles.noProfilesText}>
                  Tap here to add your profiles and get personalised guidance →
                </Text>
              </TouchableOpacity>
            ) : (
              <Animated.View style={{ opacity: aiFadeAnim }}>
                {guidanceCards.map((card, i) => (
                  <GuidanceCard key={i} data={card} aqiColor={aqiColor} />
                ))}
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FA' },
  scroll: { padding: 16, paddingBottom: 32 },
  mb16: { marginBottom: 16 },
  mb10: { marginBottom: 10 },
  spacer: { height: 16 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerLeft: { flex: 1, marginRight: 8 },
  greeting: { fontSize: 14, color: '#888', fontWeight: '500', marginBottom: 2 },
  city: { fontSize: 22, fontWeight: '700', color: ORANGE },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  iconBtnText: { fontSize: 18 },

  // Stale banner — rendered BELOW the card, outside any clipping context
  staleRow: {
    backgroundColor: 'rgba(255,200,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(200,160,0,0.25)',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: -1, // kiss the card's bottom edge
  },
  staleRowText: { fontSize: 12, color: '#7A5800', fontWeight: '600', textAlign: 'center' },

  bestTimeStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1, gap: 10,
  },
  bestTimeDot: { width: 10, height: 10, borderRadius: 5 },
  bestTimeText: { flex: 1, fontSize: 14, color: '#444' },
  bestTimeHighlight: { fontWeight: '700', color: '#1A1A1A' },
  bestTimeChevron: { fontSize: 18, color: '#CCC' },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  aiLoadingText: { fontSize: 13, color: '#888', fontStyle: 'italic' },
  aiChip: { backgroundColor: '#F0E6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  aiChipText: { fontSize: 12, fontWeight: '600', color: '#7E3FE4' },

  centerBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  errorIcon: { fontSize: 56, marginBottom: 16 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8, textAlign: 'center' },
  errorSub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: 24, backgroundColor: ORANGE, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12 },
  retryText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  noProfilesBox: { backgroundColor: '#FFF3E8', borderRadius: 14, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#FFD9B0' },
  noProfilesText: { fontSize: 14, color: ORANGE, textAlign: 'center', lineHeight: 20, fontWeight: '600' },
});
