import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, type } from '../design/tokens';

type ProgressRingProps = {
  value: number;
  label: string;
  caption?: string;
  size?: number;
  stroke?: number;
};

export function ProgressRing({
  value,
  label,
  caption,
  size = 108,
  stroke = 8,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(100, Math.max(0, value));
  const offset = circumference - (clampedValue / 100) * circumference;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${label}, ${clampedValue} percent`}
      style={[styles.root, { width: size, height: size }]}
    >
      <Svg height={size} width={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={colors.border}
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={colors.coral}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={stroke}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={styles.value}>{label}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  value: { ...type.card, color: colors.text, fontVariant: ['tabular-nums'] },
  caption: { ...type.micro, color: colors.secondary, marginTop: 2 },
});
