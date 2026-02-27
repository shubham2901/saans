import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PREFERRED_CITY_KEY } from '../services/storageService';

interface Props {
  onComplete: () => void;
}

type Step = 'initial' | 'requesting' | 'denied' | 'granted';

const ORANGE = '#FF7E00';

export default function StepLocation({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('initial');
  const [cityInput, setCityInput] = useState('');

  async function requestLocation() {
    setStep('requesting');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setStep('granted');
      // Small pause so user sees the granted confirmation
      setTimeout(onComplete, 700);
    } else {
      setStep('denied');
    }
  }

  async function continueWithCity() {
    if (cityInput.trim()) {
      await AsyncStorage.setItem(PREFERRED_CITY_KEY, cityInput.trim());
    }
    onComplete();
  }

  function openSettings() {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }

  // ─── Granted confirmation ────────────────────────────────────────────────────
  if (step === 'granted') {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.grantedIcon}>✅</Text>
        <Text style={styles.grantedText}>Location enabled!</Text>
      </View>
    );
  }

  // ─── Requesting spinner ──────────────────────────────────────────────────────
  if (step === 'requesting') {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={ORANGE} />
        <Text style={styles.requestingText}>Waiting for permission…</Text>
      </View>
    );
  }

  // ─── Denied state ────────────────────────────────────────────────────────────
  if (step === 'denied') {
    return (
      <View style={styles.root}>
        <View style={styles.content}>
          <Text style={styles.icon}>📍</Text>
          <Text style={styles.title}>Location access denied</Text>
          <Text style={styles.body}>
            You can enable it later in your device Settings to get hyper-local air quality.
          </Text>

          <TouchableOpacity onPress={openSettings} style={styles.settingsBtn}>
            <Text style={styles.settingsBtnText}>Open Settings</Text>
          </TouchableOpacity>

          <Text style={styles.orLabel}>or enter your city</Text>

          <TextInput
            style={styles.cityInput}
            placeholder="e.g. Delhi, Mumbai, Bangalore"
            placeholderTextColor="#BABABA"
            value={cityInput}
            onChangeText={setCityInput}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={continueWithCity}
            activeOpacity={0.8}
          >
            <Text style={styles.nextBtnText}>Continue anyway →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Initial state ───────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.icon}>🌬️</Text>
        <Text style={styles.title}>Your air,{'\n'}always accurate</Text>

        <View style={styles.bullets}>
          <BulletRow emoji="🔄" text="We check your local air every hour" />
          <BulletRow emoji="🔒" text="We never share your location" />
          <BulletRow emoji="🔋" text="Uses minimal battery" />
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={requestLocation}
          activeOpacity={0.8}
        >
          <Text style={styles.nextBtnText}>Allow Location →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setStep('denied')} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function BulletRow({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletEmoji}>{emoji}</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },

  content: { flex: 1, paddingHorizontal: 32, paddingTop: 40, alignItems: 'center' },

  icon: { fontSize: 72, marginBottom: 24 },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 36,
  },

  bullets: { width: '100%', gap: 20 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  bulletEmoji: { fontSize: 20, marginTop: 1 },
  bulletText: { flex: 1, fontSize: 16, color: '#444', lineHeight: 24 },

  // Granted
  grantedIcon: { fontSize: 64, marginBottom: 16 },
  grantedText: { fontSize: 22, fontWeight: '700', color: '#1A1A1A' },
  requestingText: { marginTop: 16, fontSize: 15, color: '#666' },

  // Denied
  body: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  settingsBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: ORANGE,
    marginBottom: 20,
  },
  settingsBtnText: { fontSize: 15, fontWeight: '600', color: ORANGE },
  orLabel: { fontSize: 13, color: '#BABABA', marginBottom: 12 },
  cityInput: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#FFF',
  },

  footer: { padding: 24, paddingTop: 12, gap: 12 },
  nextBtn: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipText: { fontSize: 14, color: '#BABABA' },
});
