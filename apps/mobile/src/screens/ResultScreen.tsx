import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressRing } from '../components/ProgressRing';
import { SafeFooter } from '../components/SafeFooter';
import { colors, radius, spacing, type } from '../design/tokens';

export type ResultSyncStatus =
  | 'not_saved'
  | 'saved_offline'
  | 'waiting_to_sync'
  | 'server_confirmed'
  | 'sync_failed';

export type ResultSessionData = Readonly<{
  exerciseLabel: string;
  exerciseKey: string;
  targetType: 'reps' | 'seconds';
  targetValue: number;
  completedValue: number;
  totalReps: number;
  validReps: number;
  durationMs: number;
  formScore: number | null;
  trackingEligible: boolean;
  scoringSupported: boolean;
}>;

export type AuthoritativeWorkoutResult = Readonly<{
  xpAwarded: number;
  totalXp: number;
  level: number;
  masteryBefore: number | null;
  masteryAfter: number | null;
  newlyUnlockedLessonIds: readonly string[];
  progressionSuppressed: boolean;
  safetyMessage?: string;
}>;

export function describeResultMetric(session: ResultSessionData): {
  caption: string;
  metric: string;
  scoreEligible: boolean;
  targetUnit: string;
} {
  const scoreEligible =
    session.scoringSupported &&
    session.trackingEligible &&
    session.formScore !== null;
  const guidedSession = !session.scoringSupported;
  const targetUnit =
    session.targetType === 'seconds'
      ? 'detik aktif'
      : scoreEligible
      ? 'repetisi terdeteksi'
      : guidedSession
      ? 'repetisi terpandu'
      : 'repetisi selesai (tidak dinilai)';
  const metric =
    session.targetType === 'reps'
      ? `${scoreEligible ? session.validReps : session.completedValue} / ${
          session.targetValue
        }`
      : `${session.completedValue} / ${session.targetValue}`;
  return {
    caption: scoreEligible
      ? 'FORM SCORE'
      : guidedSession
      ? 'MODE TERPANDU'
      : 'TIDAK DINILAI',
    metric,
    scoreEligible,
    targetUnit,
  };
}

export function usesPainSafetyPresentation(
  painReported: boolean | undefined,
): boolean {
  return painReported === true;
}

type Feedback = Readonly<{
  perceivedDifficulty: number;
  painReported: boolean;
}>;

const syncCopy: Record<
  ResultSyncStatus,
  Readonly<{ label: string; description: string; color: string }>
> = {
  not_saved: {
    label: 'BELUM DIKIRIM',
    description:
      'Hasil kamera tersedia secara lokal, tetapi belum dikirim ke server.',
    color: colors.secondary,
  },
  saved_offline: {
    label: 'TERSIMPAN OFFLINE',
    description: 'Hasil tersimpan offline dan belum dikonfirmasi oleh server.',
    color: colors.amber,
  },
  waiting_to_sync: {
    label: 'MENUNGGU SERVER',
    description: 'Hasil sedang dikirim. XP dan pembukaan lesson belum final.',
    color: colors.amber,
  },
  server_confirmed: {
    label: 'DIKONFIRMASI SERVER',
    description:
      'XP, penguasaan, dan pembukaan lesson berasal dari respons server.',
    color: colors.mint,
  },
  sync_failed: {
    label: 'GAGAL DIKIRIM',
    description:
      'Server belum mengonfirmasi hasil. Coba kirim lagi saat koneksi tersedia.',
    color: colors.amber,
  },
};

