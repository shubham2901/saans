import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FamilyScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.center}>
        <Text style={styles.emoji}>👨‍👩‍👧‍👦</Text>
        <Text style={styles.title}>Family</Text>
        <Text style={styles.sub}>
          Manage your household profiles and notification preferences in Settings.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#F7F8FA' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginBottom: 8 },
  sub:   { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
});
