import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { BrandMark } from '../components/BrandMark';
import { ProgressRing } from '../components/ProgressRing';
import { Icon } from '../components/Icon';
import { useReducedMotion } from '../components/useReducedMotion';
import type { CourseLesson } from '../course/types';
import { colors, radius, spacing, type } from '../design/tokens';

export type HomeProgressSummary = Readonly<{
  displayName?: string;
  weekLabel?: string;
  nextLesson?: CourseLesson | null;
  progress?: Readonly<{
    xp: Readonly<{
      today: number;
      dailyCap: number;
    }>;
    streak: Readonly<{ current: number }>;
  }>;
  courseProgress?: Readonly<{ completed: number; total: number }>;
}>;

type HomeScreenProps = Readonly<{
  error?: string | null;
  loading?: boolean;
  onRetry?: () => void;
  onStartLesson?: () => void;
  summary?: HomeProgressSummary | null;
}>;

export function HomeScreen({
  error,
  loading = false,
  onRetry,
  onStartLesson,
  summary,
}: HomeScreenProps) {
  const reducedMotion = useReducedMotion();
  const nextLesson = summary?.nextLesson ?? null;
  const progress = summary?.progress;
  const courseProgress = summary?.courseProgress;
  const hasServerData = Boolean(nextLesson || progress || courseProgress);
  const progressPercent = progress
    ? Math.max(
        0,
        Math.min(
          100,
          (progress.xp.today / Math.max(1, progress.xp.dailyCap)) * 100,
        ),
      )
    : 0;
  const entry = useRef(
    new Animated.Value(Platform.OS === 'web' ? 1 : 0),
  ).current;
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Animated.timing(entry, {
      toValue: 1,
      duration: reducedMotion ? 0 : 480,
      useNativeDriver: true,
    }).start();
  }, [entry, reducedMotion]);

  return (
    <Animated.View
      style={[
        styles.flex,
        {
          opacity: entry,
          transform: [
            {
              translateY: entry.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <BrandMark />
        </View>
        <View style={styles.greeting}>
          <Text style={styles.eyebrow}>
            {summary?.displayName
              ? `SELAMAT PAGI, ${summary.displayName.toUpperCase()}`
              : 'SELAMAT PAGI'}
          </Text>
          <Text style={styles.title}>Jadikan hari ini{`\n`}berarti.</Text>
          <Text style={styles.subtitle}>
            Latihan kecil yang konsisten membangun dirimu yang paling kuat.
          </Text>
        </View>
        {!hasServerData ? (
          <View accessibilityLiveRegion="polite" style={styles.stateCard}>
            {loading ? (
              <>
                <ActivityIndicator color={colors.coral} size="large" />
                <Text style={styles.stateTitle}>Memuat ringkasan server…</Text>
                <Text style={styles.stateBody}>
                  Lesson dan progres akan muncul setelah data diterima.
                </Text>
              </>
            ) : (
              <>
                <Icon
                  color={error ? colors.amber : colors.mint}
                  name="shield"
                  size={28}
                />
                <Text style={styles.stateTitle}>
                  {error
                    ? 'Ringkasan belum bisa dimuat.'
                    : 'Belum ada ringkasan yang dikonfirmasi.'}
                </Text>
                <Text style={styles.stateBody}>
                  {error ??
                    'Selesaikan lesson server pertamamu untuk mulai membangun progres.'}
                </Text>
                {onRetry ? (
                  <Pressable
                    accessibilityLabel="Coba muat ulang ringkasan"
                    accessibilityRole="button"
                    onPress={onRetry}
                    style={({ pressed }) => [
                      styles.retryButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.retryButtonText}>Coba lagi</Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        ) : (
          <>
            {loading ? (
              <View
                accessibilityLiveRegion="polite"
                style={styles.statusBanner}
              >
                <ActivityIndicator color={colors.coral} size="small" />
                <Text style={styles.statusText}>
                  Menyegarkan ringkasan server…
                </Text>
              </View>
            ) : error ? (
              <View accessibilityLiveRegion="polite" style={styles.errorBanner}>
                <View style={styles.errorCopy}>
                  <Text style={styles.errorTitle}>Penyegaran gagal.</Text>
                  <Text style={styles.errorBody}>{error}</Text>
                </View>
                {onRetry ? (
                  <Pressable
                    accessibilityLabel="Coba muat ulang ringkasan"
                    accessibilityRole="button"
                    onPress={onRetry}
                    style={({ pressed }) => [
                      styles.inlineRetry,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.inlineRetryText}>Coba lagi</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <ImageBackground
              imageStyle={styles.heroImage}
              source={require('../assets/images/home-hero.jpg')}
              style={styles.hero}
            >
              <Svg height="100%" style={styles.heroScrim} width="100%">
                <Defs>
                  <LinearGradient id="left" x1="0" y1="0" x2="1" y2="0">
                    <Stop
                      offset="0"
                      stopColor={colors.canvas}
                      stopOpacity=".93"
                    />
                    <Stop
                      offset="58%"
                      stopColor={colors.canvas}
                      stopOpacity=".74"
                    />
                    <Stop
                      offset="1"
                      stopColor={colors.canvas}
                      stopOpacity="0"
                    />
                  </LinearGradient>
                  <LinearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
                    <Stop
                      offset="35%"
                      stopColor={colors.canvas}
                      stopOpacity="0"
                    />
                    <Stop
                      offset="1"
                      stopColor={colors.canvas}
                      stopOpacity=".72"
                    />
                  </LinearGradient>
                </Defs>
                <Rect fill="url(#left)" height="100%" width="78%" />
                <Rect fill="url(#bottom)" height="100%" width="100%" />
              </Svg>
              <View style={styles.heroContent}>
                <View style={styles.heroBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.heroBadgeText}>
                    {nextLesson ? 'LATIHAN BERIKUTNYA' : 'STATUS SERVER'}
                  </Text>
                </View>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroKicker}>
                    {nextLesson
                      ? nextLesson.courseTitle.toUpperCase()
                      : 'JALUR BELAJAR'}
                  </Text>
                  <Text style={styles.heroTitle}>
                    {nextLesson
                      ? nextLesson.title
                      : 'Belum ada lesson berikutnya.'}
                  </Text>
                  <Text style={styles.heroMeta}>
                    {nextLesson
                      ? `${nextLesson.durationMinutes ?? '—'} menit · ${
                          nextLesson.exerciseName
                        }`
                      : 'Server belum merekomendasikan lesson yang bisa dimulai.'}
                  </Text>
                </View>
                {nextLesson && onStartLesson ? (
                  <Pressable
                    accessibilityLabel={`Lanjutkan latihan ${nextLesson.title}`}
                    accessibilityRole="button"
                    onPress={onStartLesson}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>
                      Lanjutkan latihan
                    </Text>
                    <Icon color={colors.canvas} name="arrow-right" size={21} />
                  </Pressable>
                ) : null}
              </View>
            </ImageBackground>
            {progress ? (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Ritmemu</Text>
                  {summary?.weekLabel ? (
                    <Text style={styles.sectionMeta}>{summary.weekLabel}</Text>
                  ) : null}
                </View>
                <View style={styles.rhythmRow}>
                  <View style={styles.rhythmCard}>
                    <View style={styles.streakTop}>
                      <Icon color={colors.coral} name="flame" size={26} />
                      <Text style={styles.streakNumber}>
                        {progress.streak.current} hari
                      </Text>
                    </View>
                    <Text style={styles.rhythmHint}>dikonfirmasi server</Text>
                  </View>
                  <View style={styles.rhythmCard}>
                    <ProgressRing
                      caption="XP HARI INI"
                      label={`${progress.xp.today} / ${progress.xp.dailyCap}`}
                      size={98}
                      stroke={7}
                      value={progressPercent}
                    />
                    <Text style={styles.rhythmHint}>
                      {Math.round(progressPercent)}% dari target
                    </Text>
                  </View>
                </View>
              </>
            ) : null}
            {courseProgress ? (
              <>
                <View style={styles.pathHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Jalurmu</Text>
                    <Text style={styles.pathSubhead}>
                      {courseProgress
                        ? `${courseProgress.completed} dari ${courseProgress.total} pelajaran`
                        : null}
                    </Text>
                  </View>
                  <Text style={styles.pathProgress}>
                    {`${Math.round(
                      (courseProgress.completed /
                        Math.max(1, courseProgress.total)) *
                        100,
                    )}%`}
                  </Text>
                </View>
                <View style={styles.pathTrack}>
                  <View
                    accessibilityLabel={
                      courseProgress
                        ? `${courseProgress.completed} dari ${courseProgress.total} pelajaran selesai`
                        : undefined
                    }
                    style={styles.pathTrackBase}
                  >
                    <View
                      style={[
                        styles.pathFill,
                        {
                          width: `${
                            courseProgress
                              ? Math.max(
                                  0,
                                  Math.min(
                                    100,
                                    (courseProgress.completed /
                                      Math.max(1, courseProgress.total)) *
                                      100,
                                  ),
                                )
                              : 0
                          }%`,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={styles.pathCaption}>
                  {nextLesson
                    ? `Target berikutnya: ${nextLesson.title}.`
                    : 'Tidak ada lesson berikutnya yang dapat dimulai saat ini.'}
                </Text>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.xxl,
  },
  greeting: { paddingBottom: spacing.xl },
  eyebrow: {
    ...type.micro,
    color: colors.coral,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  title: { ...type.display, color: colors.text, letterSpacing: -1.1 },
  subtitle: {
    ...type.body,
    color: colors.secondary,
    marginTop: spacing.sm,
    maxWidth: 300,
  },
  hero: { borderRadius: radius.card, height: 286, overflow: 'hidden' },
  heroImage: { borderRadius: radius.card },
  heroScrim: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  heroContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  heroBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(13,11,11,0.72)',
    borderColor: 'rgba(255,247,243,0.13)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  liveDot: {
    backgroundColor: colors.coral,
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  heroBadgeText: { ...type.micro, color: colors.text, letterSpacing: 0.4 },
  heroCopy: { maxWidth: 235 },
  heroKicker: {
    ...type.micro,
    color: colors.coral,
    letterSpacing: 1.1,
    marginBottom: 5,
  },
  heroTitle: { ...type.h1, color: colors.text, fontSize: 27, lineHeight: 32 },
  heroMeta: { ...type.support, color: colors.text, marginTop: 5 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: radius.control,
    flexDirection: 'row',
    height: 56,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  buttonPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  primaryButtonText: { ...type.body, color: colors.canvas, fontWeight: '800' },
  stateCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.xl,
  },
  stateTitle: {
    ...type.section,
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  stateBody: {
    ...type.body,
    color: colors.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: radius.control,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  retryButtonText: { ...type.card, color: colors.canvas },
  statusBanner: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  statusText: { ...type.support, color: colors.secondary, flex: 1 },
  errorBanner: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.amber,
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.sm,
  },
  errorCopy: { flex: 1 },
  errorTitle: { ...type.support, color: colors.text, fontWeight: '700' },
  errorBody: { ...type.micro, color: colors.secondary, marginTop: 2 },
  inlineRetry: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  inlineRetryText: { ...type.support, color: colors.text, fontWeight: '700' },
  sectionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.xxl,
  },
  sectionTitle: { ...type.section, color: colors.text },
  sectionMeta: { ...type.support, color: colors.muted },
  rhythmRow: { flexDirection: 'row', gap: spacing.sm },
  rhythmCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 142,
    padding: spacing.md,
  },
  rhythmHint: { ...type.micro, color: colors.secondary, marginTop: spacing.xs },
  streakTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  streakNumber: {
    ...type.card,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  pathHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.xxl,
  },
  pathSubhead: { ...type.support, color: colors.secondary, marginTop: 3 },
  pathProgress: { ...type.card, color: colors.coral },
  pathTrack: {
    marginHorizontal: spacing.xs,
    minHeight: 16,
  },
  pathTrackBase: {
    backgroundColor: colors.raised,
    borderRadius: 4,
    height: 8,
    overflow: 'hidden',
  },
  pathFill: {
    backgroundColor: colors.coral,
    height: 8,
  },
  pathCaption: {
    ...type.support,
    color: colors.secondary,
    lineHeight: 21,
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
});
