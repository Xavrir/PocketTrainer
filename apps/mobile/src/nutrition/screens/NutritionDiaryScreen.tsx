import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { colors, radius, spacing, type } from '../../design/tokens';
import { NutritionStatusBadge } from '../components/NutritionStatusBadge';
import {
  calculateDailyTotals,
  type NutritionDiaryEntry,
  type NutrientKey,
} from '../components/types';

export type NutritionDiaryScreenProps = Readonly<{
  dateLabel?: string;
  entries: readonly NutritionDiaryEntry[];
  onAddFood: () => void;
  onBack?: () => void;
  onSelectEntry?: (entry: NutritionDiaryEntry) => void;
  syncError?: string | null;
}>;

const dailyMetrics: ReadonlyArray<{
  key: NutrientKey;
  label: string;
  unit: string;
}> = [
  { key: 'calories', label: 'Kalori', unit: 'kkal' },
  { key: 'proteinGrams', label: 'Protein', unit: 'g' },
  { key: 'carbohydrateGrams', label: 'Karbohidrat', unit: 'g' },
  { key: 'fatGrams', label: 'Lemak', unit: 'g' },
];

export function NutritionDiaryScreen({
  dateLabel = 'Hari ini',
  entries,
  onAddFood,
  onBack,
  onSelectEntry,
  syncError,
}: NutritionDiaryScreenProps) {
  const totals = calculateDailyTotals(entries);
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader eyebrow="DIARY NUTRISI" onBack={onBack} title={dateLabel} />
      <View style={styles.summaryHero}>
        <View style={styles.heroAccent} />
        <View style={styles.summaryHeader}>
        <View style={styles.summaryCopy}>
          <Text style={styles.heroKicker}>HARI INI · TERUKUR DENGAN JUJUR</Text>
          <Text style={styles.title}>Ringkasan harian</Text>
          <Text style={styles.subtitle}>
            {entries.length === 0
              ? 'Belum ada makanan yang dicatat.'
              : `${entries.length} catatan makanan`}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Tambah makanan"
          accessibilityRole="button"
          onPress={onAddFood}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>+ Tambah</Text>
        </Pressable>
        </View>
      </View>
      <View style={styles.totalGrid}>
        {dailyMetrics.map((metric, index) => {
          const total = totals[metric.key];
          return (
            <View
              key={metric.key}
              style={[styles.totalCard, index === 0 && styles.totalCardLead]}
            >
              <Text style={styles.totalLabel}>{metric.label}</Text>
              <Text style={styles.totalValue}>
                {entries.length === 0
                  ? '0'
                  : total.complete
                  ? total.value.toLocaleString('id-ID', {
                      maximumFractionDigits: 1,
                    })
                  : total.value > 0
                  ? `${total.value.toLocaleString('id-ID', {
                      maximumFractionDigits: 1,
                    })}*`
                  : '—*'}
              </Text>
              <Text style={[styles.totalUnit, index === 0 && styles.totalUnitLead]}>
                {metric.unit}
              </Text>
            </View>
          );
        })}
      </View>
      {syncError ? (
        <View style={styles.syncError}>
          <Text style={styles.syncErrorTitle}>Belum tersimpan ke server</Text>
          <Text style={styles.syncErrorBody}>{syncError}</Text>
        </View>
      ) : null}
      <Text style={styles.disclaimer}>
        * Subtotal nilai yang diketahui. Lengkapi catatan berstatus “Perlu
        konfirmasi” untuk total yang lebih utuh.
      </Text>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Yang kamu makan</Text>
        <Text style={styles.sectionMeta}>Sumber selalu terlihat</Text>
      </View>
      {entries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Icon color={colors.amber} name="spark" size={26} />
          <Text style={styles.emptyTitle}>Mulai dari satu makanan.</Text>
          <Text style={styles.emptyBody}>
            Tambahkan barcode atau salin label kemasan. Kami tidak mengisi data
            nutrisi tanpa sumber.
          </Text>
        </View>
      ) : (
        entries.map(entry => (
          <Pressable
            accessibilityLabel={`Buka catatan ${entry.facts.foodName}`}
            accessibilityRole="button"
            key={entry.id}
            onPress={() => onSelectEntry?.(entry)}
            style={styles.entryCard}
          >
            <View style={styles.entryTop}>
              <View style={styles.entryCopy}>
                <Text style={styles.entryMeal}>
                  {entry.mealLabel} · {entry.loggedAtLabel}
                </Text>
                <Text style={styles.entryTitle}>{entry.facts.foodName}</Text>
                <Text style={styles.entryServing}>
                  {entry.servings} × {entry.facts.servingLabel}
                </Text>
              </View>
              <Icon color={colors.secondary} name="chevron" size={20} />
            </View>
            <View style={styles.entryBottom}>
              <NutritionStatusBadge status={entry.facts.status} />
              <Text style={styles.sourceText}>
                {entry.facts.source?.label ?? 'Sumber belum tersedia'}
              </Text>
              {entry.syncStatus ? (
                <Text style={styles.syncStatus}>
                  {entry.syncStatus === 'server-confirmed'
                    ? 'Server'
                    : entry.syncStatus === 'waiting-to-sync'
                    ? 'Menunggu sinkron'
                    : entry.syncStatus === 'session-only'
                    ? 'Sesi ini saja'
                    : 'Belum tersimpan'}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 64, paddingHorizontal: spacing.lg },
  summaryHero: {
    backgroundColor: colors.raised,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: spacing.xl,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  heroAccent: {
    backgroundColor: colors.coral,
    bottom: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 4,
  },
  summaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCopy: { flex: 1, paddingRight: spacing.sm },
  heroKicker: { ...type.micro, color: colors.coral, letterSpacing: 1 },
  title: { ...type.h1, color: colors.text, marginTop: spacing.sm },
  subtitle: {
    ...type.support,
    color: colors.secondary,
    marginTop: spacing.xxs,
  },
  addButton: {
    backgroundColor: colors.coral,
    borderRadius: radius.control,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  addButtonText: { ...type.support, color: colors.canvas, fontWeight: '800' },
  totalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xxs,
    marginTop: spacing.lg,
  },
  totalCard: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    margin: spacing.xxs,
    minHeight: 112,
    padding: spacing.sm,
    width: '47%',
  },
  totalCardLead: { borderTopColor: colors.coral, borderTopWidth: 3 },
  totalLabel: { ...type.micro, color: colors.secondary },
  totalValue: { ...type.display, color: colors.text, fontSize: 34, marginTop: spacing.xs },
  totalUnit: { ...type.micro, color: colors.muted, letterSpacing: 0.8 },
  totalUnitLead: { color: colors.coral },
  disclaimer: { ...type.micro, color: colors.amber, marginTop: spacing.sm },
  sectionRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
  },
  sectionTitle: { ...type.card, color: colors.text },
  sectionMeta: { ...type.micro, color: colors.muted },
  emptyCard: {
    backgroundColor: colors.surface,
    borderLeftColor: colors.amber,
    borderLeftWidth: 3,
    marginTop: spacing.md,
    padding: spacing.xl,
  },
  emptyTitle: { ...type.card, color: colors.text, marginTop: spacing.sm },
  emptyBody: {
    ...type.support,
    color: colors.secondary,
    marginTop: spacing.xs,
  },
  entryCard: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.lg,
  },
  entryTop: { alignItems: 'center', flexDirection: 'row' },
  entryCopy: { flex: 1 },
  entryMeal: { ...type.micro, color: colors.coral, letterSpacing: 0.4 },
  entryTitle: { ...type.card, color: colors.text, marginTop: spacing.xxs },
  entryServing: {
    ...type.support,
    color: colors.secondary,
    marginTop: spacing.xxs,
  },
  entryBottom: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  sourceText: {
    ...type.micro,
    color: colors.secondary,
    flex: 1,
    marginLeft: spacing.sm,
  },
  syncStatus: { ...type.micro, color: colors.amber, marginLeft: spacing.sm },
  syncError: {
    backgroundColor: colors.surface,
    borderColor: colors.amber,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  syncErrorTitle: { ...type.card, color: colors.amber },
  syncErrorBody: { ...type.support, color: colors.secondary, marginTop: spacing.xs },
});
