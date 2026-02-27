import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getProfiles,
  saveProfiles,
  getLastKnownAQI,
} from '../services/storageService';
import {
  NotificationSettings,
  formatMorningTime,
  getNextMorningLabel,
  getNotificationSettings,
  saveNotificationSettings,
  morningTimeFromProfiles,
  scheduleAllNotifications,
} from '../services/notificationService';
import { UserProfile } from '../types';
import { PROFILE_OPTIONS, TIME_SLOTS } from '../constants/onboarding';

const ORANGE = '#FF7E00';
const BG     = '#F7F8FA';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeProfile(type: UserProfile['type'], subTimes: string[]): UserProfile {
  return {
    id: `${type}_${Date.now()}`,
    type,
    name: type,
    goOutTimes: subTimes,
  };
}

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

export default function SettingsScreen() {
  const navigation = useNavigation();

  const [loading, setSaving_loading] = useState(true);
  const [saving,  setSaving]         = useState(false);

  // Notification settings
  const [notifSettings,  setNotifSettings]  = useState<NotificationSettings | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Preference state
  const [selectedTypes, setSelectedTypes] = useState<Set<UserProfile['type']>>(new Set());
  const [subSelections, setSubSelections] = useState<Map<UserProfile['type'], Set<string>>>(new Map());
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());

  // ── Load preferences on mount ───────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const profiles = await getProfiles();
      const types = new Set<UserProfile['type']>(profiles.map((p) => p.type));
      const subs  = new Map<UserProfile['type'], Set<string>>();
      for (const p of profiles) {
        subs.set(p.type, new Set(p.goOutTimes));
      }
      const allSlots    = new Set<string>(profiles.flatMap((p) => p.goOutTimes));
      const globalSlots = new Set<string>();
      for (const slot of allSlots) {
        const isSubOption = PROFILE_OPTIONS.some((opt) =>
          opt.subOptions?.some((s) => s.id === slot),
        );
        if (!isSubOption) globalSlots.add(slot);
      }
      setSelectedTypes(types);
      setSubSelections(subs);
      setSelectedSlots(globalSlots);
      setSaving_loading(false);
    })();
  }, []);

  // ── Reload notification settings whenever tab is focused ────────────────────
  useFocusEffect(
    useCallback(() => {
      getNotificationSettings().then(setNotifSettings);
    }, []),
  );

  // ── Profile toggle ──────────────────────────────────────────────────────────
  function toggleProfile(type: UserProfile['type']) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function toggleSubOption(type: UserProfile['type'], subId: string) {
    setSubSelections((prev) => {
      const next    = new Map(prev);
      const current = new Set(next.get(type) ?? []);
      if (current.has(subId)) current.delete(subId);
      else current.add(subId);
      next.set(type, current);
      return next;
    });
  }

  // ── Timeslot toggle ─────────────────────────────────────────────────────────
  function toggleSlot(id: string) {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Notification helpers ────────────────────────────────────────────────────
  async function applyNotifSettings(next: NotificationSettings) {
    setNotifSettings(next);
    await saveNotificationSettings(next);
    const lastKnown = await getLastKnownAQI();
    await scheduleAllNotifications(next, lastKnown?.city ?? 'your city');
  }

  function toggleMorning(v: boolean) {
    if (!notifSettings) return;
    applyNotifSettings({ ...notifSettings, morningEnabled: v });
  }

  function toggleSpike(v: boolean) {
    if (!notifSettings) return;
    applyNotifSettings({ ...notifSettings, spikeEnabled: v });
  }

  function toggleCleanAir(v: boolean) {
    if (!notifSettings) return;
    applyNotifSettings({ ...notifSettings, cleanAirEnabled: v });
  }

  // ── Time picker ─────────────────────────────────────────────────────────────
  function handleTimeChange(_: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (!date || !notifSettings) return;
    applyNotifSettings({
      ...notifSettings,
      morningHour:         date.getHours(),
      morningMinute:       date.getMinutes(),
      morningTimeIsCustom: true,
    });
  }

  function confirmIOSTime() {
    setShowTimePicker(false);
  }

  // ── Save preferences ────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    const globalTimes = Array.from(selectedSlots);
    const profiles: UserProfile[] = Array.from(selectedTypes).map((type) => {
      const subTimes = Array.from(subSelections.get(type) ?? []);
      return makeProfile(type, [...subTimes, ...globalTimes]);
    });
    await saveProfiles(profiles);

    // Reschedule morning notification if the user hasn't manually set a custom time
    try {
      const ns = notifSettings ?? (await getNotificationSettings());
      if (!ns.morningTimeIsCustom) {
        const { hour, minute } = morningTimeFromProfiles(profiles);
        const updated = { ...ns, morningHour: hour, morningMinute: minute };
        await saveNotificationSettings(updated);
        setNotifSettings(updated);
      }
      const lastKnown = await getLastKnownAQI();
      if (lastKnown) {
        await scheduleAllNotifications(notifSettings ?? ns, lastKnown.city);
      }
    } catch {}

    setSaving(false);
    navigation.goBack();
  }

  // ── Reset ───────────────────────────────────────────────────────────────────
  function handleReset() {
    Alert.alert(
      'Reset App',
      'This will clear all your data and restart onboarding. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            Alert.alert('Done', 'Close and re-open the app to restart onboarding.');
          },
        },
      ],
    );
  }

  if (loading || !notifSettings) {
    return (
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const pickerDate = new Date();
  pickerDate.setHours(notifSettings.morningHour, notifSettings.morningMinute, 0, 0);
  const morningTimeLabel = formatMorningTime(notifSettings.morningHour, notifSettings.morningMinute);
  const nextLabel        = getNextMorningLabel(notifSettings.morningHour, notifSettings.morningMinute);

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ══════════════════════════════════ PREFERENCES ══ */}
        <SectionHeader
          title="Preferences"
          sub="Personalise guidance for everyone at home"
        />

        {/* Who's breathing */}
        <Text style={styles.subLabel}>Who's breathing this air?</Text>
        <Text style={styles.subLabelHint}>Select everyone you want air guidance for</Text>

        <View style={styles.profileGrid}>
          {PROFILE_OPTIONS.map((opt) => {
            const selected = selectedTypes.has(opt.type);
            return (
              <View key={opt.type} style={styles.profileCardWrap}>
                <TouchableOpacity
                  style={[styles.profileCard, selected && styles.profileCardActive]}
                  activeOpacity={0.75}
                  onPress={() => toggleProfile(opt.type)}
                >
                  <Text style={styles.profileEmoji}>{opt.emoji}</Text>
                  <Text style={[styles.profileLabel, selected && styles.profileLabelActive]}>
                    {opt.label}
                  </Text>
                  {selected && <Text style={styles.profileCheck}>✓</Text>}
                </TouchableOpacity>

                {selected && opt.subOptions && (
                  <View style={styles.subOptions}>
                    {opt.subOptions.map((sub) => {
                      const subSelected = subSelections.get(opt.type)?.has(sub.id) ?? false;
                      return (
                        <TouchableOpacity
                          key={sub.id}
                          style={[styles.subChip, subSelected && styles.subChipActive]}
                          onPress={() => toggleSubOption(opt.type, sub.id)}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.subChipText, subSelected && styles.subChipTextActive]}>
                            {sub.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* When do they go out */}
        <Text style={[styles.subLabel, { marginTop: 24 }]}>When do they go out?</Text>
        <Text style={styles.subLabelHint}>Pick all that apply — we'll alert you at the right times</Text>

        <View style={styles.slotRow}>
          {TIME_SLOTS.map((slot) => {
            const active = selectedSlots.has(slot.id);
            return (
              <TouchableOpacity
                key={slot.id}
                style={[styles.slotChip, active && styles.slotChipActive]}
                activeOpacity={0.75}
                onPress={() => toggleSlot(slot.id)}
              >
                <Text style={[styles.slotLabel, active && styles.slotLabelActive]}>
                  {slot.label}
                </Text>
                {slot.time ? (
                  <Text style={[styles.slotTime, active && styles.slotTimeActive]}>
                    {slot.time}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.saveBtnText}>Save Changes</Text>
          }
        </TouchableOpacity>

        {/* ══════════════════════════════════ NOTIFICATIONS ══ */}
        <View style={styles.notifSectionGap}>
          <SectionHeader
            title="Notifications"
            sub="Up to 2 smart alerts per day"
          />
        </View>

        <View style={styles.notifCard}>
          {/* Morning briefing */}
          <ToggleRow
            icon="🌅"
            label="Morning briefing"
            sub={
              notifSettings.morningEnabled
                ? `${morningTimeLabel} daily · Next: ${nextLabel}`
                : 'Tap to enable'
            }
            value={notifSettings.morningEnabled}
            onToggle={toggleMorning}
            onPress={() => notifSettings.morningEnabled && setShowTimePicker(true)}
          />

          {notifSettings.morningEnabled && (
            <TouchableOpacity
              style={styles.changeTimeBtn}
              onPress={() => setShowTimePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.changeTimeBtnText}>Change time  ›</Text>
            </TouchableOpacity>
          )}

          <View style={styles.divider} />

          {/* Spike alert */}
          <ToggleRow
            icon="⚠️"
            label="Unhealthy air alert"
            sub="When AQI crosses 200 — at most once every 6h"
            value={notifSettings.spikeEnabled}
            onToggle={toggleSpike}
          />

          <View style={styles.divider} />

          {/* Clean air alert */}
          <ToggleRow
            icon="🌿"
            label="Clean air window"
            sub="When air clears after a bad spell — once a day"
            value={notifSettings.cleanAirEnabled}
            onToggle={toggleCleanAir}
          />
        </View>

        {/* How it works */}
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

        {/* ── Danger zone ── */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.8}>
            <Text style={styles.resetBtnText}>Reset & Re-do Onboarding</Text>
          </TouchableOpacity>
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

      {/* ── Android time picker ── */}
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
  root:   { flex: 1, backgroundColor: BG },
  scroll: { padding: 20, paddingBottom: 48 },

  // Section headers
  sectionHeader: { marginBottom: 14 },
  sectionTitle:  { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
  sectionSub:    { fontSize: 13, color: '#888', marginTop: 2 },

  // Sub-labels (within a section)
  subLabel:     { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 3 },
  subLabelHint: { fontSize: 12, color: '#888', marginBottom: 14 },

  // Profile grid (2 columns)
  profileGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  profileCardWrap: { width: '47%' },
  profileCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    position: 'relative',
  },
  profileCardActive:  { borderColor: ORANGE, backgroundColor: '#FFF8F3' },
  profileEmoji:       { fontSize: 32, marginBottom: 8 },
  profileLabel:       { fontSize: 13, fontWeight: '600', color: '#555', textAlign: 'center' },
  profileLabelActive: { color: ORANGE },
  profileCheck: {
    position: 'absolute',
    top: 8, right: 10,
    fontSize: 14, color: ORANGE, fontWeight: '700',
  },

  // Sub-options
  subOptions:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  subChip:          { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: '#F0F0F0', borderWidth: 1, borderColor: '#E0E0E0' },
  subChipActive:    { backgroundColor: '#FFF0E4', borderColor: ORANGE },
  subChipText:      { fontSize: 11, color: '#666', fontWeight: '500' },
  subChipTextActive:{ color: ORANGE, fontWeight: '700' },

  // Timeslot chips
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotChip: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 24, backgroundColor: '#FFF',
    borderWidth: 1.5, borderColor: '#E0E0E0',
  },
  slotChipActive: { backgroundColor: '#FFF0E4', borderColor: ORANGE },
  slotLabel:      { fontSize: 13, fontWeight: '600', color: '#555' },
  slotLabelActive:{ color: ORANGE },
  slotTime:       { fontSize: 11, color: '#999', marginTop: 2 },
  slotTimeActive: { color: '#FF9F40' },

  // Save button
  saveBtn: {
    marginTop: 28,
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // Notifications section gap
  notifSectionGap: { marginTop: 36 },

  // Notification card
  notifCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
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

  // Change time button
  changeTimeBtn: {
    marginLeft: 40, marginBottom: 4, paddingVertical: 4,
  },
  changeTimeBtnText: { fontSize: 13, color: ORANGE, fontWeight: '600' },

  divider: { height: 1, backgroundColor: '#F2F2F2', marginHorizontal: -16 },

  // How it works card
  howCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  howTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  howItem:  { fontSize: 12, color: '#555', lineHeight: 18, marginBottom: 6 },
  howBold:  { fontWeight: '700', color: '#333' },

  // Danger zone
  dangerZone: {
    marginTop: 28,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingTop: 20,
  },
  dangerTitle: { fontSize: 12, fontWeight: '600', color: '#999', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  resetBtn: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FF4444',
  },
  resetBtnText: { fontSize: 14, fontWeight: '600', color: '#FF4444' },

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
