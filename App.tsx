import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import OnboardingContainer from './src/onboarding/OnboardingContainer';
import { isOnboardingComplete } from './src/services/storageService';

export default function App() {
  // null = still checking AsyncStorage
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    isOnboardingComplete().then(setOnboardingDone);
  }, []);

  // Blank screen while checking storage (replaces splash in later sessions)
  if (onboardingDone === null) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {onboardingDone ? (
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      ) : (
        <OnboardingContainer onComplete={() => setOnboardingDone(true)} />
      )}
    </SafeAreaProvider>
  );
}
