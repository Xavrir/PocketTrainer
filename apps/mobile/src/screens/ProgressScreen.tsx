import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors, radius, spacing, type } from '../design/tokens';
import { Icon } from '../components/Icon';

export type MobileProgress = Readonly<{
  xp: Readonly<{
    total: number;
    today: number;
    dailyCap: number;
    level: number;
    currentLevelXp: number;
    nextLevelXp: number;
  }>;
  streak: Readonly<{
    current: number;
    longest: number;
    todayStatus: 'active' | 'protected' | 'open';
  }>;
  completedLessonIds: readonly string[];
  mastery: readonly Readonly<{
    exerciseKey: string;
    bestFormScore: number;
    qualifyingSessions: number;
    mastered: boolean;
    restricted: boolean;
  }>[];
  achievements: readonly Readonly<{ key: string; unlockedAt: string }>[];
}>;

const exerciseNames: Readonly<Record<string, string>> = {
  body_squat: 'Body squat',
  incline_push_up: 'Push-up miring',
  tree_pose: 'Tree Pose',
  warrior_two: 'Warrior II',
};

function masteryPresentation(item: MobileProgress['mastery'][number]) {
  if (item.restricted) {
    return { status: 'DIJEDA AMAN', color: colors.amber };
  }
  if (item.mastered) return { status: 'DIKUASAI', color: colors.mint };
  if (item.qualifyingSessions > 0) {
    return { status: 'BERKEMBANG', color: colors.violet };
  }
  return { status: 'MULAI', color: colors.secondary };
}

