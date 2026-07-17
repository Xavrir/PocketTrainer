import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../../design/tokens';
import type { NutritionStatus } from './types';

const statusCopy: Record<
  NutritionStatus,
  { label: string; color: string; background: string; prefix: string }
> = {
  verified: {
    label: 'TERVERIFIKASI',
    color: colors.mint,
    background: 'rgba(102,221,177,0.10)',
    prefix: '✓',
  },
  'needs-confirmation': {
    label: 'PERLU KONFIRMASI',
    color: colors.amber,
    background: 'rgba(255,180,84,0.10)',
    prefix: '!',
  },
  unverified: {
    label: 'BELUM TERVERIFIKASI',
    color: colors.coral,
    background: 'rgba(255,90,107,0.10)',
    prefix: '?',
  },
};

export function NutritionStatusBadge({ status }: { status: NutritionStatus }) {
  const copy = statusCopy[status];
  return (
    <View
      accessibilityLabel={`Status nutrisi: ${copy.label}`}
      style={[
        styles.badge,
        { backgroundColor: copy.background, borderColor: copy.color },
      ]}
    >
      <Text style={[styles.prefix, { color: copy.color }]}>{copy.prefix}</Text>
      <Text style={[styles.label, { color: copy.color }]}>{copy.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 32,
    paddingHorizontal: spacing.sm,
  },
  prefix: { ...type.body, fontWeight: '800', marginRight: spacing.xs },
  label: { ...type.micro, letterSpacing: 0.5 },
});