export function ResultScreen({
  completion,
  error,
  onDone,
  onSubmitFeedback,
  onViewSaferVariation,
  session,
  syncStatus,
}: {
  completion?: AuthoritativeWorkoutResult;
  error?: string;
  onDone: () => void;
  onSubmitFeedback: (feedback: Feedback) => Promise<void>;
  onViewSaferVariation: () => void;
  session: ResultSessionData;
  syncStatus: ResultSyncStatus;
}) {
  const [effort, setEffort] = useState<number>();
  const [pain, setPain] = useState<boolean>();
  const [submitting, setSubmitting] = useState(false);
  const insets = useSafeAreaInsets();
  const sync = syncCopy[syncStatus];
  const serverConfirmed = syncStatus === 'server_confirmed' && completion;
  const { caption, metric, scoreEligible, targetUnit } =
    describeResultMetric(session);
  const progressValue = scoreEligible ? session.formScore! : 0;
  const feedbackLocked = syncStatus !== 'not_saved';
  const masteryLabel = useMemo(() => {
    if (!serverConfirmed) return 'Menunggu konfirmasi';
    if (completion.masteryBefore === null || completion.masteryAfter === null) {
      return completion.progressionSuppressed
        ? 'Tidak berubah'
        : 'Belum dinilai';
    }
    return `${completion.masteryBefore} → ${completion.masteryAfter}`;
  }, [completion, serverConfirmed]);
  // Guided practice and low-confidence sessions also suppress mastery. That is
  // not evidence of pain, so only the user's explicit answer enables the
  // pain-specific safety presentation.
  const painSafetyActive = usesPainSafetyPresentation(pain);

  const submit = async () => {
    if (effort === undefined || pain === undefined || submitting) return;
    setSubmitting(true);
    try {
      await onSubmitFeedback({
        perceivedDifficulty: effort,
        painReported: pain,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const primaryAction = () => {
    if (serverConfirmed || syncStatus === 'saved_offline') {
      if (pain) onViewSaferVariation();
      else onDone();
      return;
    }
    submit().catch(() => undefined);
  };

  const buttonLabel =
    effort === undefined
      ? 'Pilih tingkat usaha'
      : pain === undefined
      ? 'Jawab pertanyaan nyeri'
      : submitting || syncStatus === 'waiting_to_sync'
      ? 'Mengirim hasil…'
      : serverConfirmed || syncStatus === 'saved_offline'
      ? pain
        ? 'Lihat variasi aman'
        : 'Kembali ke beranda'
      : syncStatus === 'sync_failed'
      ? 'Coba kirim lagi'
      : 'Kirim hasil ke server';

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 112 + Math.max(insets.bottom, spacing.lg) },
        ]}
      >
        <View style={[styles.badge, painSafetyActive && styles.badgeSafe]}>
          <Icon
            color={painSafetyActive ? colors.amber : colors.mint}
            name={painSafetyActive ? 'shield' : 'check'}
            size={17}
          />
          <Text
            style={[styles.badgeText, painSafetyActive && styles.badgeTextSafe]}
          >
            {painSafetyActive ? 'PROGRESI DIJEDA AMAN' : 'TARGET SELESAI'}
          </Text>
        </View>
        <Text style={styles.title}>
          {painSafetyActive
            ? 'Berhenti adalah pilihan kuat.'
            : `${session.exerciseLabel} selesai.`}
        </Text>
        <Text style={styles.body}>{sync.description}</Text>

        <View style={styles.scoreCard}>
          <ProgressRing
            caption={caption}
            label={scoreEligible ? String(Math.round(progressValue)) : '—'}
            size={118}
            stroke={10}
            value={progressValue}
          />
          <View style={styles.metrics}>
            <View>
              <Text style={styles.metricValue}>{metric}</Text>
              <Text style={styles.metricLabel}>{targetUnit}</Text>
            </View>
            <View style={styles.rule} />
            <View>
              <Text style={styles.metricValue}>
                {serverConfirmed ? `+${completion.xpAwarded} XP` : 'Menunggu'}
              </Text>
              <Text style={styles.metricLabel}>penghargaan server</Text>
            </View>
          </View>
        </View>

        {!scoreEligible ? (
          <Text style={styles.guidedNote}>
            {session.scoringSupported
              ? 'Kepercayaan pelacakan terlalu rendah, jadi sesi ini tidak diberi skor bentuk.'
              : 'Gerakan ini belum memiliki validasi postur. Tidak ada skor bentuk yang dibuat.'}
          </Text>
        ) : null}

        <View style={styles.mastery}>
          <View style={styles.masteryTop}>
            <View style={styles.masteryCopy}>
              <Text style={styles.sectionEyebrow}>
                PENGUASAAN {session.exerciseLabel.toUpperCase()}
              </Text>
              <Text style={styles.masteryValue}>{masteryLabel}</Text>
            </View>
            <View style={styles.sync}>
              <View style={[styles.syncDot, { backgroundColor: sync.color }]} />
              <Text style={styles.syncText}>{sync.label}</Text>
            </View>
          </View>
          {serverConfirmed && completion.masteryAfter !== null ? (
            <View style={styles.bar}>
              <View
                style={[
                  styles.barFill,
                  painSafetyActive && styles.barFillPaused,
                  {
                    width: `${Math.max(
                      0,
                      Math.min(100, completion.masteryAfter),
                    )}%`,
                  },
                ]}
              />
            </View>
          ) : null}
          <Text style={styles.masteryNote}>
            {completion?.safetyMessage ??
              (serverConfirmed
                ? completion.newlyUnlockedLessonIds.length > 0
                  ? `${completion.newlyUnlockedLessonIds.length} lesson baru dibuka oleh server.`
                  : completion.progressionSuppressed
                  ? 'Server tidak menaikkan penguasaan atau membuka lesson dari sesi ini.'
                  : 'Belum ada lesson baru yang dibuka dari sesi ini.'
                : 'Status lokal tidak digunakan untuk memberi XP atau membuka lesson.')}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <Text style={styles.question}>Seberapa berat rasanya?</Text>
        <View style={styles.effortRow}>
          {[2, 4, 6, 8, 10].map(value => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: effort === value }}
              disabled={feedbackLocked}
              key={value}
              onPress={() => setEffort(value)}
              style={[styles.effort, effort === value && styles.effortActive]}
            >
              <Text
                style={[
                  styles.effortValue,
                  effort === value && styles.effortValueActive,
                ]}
              >
                {value}
              </Text>
              <Text style={styles.effortLabel}>
                {value === 2
                  ? 'Ringan'
                  : value === 4
                  ? 'Pas'
                  : value === 6
                  ? 'Cukup'
                  : value === 8
                  ? 'Berat'
                  : 'Maks.'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.question}>Apakah ada rasa nyeri?</Text>
        <Text style={styles.painHint}>Nyeri berbeda dari lelah biasa.</Text>
        <View style={styles.painOptions}>
          {[
            { value: false, label: 'Tidak ada nyeri', icon: 'check' as const },
            { value: true, label: 'Ada nyeri', icon: 'shield' as const },
          ].map(option => {
            const active = pain === option.value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                disabled={feedbackLocked}
                key={option.label}
                onPress={() => setPain(option.value)}
                style={[
                  styles.painChoice,
                  active &&
                    (option.value
                      ? styles.painChoiceCaution
                      : styles.painChoiceSafe),
                ]}
              >
                <Icon
                  color={
                    active
                      ? option.value
                        ? colors.amber
                        : colors.mint
                      : colors.secondary
                  }
                  name={option.icon}
                  size={20}
                />
                <Text style={styles.painChoiceText}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <SafeFooter>
        <PrimaryButton
          disabled={
            effort === undefined ||
            pain === undefined ||
            submitting ||
            syncStatus === 'waiting_to_sync'
          }
          label={buttonLabel}
          onPress={primaryAction}
        />
      </SafeFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(102,221,177,.1)',
    borderColor: 'rgba(102,221,177,.35)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  badgeText: { ...type.micro, color: colors.mint, letterSpacing: 0.7 },
  badgeSafe: {
    backgroundColor: 'rgba(255,180,84,.08)',
    borderColor: 'rgba(255,180,84,.35)',
  },
  badgeTextSafe: { color: colors.amber },
  title: {
    ...type.display,
    color: colors.text,
    letterSpacing: -1,
    marginTop: spacing.lg,
  },
  body: { ...type.body, color: colors.secondary, marginTop: spacing.sm },
  scoreCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  metrics: { flex: 1, gap: spacing.sm },
  metricValue: {
    ...type.card,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: { ...type.micro, color: colors.secondary, marginTop: 2 },
  rule: { backgroundColor: colors.border, height: 1 },
  guidedNote: {
    ...type.support,
    color: colors.amber,
    marginTop: spacing.sm,
  },
  mastery: {
    backgroundColor: colors.raised,
    borderRadius: radius.card,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  masteryTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  masteryCopy: { flex: 1 },
  sectionEyebrow: { ...type.micro, color: colors.coral, letterSpacing: 0.7 },
  masteryValue: { ...type.section, color: colors.text, marginTop: 3 },
  sync: { alignItems: 'center', flexDirection: 'row', gap: 5, maxWidth: 130 },
  syncDot: { borderRadius: 4, height: 7, width: 7 },
  syncText: {
    ...type.micro,
    color: colors.secondary,
    fontSize: 9,
    flexShrink: 1,
  },
  bar: {
    backgroundColor: colors.surface,
    borderRadius: 3,
    height: 6,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  barFill: { backgroundColor: colors.coral, height: 6 },
  barFillPaused: { backgroundColor: colors.amber },
  masteryNote: {
    ...type.support,
    color: colors.secondary,
    marginTop: spacing.sm,
  },
  error: { ...type.support, color: colors.amber, marginTop: spacing.sm },
  question: { ...type.card, color: colors.text, marginTop: spacing.xl },
  effortRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  effort: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: 1,
    flex: 1,
    minHeight: 64,
    justifyContent: 'center',
  },
  effortActive: { backgroundColor: colors.coral, borderColor: colors.coral },
  effortValue: { ...type.card, color: colors.text },
  effortValueActive: { color: colors.canvas },
  effortLabel: { ...type.micro, color: colors.secondary, fontSize: 9 },
  painHint: { ...type.support, color: colors.secondary, marginTop: 2 },
  painOptions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  painChoice: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
  },
  painChoiceSafe: {
    backgroundColor: 'rgba(102,221,177,.08)',
    borderColor: colors.mint,
  },
  painChoiceCaution: {
    backgroundColor: 'rgba(255,180,84,.08)',
    borderColor: colors.amber,
  },
  painChoiceText: { ...type.support, color: colors.text, flexShrink: 1 },
});
