import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AssessmentCompletionV2, AssessmentResultV2 } from '../api';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { SafeFooter } from '../components/SafeFooter';
import { colors, radius, spacing, type } from '../design/tokens';

export type AssessmentResultScreenProps = Readonly<{
  completion: AssessmentCompletionV2;
  onDone: () => void;
}>;

export function AssessmentResultScreen({
  completion,
  onDone,
}: AssessmentResultScreenProps) {
  const insets = useSafeAreaInsets();
  const result = readResultV2(completion);
  const suppressed = completion.progressionSuppressed;
  const lowerBodyControl = suppressed ? null : result?.lowerBodyControl ?? null;

  return (
    <View style={styles.screen}>
      <PageHeader
        eyebrow="HASIL ASESMEN · SERVER"
        title={
          suppressed ? 'Progresi ditahan dengan aman.' : 'Titik awal tercatat.'
        }
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 112 + Math.max(insets.bottom, spacing.lg) },
        ]}
      >
        <View style={[styles.scoreCard, suppressed && styles.suppressedCard]}>
          <View style={styles.scoreIcon}>
            <Icon
              color={suppressed ? colors.amber : colors.mint}
              name={suppressed ? 'shield' : 'check'}
              size={25}
            />
          </View>
          <View style={styles.scoreCopy}>
            <Text style={styles.scoreEyebrow}>KONTROL TUBUH BAWAH</Text>
            <Text style={styles.scoreValue}>
              {lowerBodyControl === null
                ? 'Tidak diberi skor'
                : `${Math.round(lowerBodyControl)} / 100`}
            </Text>
            <Text style={styles.scoreBody}>
              {suppressed
                ? 'Tracking yang tidak memenuhi syarat atau laporan nyeri tidak menghasilkan skor, XP, mastery, unlock, atau rencana baru.'
                : 'Nilai ini berasal hanya dari bukti squat yang memenuhi syarat.'}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Belum diukur</Text>
        {[
          'Kontrol tubuh atas',
          'Keseimbangan',
          'Mobilitas',
          'Stabilitas inti',
        ].map(label => (
          <View key={label} style={styles.unmeasuredRow}>
            <Text style={styles.unmeasuredLabel}>{label}</Text>
            <Text style={styles.unmeasuredValue}>— BELUM DIUKUR</Text>
          </View>
        ))}

        <View style={styles.serverCard}>
          <Text style={styles.serverEyebrow}>KONFIRMASI SERVER</Text>
          <Text style={styles.serverTitle}>
            {completion.currentPlan
              ? 'Rencana latihan aktif tersedia.'
              : 'Tidak ada rencana baru.'}
          </Text>
          <Text style={styles.serverBody}>
            {completion.currentPlan
              ? completion.currentPlan.reason.id
              : suppressed
              ? 'Selesaikan asesmen lagi saat tracking stabil dan tanpa nyeri.'
              : 'Muat ulang Coach untuk memeriksa status rencana.'}
          </Text>
          <View style={styles.xpRow}>
            <Text style={styles.xpLabel}>XP ASESMEN</Text>
            <Text style={styles.xpValue}>+{completion.xpAwarded}</Text>
          </View>
        </View>
      </ScrollView>
      <SafeFooter>
        <PrimaryButton label="Lihat Coach" onPress={onDone} />
      </SafeFooter>
    </View>
  );
}

function readResultV2(
  completion: AssessmentCompletionV2,
): AssessmentResultV2 | null {
  const result = completion.assessment.result;
  return result && 'version' in result && result.version === 2 ? result : null;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { padding: spacing.lg },
  scoreCard: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(102,221,177,.08)',
    borderColor: 'rgba(102,221,177,.3)',
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  suppressedCard: {
    backgroundColor: 'rgba(255,180,84,.08)',
    borderColor: 'rgba(255,180,84,.3)',
  },
  scoreIcon: {
    alignItems: 'center',
    backgroundColor: colors.raised,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  scoreCopy: { flex: 1 },
  scoreEyebrow: { ...type.micro, color: colors.secondary },
  scoreValue: {
    ...type.section,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    marginTop: spacing.xxs,
  },
  scoreBody: {
    ...type.support,
    color: colors.secondary,
    marginTop: spacing.xs,
  },
  sectionTitle: { ...type.section, color: colors.text, marginTop: spacing.xl },
  unmeasuredRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 56,
  },
  unmeasuredLabel: { ...type.support, color: colors.text, flex: 1 },
  unmeasuredValue: { ...type.micro, color: colors.muted, fontSize: 9 },
  serverCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  serverEyebrow: { ...type.micro, color: colors.coral, letterSpacing: 0.6 },
  serverTitle: { ...type.card, color: colors.text, marginTop: spacing.xs },
  serverBody: {
    ...type.support,
    color: colors.secondary,
    marginTop: spacing.xs,
  },
  xpRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  xpLabel: { ...type.micro, color: colors.secondary },
  xpValue: { ...type.card, color: colors.mint, fontVariant: ['tabular-nums'] },
});
