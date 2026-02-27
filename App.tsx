import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import RootNavigator from './src/navigation/RootNavigator';
import OnboardingContainer from './src/onboarding/OnboardingContainer';
import { isOnboardingComplete, getLastKnownAQI } from './src/services/storageService';
import {
  requestNotificationPermission,
  checkAndFireAlerts,
} from './src/services/notificationService';

// ─── Notification handler ─────────────────────────────────────────────────────
// Determines what happens when a notification arrives while the app is in
// the foreground (show the alert banner so the user still sees it).

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  // null = still checking AsyncStorage
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // ── Initial storage check ────────────────────────────────────────────────
  useEffect(() => {
    isOnboardingComplete().then(setOnboardingDone);
  }, []);

  // ── AppState listener: spike / clean-air checks on foreground ────────────
  // Reads the cached AQI from storage (written by useAQI) and fires local
  // notifications if conditions are met. This works even without network.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      async (nextState: AppStateStatus) => {
        // Only trigger on background → active transition
        if (appState.current !== 'active' && nextState === 'active') {
          const lastKnown = await getLastKnownAQI();
          if (lastKnown) {
            await checkAndFireAlerts(lastKnown.aqi, lastKnown.city);
          }
        }
        appState.current = nextState;
      },
    );
    return () => subscription.remove();
  }, []);

  // ── Onboarding complete handler ──────────────────────────────────────────
  // Requests notification permission right after onboarding so the user has
  // given their location and we can frame the permission request in context.
  // The actual notification *scheduling* happens later in useAQI (first-time)
  // once we have a real city name from the AQI fetch.
  async function handleOnboardingComplete() {
    setOnboardingDone(true);
    await requestNotificationPermission();
  }

  // Blank screen while reading AsyncStorage (avoids flash)
  if (onboardingDone === null) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {onboardingDone ? (
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      ) : (
        <OnboardingContainer onComplete={handleOnboardingComplete} />
      )}
    </SafeAreaProvider>
  );
}
