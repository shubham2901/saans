import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/Home';
import ForecastScreen from '../screens/Forecast';
import TrendsScreen from '../screens/Trends';

const Tab = createBottomTabNavigator();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(active: IoniconsName, inactive: IoniconsName) {
  return ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={size} color={color} />
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor:   '#FF7E00',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: { borderTopColor: '#F0F0F0' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false,
          tabBarIcon: tabIcon('home', 'home-outline'),
        }}
      />
      <Tab.Screen
        name="Forecast"
        component={ForecastScreen}
        options={{
          headerShown: false,
          tabBarIcon: tabIcon('partly-sunny', 'partly-sunny-outline'),
        }}
      />
      <Tab.Screen
        name="Trends"
        component={TrendsScreen}
        options={{
          headerShown: false,
          tabBarIcon: tabIcon('bar-chart', 'bar-chart-outline'),
        }}
      />
    </Tab.Navigator>
  );
}
