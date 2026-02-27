import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ProfileChip() {
  return (
    <View style={styles.chip}>
      <Text>ProfileChip</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { padding: 8, borderRadius: 20, backgroundColor: '#e0e0e0' },
});
