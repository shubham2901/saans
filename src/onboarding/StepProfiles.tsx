import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { PROFILE_OPTIONS, ProfileOption } from '../constants/onboarding';
import { UserProfile } from '../types';

export interface SelectedProfile {
  type: UserProfile['type'];
  subTimes: string[];
}

interface Props {
  selected: SelectedProfile[];
  onChange: (profiles: SelectedProfile[]) => void;
  onNext: () => void;
}

const ORANGE = '#FF7E00';

export default function StepProfiles({ selected, onChange, onNext }: Props) {
  const canProceed = selected.length > 0;

  const isSelected = (type: UserProfile['type']) =>
    selected.some((s) => s.type === type);

  const getSubTimes = (type: UserProfile['type']): string[] =>
    selected.find((s) => s.type === type)?.subTimes ?? [];

  function toggleProfile(option: ProfileOption) {
    if (isSelected(option.type)) {
      onChange(selected.filter((s) => s.type !== option.type));
    } else {
      onChange([...selected, { type: option.type, subTimes: [] }]);
    }
  }

  function toggleSubTime(type: UserProfile['type'], subId: string) {
    onChange(
      selected.map((s) => {
        if (s.type !== type) return s;
        const has = s.subTimes.includes(subId);
        return {
          ...s,
          subTimes: has
            ? s.subTimes.filter((t) => t !== subId)
            : [...s.subTimes, subId],
        };
      }),
    );
  }

  // Lay out as 2-col grid; last item (asthma) spans full width if count is odd
  const rows: ProfileOption[][] = [];
  for (let i = 0; i < PROFILE_OPTIONS.length; i += 2) {
    rows.push(PROFILE_OPTIONS.slice(i, i + 2));
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Who are you protecting?</Text>
        <Text style={styles.subtitle}>Select all that apply</Text>

        {rows.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((option) => {
              const sel = isSelected(option.type);
              const subTimes = getSubTimes(option.type);
              const isFullWidth = PROFILE_OPTIONS.length % 2 !== 0 && ri === rows.length - 1 && row.length === 1;

              return (
                <TouchableOpacity
                  key={option.type}
                  activeOpacity={0.7}
                  onPress={() => toggleProfile(option)}
                  style={[
                    styles.card,
                    sel && styles.cardSelected,
                    isFullWidth && styles.cardFull,
                  ]}
                >
                  <Text style={styles.emoji}>{option.emoji}</Text>
                  <Text style={[styles.cardLabel, sel && styles.cardLabelSelected]}>
                    {option.label}
                  </Text>

                  {sel && option.subOptions && (
                    <View style={styles.subSection}>
                      <Text style={styles.subHeading}>Timing</Text>
                      <View style={styles.subRow}>
                        {option.subOptions.map((sub) => {
                          const active = subTimes.includes(sub.id);
                          return (
                            <TouchableOpacity
                              key={sub.id}
                              activeOpacity={0.7}
                              onPress={() => toggleSubTime(option.type, sub.id)}
                              style={[styles.subChip, active && styles.subChipActive]}
                            >
                              <Text style={[styles.subChipText, active && styles.subChipTextActive]}>
                                {sub.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
          onPress={onNext}
          disabled={!canProceed}
          activeOpacity={0.8}
        >
          <Text style={styles.nextBtnText}>Next →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 8 },

  title: { fontSize: 26, fontWeight: '700', color: '#1A1A1A', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 24 },

  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },

  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardSelected: {
    borderColor: ORANGE,
    backgroundColor: '#FFF3E8',
  },
  cardFull: { flex: 0, width: '100%' },

  emoji: { fontSize: 32, marginBottom: 8 },
  cardLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', textAlign: 'center' },
  cardLabelSelected: { color: ORANGE },

  subSection: { width: '100%', marginTop: 12, borderTopWidth: 1, borderTopColor: '#FFD9B3', paddingTop: 10 },
  subHeading: { fontSize: 11, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, textAlign: 'center' },
  subRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  subChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    backgroundColor: '#FFF',
  },
  subChipActive: { borderColor: ORANGE, backgroundColor: ORANGE },
  subChipText: { fontSize: 12, color: '#666', fontWeight: '500' },
  subChipTextActive: { color: '#FFF' },

  footer: { padding: 24, paddingTop: 12 },
  nextBtn: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: '#E8E8E8' },
  nextBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
});
