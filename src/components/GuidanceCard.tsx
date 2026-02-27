import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { GuidanceCard as GuidanceCardData } from '../types';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

interface Props {
  data: GuidanceCardData;
  aqiColor: string;
}

export default function GuidanceCard({ data, aqiColor }: Props) {
  const [expanded, setExpanded] = useState(false);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  }

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={toggle}
      style={styles.card}
    >
      {/* Left AQI color accent bar */}
      <View style={[styles.accentBar, { backgroundColor: aqiColor }]} />

      <View style={styles.body}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <Text style={styles.emoji}>{data.emoji}</Text>
          <View style={styles.headerText}>
            <Text style={styles.profileLabel}>{data.profileLabel}</Text>
            <Text style={styles.message}>{data.message}</Text>
          </View>
          <Text style={[styles.chevron, expanded && styles.chevronOpen]}>›</Text>
        </View>

        {/* Expandable detail */}
        {expanded && data.detail ? (
          <Text style={styles.detail}>{data.detail}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  body: {
    flex: 1,
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  emoji: {
    fontSize: 22,
    lineHeight: 28,
  },
  headerText: {
    flex: 1,
  },
  profileLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  message: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 22,
    color: '#CCCCCC',
    fontWeight: '300',
    transform: [{ rotate: '0deg' }],
    marginTop: 2,
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
    color: '#999',
  },
  detail: {
    marginTop: 10,
    fontSize: 13,
    color: '#555',
    lineHeight: 19,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 10,
  },
});
