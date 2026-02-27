import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  getProfiles,
  saveProfiles,
  markOnboardingComplete,
} from '../services/storageService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types';
import { PROFILE_OPTIONS, TIME_SLOTS } from '../constants/onboarding';

const ORANGE = '#FF7E00';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeProfile(type: UserProfile['type'], subTimes: string[]): UserProfile {
  return {
    id: `${type}_${Date.now()}`,
    type,
    name: type,
    goOutTimes: subTimes,
  };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  // Which profile types are selected
  const [selectedTypes, setSelectedTypes] = useState<Set<UserProfile['type']>>(new Set());
  // Sub-options per profile type (e.g. kid → ['morning'])
  const [subSelections, setSubSelections] = useState<Map<UserProfile['type'], Set<string>>>(new Map());
  // Which global timeslots are selected
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());

  // Load current saved profiles on mount
  useEffect(() => {
    (async () => {
      const profiles = await getProfiles();
      const types = new Set<UserProfile['type']>(profiles.map((p) => p.type));
      const subs  = new Map<UserProfile['type'], Set<string>>();
      for (const p of profiles) {
        subs.set(p.type, new Set(p.goOutTimes));
      }
      // Reconstruct global slots from the first profile that has them
      const allSlots = new Set<string>(profiles.flatMap((p) => p.goOutTimes));
      const globalSlots = new Set<string>();
      for (const slot of allSlots) {
        // If this slot isn't a sub-option label for any profile, it's global
        const isSubOption = PROFILE_OPTIONS.some((opt) =>
          opt.subOptions?.some((s) => s.id === slot),
        );
        if (!isSubOption) globalSlots.add(slot);
      }

      setSelectedTypes(types);
      setSubSelections(subs);
      setSelectedSlots(globalSlots);
      setLoading(false);
    })();
  }, []);

  // ── Profile toggle ─────────────────────────────────────────────────────────
  function toggleProfile(type: UserProfile['type']) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function toggleSubOption(type: UserProfile['type'], subId: string) {
    setSubSelections((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(type) ?? []);
      if (current.has(subId)) {
        current.delete(subId);
      } else {
        current.add(subId);
      }
      next.set(type, current);
      return next;
    });
  }

  // ── Timeslot toggle ────────────────────────────────────────────────────────
  function toggleSlot(id: string) {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    const globalTimes = Array.from(selectedSlots);
    const profiles: UserProfile[] = Array.from(selectedTypes).map((type) => {
      const subTimes = Array.from(subSelections.get(type) ?? []);
      return makeProfile(type, [...subTimes, ...globalTimes]);
    });
    await saveProfiles(profiles);
    setSaving(false);
    navigation.goBack();
  }

  // ── Reset (re-do onboarding) ───────────────────────────────────────────────
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
            // App.tsx will detect onboarding incomplete and show onboarding
            Alert.alert('Done', 'Close and re-open the app to restart onboarding.');
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Who's breathing this air? ── */}
        <Text style={styles.sectionTitle}>Who's breathing this air?</Text>
        <Text style={styles.sectionSub}>Select everyone you want air guidance for</Text>

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

                {/* Sub-options (only when selected) */}
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

        {/* ── When do they go out? ── */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>When do they go out?</Text>
        <Text style={styles.sectionSub}>Pick all that apply — we'll alert you at the right times</Text>

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

        {/* ── Save button ── */}
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

        {/* ── Danger zone ── */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.8}>
            <Text style={styles.resetBtnText}>Reset & Re-do Onboarding</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F7F8FA' },
  scroll: { padding: 20, paddingBottom: 48 },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  sectionSub:   { fontSize: 13, color: '#888', marginBottom: 16 },

  // Profile grid (2 columns)
  profileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
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
  profileCardActive: { borderColor: ORANGE, backgroundColor: '#FFF8F3' },
  profileEmoji:      { fontSize: 32, marginBottom: 8 },
  profileLabel:      { fontSize: 13, fontWeight: '600', color: '#555', textAlign: 'center' },
  profileLabelActive:{ color: ORANGE },
  profileCheck: {
    position: 'absolute',
    top: 8,
    right: 10,
    fontSize: 14,
    color: ORANGE,
    fontWeight: '700',
  },

  // Sub-options
  subOptions:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  subChip:         { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: '#F0F0F0', borderWidth: 1, borderColor: '#E0E0E0' },
  subChipActive:   { backgroundColor: '#FFF0E4', borderColor: ORANGE },
  subChipText:     { fontSize: 11, color: '#666', fontWeight: '500' },
  subChipTextActive:{ color: ORANGE, fontWeight: '700' },

  // Timeslot chips
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 24,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  slotChipActive:    { backgroundColor: '#FFF0E4', borderColor: ORANGE },
  slotLabel:         { fontSize: 13, fontWeight: '600', color: '#555' },
  slotLabelActive:   { color: ORANGE },
  slotTime:          { fontSize: 11, color: '#999', marginTop: 2 },
  slotTimeActive:    { color: '#FF9F40' },

  // Save
  saveBtn: {
    marginTop: 32,
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // Danger zone
  dangerZone: {
    marginTop: 36,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingTop: 20,
  },
  dangerTitle: { fontSize: 13, fontWeight: '600', color: '#999', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  resetBtn: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FF4444',
  },
  resetBtnText: { fontSize: 14, fontWeight: '600', color: '#FF4444' },
});
