import React, { useRef, useState } from 'react';
import {
  View,
  ScrollView,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import StepProfiles, { SelectedProfile } from './StepProfiles';
import StepTimeslots from './StepTimeslots';
import StepLocation from './StepLocation';
import { UserProfile } from '../types';
import { saveProfiles, markOnboardingComplete } from '../services/storageService';
import { PROFILE_OPTIONS } from '../constants/onboarding';

interface Props {
  onComplete: () => void;
}

const ORANGE = '#FF7E00';
const TOTAL_STEPS = 3;

export default function OnboardingContainer({ onComplete }: Props) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(0);

  // Collected data
  const [selectedProfiles, setSelectedProfiles] = useState<SelectedProfile[]>([]);
  const [selectedTimeslots, setSelectedTimeslots] = useState<string[]>([]);

  function goToStep(n: number) {
    setStep(n);
    scrollRef.current?.scrollTo({ x: width * n, animated: true });
  }

  async function handleComplete() {
    const profiles: UserProfile[] = selectedProfiles.map((sp, idx) => {
      const option = PROFILE_OPTIONS.find((o) => o.type === sp.type);
      // Profile sub-times (kid school/runner preferred) merged with global slots
      const times = Array.from(
        new Set([...sp.subTimes, ...selectedTimeslots]),
      );
      return {
        id: `${sp.type}_${idx}`,
        type: sp.type,
        name: option?.label ?? sp.type,
        goOutTimes: times.length > 0 ? times : selectedTimeslots,
      };
    });

    await saveProfiles(profiles);
    await markOnboardingComplete();
    onComplete();
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Progress dots */}
      <ProgressDots current={step} total={TOTAL_STEPS} />

      {/* Horizontal pager — scrollEnabled=false; navigation via buttons only */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={styles.pager}
        contentContainerStyle={{ width: width * TOTAL_STEPS }}
      >
        {/* Step 1 */}
        <View style={{ width }}>
          <StepProfiles
            selected={selectedProfiles}
            onChange={setSelectedProfiles}
            onNext={() => goToStep(1)}
          />
        </View>

        {/* Step 2 */}
        <View style={{ width }}>
          <StepTimeslots
            selected={selectedTimeslots}
            onChange={setSelectedTimeslots}
            onNext={() => goToStep(2)}
          />
        </View>

        {/* Step 3 */}
        <View style={{ width }}>
          <StepLocation onComplete={handleComplete} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current && styles.dotActive,
            i < current && styles.dotPast,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  dotActive: {
    width: 24,
    borderRadius: 4,
    backgroundColor: ORANGE,
  },
  dotPast: {
    backgroundColor: '#FFD1A3',
  },

  pager: { flex: 1 },
});