export function ProgressScreen({
  error,
  loading = false,
  onRetry,
  progress,
}: {
  error?: string;
  loading?: boolean;
  onRetry?: () => void;
  progress?: MobileProgress;
}) {
  const { width } = useWindowDimensions();
  const narrow = width < 380;
  if (loading && !progress) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.coral} size="large" />
        <Text style={styles.loadingText}>Memuat progres server…</Text>
      </View>
    );
  }
  if (!progress) {
    return (
      <View style={styles.centered}>
        <Icon color={colors.amber} name="shield" size={30} />
        <Text style={styles.emptyTitle}>Progres belum tersedia.</Text>
        <Text style={styles.emptyBody}>
          {error ?? 'Masuk dan hubungkan API untuk melihat data server.'}
        </Text>
        {onRetry ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={styles.retry}
          >
            <Text style={styles.retryText}>Coba lagi</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  const xpPercent = Math.max(
    0,
    Math.min(
      100,
      (progress.xp.currentLevelXp / Math.max(1, progress.xp.nextLevelXp)) * 100,
    ),
  );
  const xpRemaining = Math.max(
    0,
    progress.xp.nextLevelXp - progress.xp.currentLevelXp,
  );
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>MOVEMENT PASSPORT</Text>
          <Text style={[styles.title, narrow && styles.titleNarrow]}>
            Tubuhmu sedang belajar.
          </Text>
        </View>
        <View style={styles.level}>
          <Text style={styles.levelNumber}>{progress.xp.level}</Text>
          <Text style={styles.levelLabel}>LEVEL</Text>
        </View>
      </View>
      <Text style={styles.body}>
        Catatan tenang tentang konsistensi, kontrol, dan kepercayaan gerakmu.
      </Text>
      <View style={styles.summary}>
        <View style={styles.xp}>
          <Text style={styles.summaryLabel}>TOTAL XP</Text>
          <Text style={styles.xpValue}>
            {progress.xp.total.toLocaleString('id-ID')}
          </Text>
          <Text style={styles.xpMeta}>
            {xpRemaining} XP menuju level {progress.xp.level + 1}
          </Text>
          <View style={styles.xpBar}>
            <View style={[styles.xpFill, { width: `${xpPercent}%` }]} />
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.streak}>
          <Icon color={colors.coral} name="flame" size={28} />
          <Text style={styles.streakValue}>{progress.streak.current}</Text>
          <Text style={styles.summaryLabel}>HARI</Text>
        </View>
      </View>
      <View style={styles.sectionRow}>
        <View>
          <Text style={styles.section}>Ringkasan server</Text>
          <Text style={styles.sectionMeta}>
            Hanya hasil yang sudah dikonfirmasi
          </Text>
        </View>
        <Text style={styles.trend}>{progress.xp.today} XP hari ini</Text>
      </View>
      <View style={styles.serverSummary}>
        <View style={styles.serverMetric}>
          <Text style={styles.serverValue}>
            {progress.completedLessonIds.length}
          </Text>
          <Text style={styles.sectionMeta}>lesson selesai</Text>
        </View>
        <View style={styles.serverMetric}>
          <Text style={styles.serverValue}>{progress.streak.longest}</Text>
          <Text style={styles.sectionMeta}>streak terpanjang</Text>
        </View>
        <View style={styles.serverMetric}>
          <Text style={styles.serverValue}>{progress.achievements.length}</Text>
          <Text style={styles.sectionMeta}>pencapaian</Text>
        </View>
      </View>
      <View style={styles.sectionRow}>
        <Text style={styles.section}>Penguasaan gerak</Text>
        <Text style={styles.sectionMeta}>Skor terbaik valid</Text>
      </View>
      <View style={styles.masteryGrid}>
        {progress.mastery.map(item => {
          const presentation = masteryPresentation(item);
          return (
            <View
              accessibilityLabel={`${
                exerciseNames[item.exerciseKey] ?? item.exerciseKey
              }: ${item.bestFormScore} dari 100, ${presentation.status}, ${
                item.qualifyingSessions
              } sesi berkualitas`}
              key={item.exerciseKey}
              style={[styles.masteryCard, narrow && styles.masteryCardNarrow]}
            >
              <View style={styles.masteryTop}>
                <Text style={styles.masteryName}>
                  {exerciseNames[item.exerciseKey] ?? item.exerciseKey}
                </Text>
                <Text
                  style={[styles.masteryStatus, { color: presentation.color }]}
                >
                  {presentation.status}
                </Text>
              </View>
              <Text style={styles.masteryValue}>{item.bestFormScore}</Text>
              <View style={styles.masteryBar}>
                <View
                  style={[
                    styles.masteryFill,
                    {
                      backgroundColor: presentation.color,
                      width: `${Math.max(
                        0,
                        Math.min(100, item.bestFormScore),
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.qualifying}>
                {item.qualifyingSessions} sesi berkualitas
              </Text>
            </View>
          );
        })}
        {progress.mastery.length === 0 ? (
          <Text style={styles.noMastery}>
            Belum ada sesi dengan pelacakan yang memenuhi syarat skor.
          </Text>
        ) : null}
      </View>
      <View style={styles.passport}>
        <View style={styles.passportIcon}>
          <Icon color={colors.mint} name="shield" size={26} />
        </View>
        <View style={styles.passportCopy}>
          <Text style={styles.passportTitle}>
            {progress.achievements.length} pencapaian server
          </Text>
          <Text style={styles.passportBody}>
            {progress.achievements.length > 0
              ? progress.achievements.map(item => item.key).join(' · ')
              : 'Selesaikan lesson valid pertamamu untuk memulai.'}
          </Text>
        </View>
        <Icon color={colors.muted} name="chevron" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  centered: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: { ...type.body, color: colors.secondary, marginTop: spacing.md },
  emptyTitle: { ...type.section, color: colors.text, marginTop: spacing.md },
  emptyBody: {
    ...type.body,
    color: colors.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  retry: {
    backgroundColor: colors.coral,
    borderRadius: radius.control,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryText: { ...type.card, color: colors.canvas },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headingCopy: { flex: 1, minWidth: 0 },
  eyebrow: { ...type.micro, color: colors.coral, letterSpacing: 1 },
  title: {
    ...type.h1,
    color: colors.text,
    letterSpacing: -0.6,
    marginTop: spacing.sm,
    maxWidth: 285,
  },
  titleNarrow: { maxWidth: 240 },
  level: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 16,
    height: 58,
    justifyContent: 'center',
    width: 58,
    flexShrink: 0,
  },
  levelNumber: {
    ...type.card,
    color: colors.canvas,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
  levelLabel: {
    ...type.micro,
    color: colors.canvas,
    fontSize: 8,
    lineHeight: 9,
  },
  body: { ...type.body, color: colors.secondary, marginTop: spacing.sm },
  summary: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  xp: { flex: 1 },
  summaryLabel: { ...type.micro, color: colors.secondary, letterSpacing: 0.8 },
  xpValue: {
    fontFamily: type.display.fontFamily,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  xpMeta: { ...type.micro, color: colors.secondary },
  xpBar: {
    backgroundColor: colors.raised,
    borderRadius: 3,
    height: 6,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  xpFill: { backgroundColor: colors.coral, height: 6 },
  divider: {
    backgroundColor: colors.border,
    height: 78,
    marginHorizontal: spacing.lg,
    width: 1,
  },
  streak: { alignItems: 'center' },
  streakValue: {
    ...type.section,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  sectionRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
  },
  section: { ...type.section, color: colors.text },
  sectionMeta: { ...type.micro, color: colors.secondary, marginTop: 2 },
  trend: { ...type.card, color: colors.mint },
  serverSummary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  serverMetric: { alignItems: 'center', flex: 1 },
  serverValue: {
    ...type.section,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  masteryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  masteryCard: {
    backgroundColor: colors.raised,
    borderRadius: radius.card,
    minHeight: 112,
    padding: spacing.md,
    width: '48%',
  },
  masteryCardNarrow: { minHeight: 120, width: '100%' },
  masteryTop: {
    alignItems: 'flex-start',
    gap: 2,
  },
  masteryName: { ...type.support, color: colors.secondary, flex: 1 },
  masteryStatus: {
    ...type.micro,
    fontSize: 12,
    letterSpacing: 0.5,
    lineHeight: 16,
  },
  masteryValue: {
    fontFamily: type.display.fontFamily,
    fontSize: 29,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  masteryBar: {
    backgroundColor: colors.surface,
    borderRadius: 3,
    height: 5,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  masteryFill: { height: 5 },
  qualifying: { ...type.micro, color: colors.muted, marginTop: spacing.xs },
  noMastery: {
    ...type.support,
    color: colors.secondary,
    paddingVertical: spacing.md,
  },
  passport: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  passportIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(102,221,177,.1)',
    borderRadius: 13,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  passportCopy: { flex: 1 },
  passportTitle: { ...type.card, color: colors.text, fontSize: 15 },
  passportBody: { ...type.micro, color: colors.secondary, marginTop: 2 },
});
