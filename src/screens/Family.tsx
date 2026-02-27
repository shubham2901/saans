import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  NotificationSettings,
  formatMorningTime,
  getNextMorningLabel,
  getNotificationSettings,
  saveNotificationSettings,
  scheduleAllNotifications,
} from '../services/notificationService';
import { getLastKnownAQI } from '../services/storageService';

const ORANGE  = '#FF7E00';
const BG      = '#F7F8FA';

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({
  icon,
  label,
  sub,
  value,
  onToggle,
  onPress,
}: {
  icon:     string;
  label:    string;
  sub:      string;
  value:    boolean;
  onToggle: (v: boolean) => void;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.toggleRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <Text style={styles.toggleIcon}>{icon}</Text>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#DDD', true: ORANGE }}
        thumbColor="#FFF"
        ios_backgroundColor="#DDD"
      />
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FamilyScreen() {
  const [settings,       setSettings]       = useState<NotificationSettings | null>(null);
  const [city,           setCity]           = useState('your city');
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Reload settings whenever the tab is focused
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [s, lastKnown] = await Promise.all([
          getNotificationSettings(),
          getLastKnownAQI(),
        ]);
        setSettings(s);
        if (lastKnown?.city) setCity(lastKnown.city);
      })();
    }, []),
  );

  // ── Persist + reschedule whenever settings change ────────────────────────
  async function applySettings(next: NotificationSettings) {
    setSettings(next);
    await saveNotificationSettings(next);
    await scheduleAllNotifications(next, city);
  }

  function toggleMorning(v: boolean) {
    if (!settings) return;
    applySettings({ ...settings, morningEnabled: v });
  }

  function toggleSpike(v: boolean) {
    if (!settings) return;
    applySettings({ ...settings, spikeEnabled: v });
  }

  function toggleCleanAir(v: boolean) {
    if (!settings) return;
    applySettings({ ...settings, cleanAirEnabled: v });
  }

  // ── Time picker ──────────────────────────────────────────────────────────
  function handleTimeChange(_: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (!date || !settings) return;
    const next: NotificationSettings = {
      ...settings,
      morningHour:         date.getHours(),
      morningMinute:       date.getMinutes(),
      morningTimeIsCustom: true,
    };
    applySettings(next);
  }

  function confirmIOSTime() {
    setShowTimePicker(false);
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (!settings) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.loadingBox} />
      </SafeAreaView>
    );
  }

  // Build the Date object used by the time picker
  const pickerDate = new Date();
  pickerDate.setHours(settings.morningHour, settings.morningMinute, 0, 0);

  const morningTimeLabel = formatMorningTime(settings.morningHour, settings.morningMinute);
  const nextLabel        = getNextMorningLabel(settings.morningHour, settings.morningMinute);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSub}>Stay ahead of the air</Text>
        </View>

        {/* ── Notification settings card ── */}
        <View style={styles.card}>
          <SectionHeader
            title="Alert types"
            sub="You'll receive up to 2 alerts per day"
          />

          {/* Morning briefing */}
          <ToggleRow
            icon="🌅"
            label="Morning briefing"
            sub={
              settings.morningEnabled
                ? `${morningTimeLabel} daily · Next: ${nextLabel}`
                : 'Tap to enable'
            }
            value={settings.morningEnabled}
            onToggle={toggleMorning}
            onPress={() => settings.morningEnabled && setShowTimePicker(true)}
          />

          {settings.morningEnabled && (
            <TouchableOpacity
              style={styles.changeTimeBtn}
              onPress={() => setShowTimePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.changeTimeBtnText}>
                Change time  ›
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.divider} />

          {/* Spike alert */}
          <ToggleRow
            icon="⚠️"
            label="Unhealthy air alert"
            sub="When AQI crosses 200 — at most once every 6h"
            value={settings.spikeEnabled}
            onToggle={toggleSpike}
          />

          <View style={styles.divider} />

          {/* Clean air alert */}
          <ToggleRow
            icon="🌿"
            label="Clean air window"
            sub="When air clears after a bad spell — once a day"
            value={settings.cleanAirEnabled}
            onToggle={toggleCleanAir}
          />
        </View>

        {/* ── How it works ── */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How notifications work</Text>
          <Text style={styles.howItem}>
            <Text style={styles.howBold}>Morning briefing</Text>
            {'  '}Scheduled locally — fires at the exact time you set, even without internet.
          </Text>
          <Text style={styles.howItem}>
            <Text style={styles.howBold}>Alerts</Text>
            {'  '}Checked each time you open the app. If conditions are met, an alert fires immediately.
          </Text>
        </View>
      </ScrollView>

      {/* ── iOS time picker modal ── */}
      {Platform.OS === 'ios' && showTimePicker && (
        <Modal transparent animationType="slide" visible={showTimePicker}>
          <View style={styles.pickerBackdrop}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Morning briefing time</Text>
                <TouchableOpacity onPress={confirmIOSTime}>
                  <Text style={styles.pickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pickerDate}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                textColor="#1A1A1A"
              />
            </View>
          </View>
        </Modal>
      )}

      {/* ── Android time picker (native dialog, no modal needed) ── */}
      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: BG },
  scroll:     { padding: 16, paddingBottom: 48 },
  loadingBox: { flex: 1 },

  header:      { marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#1A1A1A' },
  headerSub:   { fontSize: 13, color: '#888', marginTop: 2 },

  // Section header
  sectionHeader: { marginBottom: 16 },
  sectionTitle:  { fontSize: 14, fontWeight: '700', color: '#1A1A1A', letterSpacing: 0.3 },
  sectionSub:    { fontSize: 12, color: '#999', marginTop: 3 },

  // Card
  card: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // Toggle row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  toggleIcon:  { fontSize: 22, width: 28, textAlign: 'center' },
  toggleText:  { flex: 1 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  toggleSub:   { fontSize: 12, color: '#999', marginTop: 2 },

  // Change time button (below morning row when enabled)
  changeTimeBtn: {
    marginLeft: 40,
    marginBottom: 4,
    paddingVertical: 4,
  },
  changeTimeBtnText: {
    fontSize: 13,
    color: ORANGE,
    fontWeight: '600',
  },

  divider: { height: 1, backgroundColor: '#F2F2F2', marginHorizontal: -16 },

  // How it works card
  howCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  howTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 },
  howItem:  { fontSize: 13, color: '#555', lineHeight: 20, marginBottom: 8 },
  howBold:  { fontWeight: '700', color: '#333' },

  // iOS time picker modal
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  pickerDone:  { fontSize: 16, color: ORANGE, fontWeight: '700' },
});
