import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/Home';
import ForecastScreen from '../screens/Forecast';
import FamilyScreen from '../screens/Family';
import TrendsScreen from '../screens/Trends';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#FF7E00',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: { borderTopColor: '#F0F0F0' },
      }}
    >
      <Tab.Screen name="Home"     component={HomeScreen}     options={{ headerShown: false }} />
      <Tab.Screen name="Forecast" component={ForecastScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Family"   component={FamilyScreen} />
      <Tab.Screen name="Trends"   component={TrendsScreen}   options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}
