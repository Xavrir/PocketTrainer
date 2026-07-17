import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../../design/tokens';
import type { NutritionNutrients, NutrientKey } from './types';

const metrics: ReadonlyArray<{
  key: NutrientKey;
  label: string;
  unit: string;
}> = [
  { key: 'calories', label: 'Kalori', unit: 'kkal' },
  { key: 'proteinGrams', label: 'Protein', unit: 'g' },
  { key: 'carbohydrateGrams', label: 'Karbohidrat', unit: 'g' },
  { key: 'fatGrams', label: 'Lemak', unit: 'g' },
  { key: 'fiberGrams', label: 'Serat', unit: 'g' },
  { key: 'sodiumMilligrams', label: 'Natrium', unit: 'mg' },
  { key: 'sugarGrams', label: 'Gula', unit: 'g' },
];

export function formatNutritionValue(value: number | null): string {
  if (value === null) return 'Belum diketahui';
  return value.toLocaleString('id-ID', { maximumFractionDigits: 1 });
}

export function NutritionMetricGrid({
  nutrients,
  compact = false,
}: {
  nutrients: NutritionNutrients;
  compact?: boolean;
}) {
  return (
    <View style={[styles.grid, compact && styles.compactGrid]}>
      {metrics.map((metric, index) => {
        const value = nutrients[metric.key];
        return (
          <View
            key={metric.key}
            style={[styles.metric, index === metrics.length - 1 && styles.metricWide]}
          >
            <Text style={styles.label}>{metric.label}</Text>
            <View style={styles.valueRow}>
              <Text style={[styles.value, value === null && styles.valueUnknown]}>
                {formatNutritionValue(value)}
              </Text>
              {value === null ? null : <Text style={styles.unit}>{metric.unit}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  compactGrid: { marginHorizontal: -spacing.xxs },
  metric: {
    backgroundColor: colors.raised,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    margin: spacing.xs,
    minHeight: 96,
    paddingHorizontal: spacing.xxs,
    paddingTop: spacing.sm,
    width: '45%',
  },
  metricWide: { width: '94%' },
  label: { ...type.micro, color: colors.secondary, letterSpacing: 0.7 },
  valueRow: { alignItems: 'baseline', flexDirection: 'row', marginTop: spacing.xs },
  value: { ...type.section, color: colors.text },
  valueUnknown: { ...type.support, color: colors.muted },
  unit: { ...type.micro, color: colors.coral, marginLeft: spacing.xs },
});
