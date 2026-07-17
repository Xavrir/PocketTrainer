import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { colors, radius, spacing, type } from '../../design/tokens';
import { NutritionStatusBadge } from '../components/NutritionStatusBadge';
import {
  calculateDailyTotals,
  type NutritionDiaryEntryUpdate,
  type NutritionDiaryEntry,
  type NutritionDiarySummary,
  type NutritionMealType,
  type NutrientKey,
} from '../components/types';

export type NutritionDiaryScreenProps = Readonly<{
  dateLabel?: string;
  entries: readonly NutritionDiaryEntry[];
  onAddFood: () => void;
  onBack?: () => void;
  onDeleteEntry?: (entryId: string) => Promise<void>;
  onRetry?: () => void;
  onSelectEntry?: (entry: NutritionDiaryEntry) => void;
  onUpdateEntry?: (
    entryId: string,
    update: NutritionDiaryEntryUpdate,
  ) => Promise<void>;
  dailySummary?: NutritionDiarySummary | null;
  isLoading?: boolean;
  loadError?: string | null;
  syncError?: string | null;
}>;

const mealOptions: ReadonlyArray<{
  value: NutritionMealType;
  label: string;
}> = [
  { value: 'breakfast', label: 'Sarapan' },
  { value: 'lunch', label: 'Makan siang' },
  { value: 'dinner', label: 'Makan malam' },
  { value: 'snack', label: 'Camilan' },
  { value: 'other', label: 'Lainnya' },
];

const syncCopy = {
  'server-confirmed': {
    label: 'Tersimpan di server',
    color: colors.mint,
  },
  'waiting-to-sync': {
    label: 'Menunggu sinkronisasi',
    color: colors.amber,
  },
  'session-only': {
    label: 'Hanya tersimpan selama sesi ini',
    color: colors.violet,
  },
  'sync-failed': {
    label: 'Sinkronisasi gagal',
    color: colors.danger,
  },
} as const;

function inferMealType(entry: NutritionDiaryEntry): NutritionMealType {
  if (entry.mealType) return entry.mealType;
  const normalized = entry.mealLabel.toLocaleLowerCase('id-ID');
  if (normalized.includes('sarapan') || normalized === 'breakfast')
    return 'breakfast';
  if (normalized.includes('siang') || normalized === 'lunch') return 'lunch';
  if (normalized.includes('malam') || normalized === 'dinner') return 'dinner';
  if (normalized.includes('camilan') || normalized === 'snack') return 'snack';
  return 'other';
}

function formatTotal(
  value: number,
  complete: boolean,
  hasEntries: boolean,
): string {
  if (!hasEntries) return '0';
  if (!complete && value === 0) return '—*';
  const formatted = value.toLocaleString('id-ID', {
    maximumFractionDigits: 1,
  });
  return complete ? formatted : `${formatted}*`;
}

