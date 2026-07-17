import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PageHeader } from '../../components/PageHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, radius, spacing, type } from '../../design/tokens';
import { NutritionMetricGrid } from '../components/NutritionMetricGrid';
import { NutritionStatusBadge } from '../components/NutritionStatusBadge';
import type { NutritionFacts } from '../components/types';

export type NutritionFactsScreenProps = Readonly<{
  facts: NutritionFacts;
  onBack?: () => void;
  onConfirm: (facts: NutritionFacts) => void;
  onEdit: () => void;
}>;

export function NutritionFactsScreen({
  facts,
  onBack,
  onConfirm,
  onEdit,
}: NutritionFactsScreenProps) {
  const source = facts.source;
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        eyebrow="HASIL PEMINDAIAN"
        onBack={onBack}
        title="Periksa nutrisi"
      />
      <View style={styles.productHero}>
        <View style={styles.accentLine} />
        <View style={styles.headerTop}>
          <NutritionStatusBadge status={facts.status} />
          {facts.barcode ? (
            <Text style={styles.barcode}>{facts.barcode}</Text>
          ) : null}
        </View>
        <View style={styles.productGrid}>
          <View style={styles.productCopy}>
            <Text numberOfLines={3} style={styles.title}>{facts.foodName}</Text>
            <Text style={styles.serving}>Per {facts.servingLabel}</Text>
          </View>
          <View style={styles.calorieBlock}>
            <Text style={styles.calorieValue}>
              {facts.nutrients.calories === null
                ? '—'
                : facts.nutrients.calories.toLocaleString('id-ID', {
                    maximumFractionDigits: 1,
                  })}
            </Text>
            <Text style={styles.calorieLabel}>KKAL</Text>
          </View>
        </View>
      </View>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Di dalam satu porsi</Text>
        <Text style={styles.sectionMeta}>Kosong bukan nol</Text>
      </View>
      <NutritionMetricGrid nutrients={facts.nutrients} />
      <View style={styles.sourceCard}>
        <View style={styles.sourceRule} />
        <View style={styles.sourceContent}>
        <Text style={styles.eyebrow}>JEJAK SUMBER</Text>
        {source ? (
          <>
            <Text style={styles.sourceTitle}>{source.label}</Text>
            {source.detail ? (
              <Text style={styles.sourceBody}>{source.detail}</Text>
            ) : null}
            {source.retrievedAt ? (
              <Text style={styles.sourceBody}>
                Diperbarui: {source.retrievedAt}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.sourceTitle}>Sumber belum tersedia.</Text>
        )}
        <Text style={styles.sourceBody}>
          Cocokkan dengan kemasan sebelum menyimpan. Warna status selalu
          disertai label teks, bukan menjadi satu-satunya penanda.
        </Text>
        </View>
      </View>
      {facts.notes ? <Text style={styles.notes}>{facts.notes}</Text> : null}
      <PrimaryButton
        icon="check"
        label={
          facts.status === 'verified'
            ? 'Simpan ke diary'
            : 'Konfirmasi & simpan'
        }
        onPress={() => onConfirm(facts)}
        style={styles.action}
      />
      <Pressable
        accessibilityRole="button"
        onPress={onEdit}
        style={styles.editButton}
      >
        <Text style={styles.editText}>Ada yang salah? Edit data</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 64, paddingHorizontal: spacing.lg },
  productHero: {
    backgroundColor: colors.raised,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: spacing.xl,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  accentLine: {
    backgroundColor: colors.mint,
    height: 3,
    left: 0,
    position: 'absolute',
    right: '55%',
    top: 0,
  },
  headerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barcode: { ...type.micro, color: colors.secondary },
  productGrid: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    marginTop: spacing.xl,
  },
  productCopy: { flex: 1, paddingRight: spacing.sm },
  title: { ...type.h1, color: colors.text },
  serving: { ...type.support, color: colors.secondary, marginTop: spacing.sm },
  calorieBlock: { alignItems: 'flex-end', minWidth: 92 },
  calorieValue: { ...type.display, color: colors.mint, fontSize: 42, lineHeight: 44 },
  calorieLabel: { ...type.micro, color: colors.secondary, letterSpacing: 1.5 },
  sectionRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  sectionTitle: { ...type.card, color: colors.text },
  sectionMeta: { ...type.micro, color: colors.muted },
  sourceCard: {
    backgroundColor: colors.surface,
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
  },
  sourceRule: { backgroundColor: colors.coral, width: 3 },
  sourceContent: { flex: 1, paddingLeft: spacing.md },
  eyebrow: { ...type.micro, color: colors.coral, letterSpacing: 1 },
  sourceTitle: { ...type.card, color: colors.text, marginTop: spacing.xs },
  sourceBody: {
    ...type.support,
    color: colors.secondary,
    marginTop: spacing.xs,
  },
  notes: { ...type.support, color: colors.amber, marginTop: spacing.md },
  action: { marginTop: spacing.xxl },
  editButton: { alignItems: 'center', justifyContent: 'center', minHeight: 56 },
  editText: { ...type.body, color: colors.coral },
});
