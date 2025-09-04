import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface PrivatePillProps {
  size?: 'small' | 'medium';
}

export function PrivatePill({ size = 'medium' }: PrivatePillProps) {
  return (
    <View
      style={[
        styles.pill,
        size === 'small' ? styles.smallPill : styles.mediumPill,
      ]}
    >
      <Text
        style={[
          styles.text,
          size === 'small' ? styles.smallText : styles.mediumText,
        ]}
      >
        Private
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: '#6366f1', // Indigo color like in listr
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  smallPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  mediumPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  text: {
    color: '#ffffff',
    fontWeight: '500',
    fontSize: 11,
  },
  smallText: {
    fontSize: 10,
  },
  mediumText: {
    fontSize: 11,
  },
});