function hasCompleteNutrition(entry: NutritionDiaryEntry): boolean {
  return Object.values(entry.facts.nutrients).every(value => value !== null);
}

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
  onDeleteEntry,
  onRetry,
  onSelectEntry,
  onUpdateEntry,
  dailySummary,
  isLoading = false,
  loadError,
  syncError,
}: NutritionDiaryScreenProps) {
  const [selectedEntry, setSelectedEntry] =
    useState<NutritionDiaryEntry | null>(null);
  const [mealType, setMealType] = useState<NutritionMealType>('other');
  const [servingsText, setServingsText] = useState('1');
  const [mutation, setMutation] = useState<'idle' | 'saving' | 'deleting'>(
    'idle',
  );
  const [mutationError, setMutationError] = useState<string | null>(null);
  const totals = dailySummary?.totals ?? calculateDailyTotals(entries);
  const summarySync = dailySummary
    ? syncCopy[dailySummary.status]
    : {
        label: 'Subtotal dari catatan yang tampil',
        color: colors.secondary,
      };
  const servings = Number(servingsText.replace(',', '.'));
  const servingsValid =
    Number.isFinite(servings) && servings > 0 && servings <= 100;
  const hasSummaryData = Boolean(dailySummary) || entries.length > 0;

  const openEntry = (entry: NutritionDiaryEntry) => {
    onSelectEntry?.(entry);
    if (!onUpdateEntry && !onDeleteEntry) return;
    setSelectedEntry(entry);
    setMealType(inferMealType(entry));
    setServingsText(String(entry.servings));
    setMutationError(null);
  };

  const closeEntry = () => {
    if (mutation !== 'idle') return;
    setSelectedEntry(null);
    setMutationError(null);
  };

  const saveEntry = async () => {
    if (!selectedEntry || !onUpdateEntry || !servingsValid) return;
    setMutation('saving');
    setMutationError(null);
    try {
      await onUpdateEntry(selectedEntry.id, { mealType, servings });
      setSelectedEntry(null);
    } catch {
      setMutationError(
        'Perubahan belum tersimpan. Periksa koneksi lalu coba lagi.',
      );
    } finally {
      setMutation('idle');
    }
  };

  const confirmDelete = () => {
    if (!selectedEntry || !onDeleteEntry || mutation !== 'idle') return;
    Alert.alert(
      'Hapus catatan makanan?',
      `${selectedEntry.facts.foodName} akan dihapus dari diary.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            setMutation('deleting');
            setMutationError(null);
            try {
              await onDeleteEntry(selectedEntry.id);
              setSelectedEntry(null);
            } catch {
              setMutationError(
                'Catatan belum terhapus. Periksa koneksi lalu coba lagi.',
              );
            } finally {
              setMutation('idle');
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader eyebrow="DIARY NUTRISI" onBack={onBack} title={dateLabel} />
        <View style={styles.summaryHero}>
          <View style={styles.heroAccent} />
          <View style={styles.summaryHeader}>
            <View style={styles.summaryCopy}>
              <Text style={styles.heroKicker}>
                HARI INI · TERUKUR DENGAN JUJUR
              </Text>
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
        <View accessibilityLiveRegion="polite" style={styles.summaryState}>
          <View
            style={[styles.stateDot, { backgroundColor: summarySync.color }]}
          />
          <Text style={[styles.summaryStateText, { color: summarySync.color }]}>
            {summarySync.label}
          </Text>
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
                  {formatTotal(total.value, total.complete, hasSummaryData)}
                </Text>
                <Text
                  style={[
                    styles.totalUnit,
                    index === 0 && styles.totalUnitLead,
                  ]}
                >
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
        {dailyMetrics.some(metric => !totals[metric.key].complete) ? (
          <Text style={styles.disclaimer}>
            * Subtotal hanya menjumlahkan nilai yang diketahui. Nutrisi yang
            tidak tersedia tetap ditampilkan sebagai belum diketahui, bukan nol.
          </Text>
        ) : null}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Yang kamu makan</Text>
          <Text style={styles.sectionMeta}>Sumber selalu terlihat</Text>
        </View>
        {isLoading ? (
          <View
            accessibilityLabel="Memuat diary nutrisi"
            style={styles.stateCard}
          >
            <ActivityIndicator color={colors.coral} />
            <Text style={styles.stateTitle}>Memuat catatan dari server…</Text>
          </View>
        ) : loadError ? (
          <View accessibilityLiveRegion="polite" style={styles.errorCard}>
            <Text style={styles.errorTitle}>Diary belum dapat dimuat</Text>
            <Text style={styles.errorBody}>{loadError}</Text>
            {onRetry ? (
              <Pressable
                accessibilityLabel="Coba lagi memuat diary"
                accessibilityRole="button"
                onPress={onRetry}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>Coba lagi</Text>
              </Pressable>
            ) : null}
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Icon color={colors.amber} name="spark" size={26} />
            <Text style={styles.emptyTitle}>Mulai dari satu makanan.</Text>
            <Text style={styles.emptyBody}>
              Tambahkan barcode atau salin label kemasan. Kami tidak mengisi
              data nutrisi tanpa sumber.
            </Text>
          </View>
        ) : (
          entries.map(entry => {
            const canOpen = Boolean(
              onSelectEntry || onUpdateEntry || onDeleteEntry,
            );
            const effectiveSyncStatus = hasCompleteNutrition(entry)
              ? entry.syncStatus
              : 'session-only';
            const entrySync = effectiveSyncStatus
              ? syncCopy[effectiveSyncStatus]
              : null;
            return (
              <Pressable
                accessibilityLabel={
                  canOpen ? `Buka catatan ${entry.facts.foodName}` : undefined
                }
                accessibilityRole={canOpen ? 'button' : undefined}
                disabled={!canOpen}
                key={entry.id}
                onPress={() => openEntry(entry)}
                style={({ pressed }) => [
                  styles.entryCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.entryTop}>
                  <View style={styles.entryCopy}>
                    <Text style={styles.entryMeal}>
                      {entry.mealLabel} · {entry.loggedAtLabel}
                    </Text>
                    <Text style={styles.entryTitle}>
                      {entry.facts.foodName}
                    </Text>
                    <Text style={styles.entryServing}>
                      {entry.servings} × {entry.facts.servingLabel}
                    </Text>
                  </View>
                  {canOpen ? (
                    <Icon color={colors.secondary} name="chevron" size={20} />
                  ) : null}
                </View>
                <View style={styles.entryBottom}>
                  <NutritionStatusBadge status={entry.facts.status} />
                  <Text style={styles.sourceText}>
                    {entry.facts.source?.label ?? 'Sumber belum tersedia'}
                  </Text>
                  {entrySync ? (
                    <Text
                      style={[styles.syncStatus, { color: entrySync.color }]}
                    >
                      {entrySync.label}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
      <Modal
        animationType="slide"
        onRequestClose={closeEntry}
        transparent
        visible={Boolean(selectedEntry)}
      >
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.editorSheet}>
            {selectedEntry ? (
              <>
                <View style={styles.editorHeader}>
                  <View style={styles.editorHeadingCopy}>
                    <Text style={styles.editorEyebrow}>CATATAN MAKANAN</Text>
                    <Text style={styles.editorTitle}>
                      {selectedEntry.facts.foodName}
                    </Text>
                    <Text style={styles.editorSource}>
                      {selectedEntry.facts.source?.label ??
                        'Sumber belum tersedia'}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Tutup detail makanan"
                    accessibilityRole="button"
                    disabled={mutation !== 'idle'}
                    onPress={closeEntry}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeText}>Tutup</Text>
                  </Pressable>
                </View>
                {onUpdateEntry ? (
                  <>
                    <Text style={styles.fieldLabel}>Waktu makan</Text>
                    <View style={styles.mealGrid}>
                      {mealOptions.map(option => {
                        const selected = option.value === mealType;
                        return (
                          <Pressable
                            accessibilityRole="radio"
                            accessibilityState={{ checked: selected }}
                            disabled={mutation !== 'idle'}
                            key={option.value}
                            onPress={() => setMealType(option.value)}
                            style={[
                              styles.mealOption,
                              selected && styles.mealOptionSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.mealOptionText,
                                selected && styles.mealOptionTextSelected,
                              ]}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text style={styles.fieldLabel}>Jumlah porsi</Text>
                    <TextInput
                      accessibilityLabel="Jumlah porsi"
                      editable={mutation === 'idle'}
                      keyboardType="decimal-pad"
                      onChangeText={setServingsText}
                      selectTextOnFocus
                      style={[
                        styles.servingsInput,
                        !servingsValid && styles.inputError,
                      ]}
                      value={servingsText}
                    />
                    {!servingsValid ? (
                      <Text
                        accessibilityLiveRegion="polite"
                        style={styles.validationError}
                      >
                        Masukkan porsi lebih dari 0 dan maksimal 100.
                      </Text>
                    ) : null}
                  </>
                ) : null}
                {mutationError ? (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={styles.validationError}
                  >
                    {mutationError}
                  </Text>
                ) : null}
                <View style={styles.editorActions}>
                  {onDeleteEntry ? (
                    <Pressable
                      accessibilityLabel="Hapus catatan makanan"
                      accessibilityRole="button"
                      disabled={mutation !== 'idle'}
                      onPress={confirmDelete}
                      style={[
                        styles.deleteButton,
                        mutation !== 'idle' && styles.disabled,
                      ]}
                    >
                      <Text style={styles.deleteText}>
                        {mutation === 'deleting' ? 'Menghapus…' : 'Hapus'}
                      </Text>
                    </Pressable>
                  ) : null}
                  {onUpdateEntry ? (
                    <Pressable
                      accessibilityLabel="Simpan perubahan makanan"
                      accessibilityRole="button"
                      disabled={!servingsValid || mutation !== 'idle'}
                      onPress={saveEntry}
                      style={[
                        styles.saveButton,
                        (!servingsValid || mutation !== 'idle') &&
                          styles.disabled,
                      ]}
                    >
                      <Text style={styles.saveText}>
                        {mutation === 'saving'
                          ? 'Menyimpan…'
                          : 'Simpan perubahan'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
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
  summaryState: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  stateDot: { borderRadius: 4, height: 8, marginRight: spacing.xs, width: 8 },
  summaryStateText: { ...type.micro },
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
  totalValue: {
    ...type.display,
    color: colors.text,
    fontSize: 34,
    marginTop: spacing.xs,
  },
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
  pressed: { opacity: 0.76 },
  syncError: {
    backgroundColor: colors.surface,
    borderColor: colors.amber,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  syncErrorTitle: { ...type.card, color: colors.amber },
  syncErrorBody: {
    ...type.support,
    color: colors.secondary,
    marginTop: spacing.xs,
  },
  stateCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.md,
    minHeight: 88,
    padding: spacing.lg,
  },
  stateTitle: {
    ...type.support,
    color: colors.secondary,
    marginLeft: spacing.sm,
  },
  errorCard: {
    backgroundColor: colors.surface,
    borderColor: colors.danger,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  errorTitle: { ...type.card, color: colors.danger },
  errorBody: {
    ...type.support,
    color: colors.secondary,
    marginTop: spacing.xs,
  },
  retryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: colors.danger,
    borderRadius: radius.control,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  retryText: { ...type.support, color: colors.text, fontWeight: '800' },
  modalBackdrop: {
    backgroundColor: 'rgba(13,11,11,0.84)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  editorSheet: {
    backgroundColor: colors.raised,
    borderColor: colors.border,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: 1,
    maxHeight: '92%',
    padding: spacing.lg,
  },
  editorHeader: { alignItems: 'flex-start', flexDirection: 'row' },
  editorHeadingCopy: { flex: 1, paddingRight: spacing.sm },
  editorEyebrow: { ...type.micro, color: colors.coral, letterSpacing: 1 },
  editorTitle: { ...type.section, color: colors.text, marginTop: spacing.xs },
  editorSource: {
    ...type.support,
    color: colors.secondary,
    marginTop: spacing.xxs,
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 56,
  },
  closeText: { ...type.support, color: colors.secondary },
  fieldLabel: {
    ...type.micro,
    color: colors.secondary,
    letterSpacing: 0.7,
    marginTop: spacing.xl,
  },
  mealGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  mealOption: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  mealOptionSelected: {
    backgroundColor: colors.coral,
    borderColor: colors.coral,
  },
  mealOptionText: { ...type.support, color: colors.secondary },
  mealOptionTextSelected: { color: colors.canvas, fontWeight: '800' },
  servingsInput: {
    ...type.body,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: 1,
    color: colors.text,
    marginTop: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  inputError: { borderColor: colors.danger },
  validationError: {
    ...type.support,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  editorActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    marginTop: spacing.xl,
  },
  deleteButton: {
    alignItems: 'center',
    borderColor: colors.danger,
    borderRadius: radius.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  deleteText: { ...type.support, color: colors.danger, fontWeight: '800' },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: radius.control,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  saveText: { ...type.support, color: colors.canvas, fontWeight: '800' },
  disabled: { opacity: 0.45 },
});
