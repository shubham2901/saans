import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigator from './TabNavigator';
import SettingsScreen from '../screens/Settings';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Tabs"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Edit Profile & Settings',
          presentation: 'modal',
          headerStyle: { backgroundColor: '#F7F8FA' },
          headerTitleStyle: { fontSize: 16, fontWeight: '700' },
          headerTintColor: '#FF7E00',
        }}
      />
    </Stack.Navigator>
  );
}
