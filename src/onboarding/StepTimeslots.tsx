import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { TIME_SLOTS } from '../constants/onboarding';

interface Props {
  selected: string[];
  onChange: (slots: string[]) => void;
  onNext: () => void;
}

const ORANGE = '#FF7E00';

export default function StepTimeslots({ selected, onChange, onNext }: Props) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>When do you usually{'\n'}step out?</Text>
        <Text style={styles.subtitle}>We'll give you a heads-up before these times</Text>

        <View style={styles.chipsWrap}>
          {TIME_SLOTS.map((slot) => {
            const active = selected.includes(slot.id);
            return (
              <TouchableOpacity
                key={slot.id}
                activeOpacity={0.7}
                onPress={() => toggle(slot.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {slot.label}
                </Text>
                {slot.time !== '' && (
                  <Text style={[styles.chipTime, active && styles.chipTimeActive]}>
                    {slot.time}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.hint}>You can skip this and set it later</Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={onNext}
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

  title: { fontSize: 26, fontWeight: '700', color: '#1A1A1A', marginBottom: 6, lineHeight: 34 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 32 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  chip: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    backgroundColor: '#FFF',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  chipActive: {
    borderColor: ORANGE,
    backgroundColor: ORANGE,
  },
  chipLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  chipLabelActive: { color: '#FFF' },
  chipTime: { fontSize: 12, color: '#999', marginTop: 2 },
  chipTimeActive: { color: 'rgba(255,255,255,0.8)' },

  hint: { marginTop: 28, fontSize: 13, color: '#BABABA', textAlign: 'center' },

  footer: { padding: 24, paddingTop: 12 },
  nextBtn: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
});
