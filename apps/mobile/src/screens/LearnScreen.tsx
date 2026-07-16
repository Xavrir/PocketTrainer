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
import { Icon } from '../components/Icon';
import { formatEquipment, formatLessonTarget } from '../course/catalogAdapter';
import { courseCopy, resolveCopy } from '../course/localization';
import type {
  CourseCatalogView,
  CourseLocale,
  CourseLesson,
  CourseLessonState,
  Course,
  CourseTrack,
} from '../course/types';
import { useCourseCatalog } from '../course/useCourseCatalog';
import { colors, radius, spacing, type } from '../design/tokens';

export type LearnScreenProps = Readonly<{
  catalog?: CourseCatalogView | null;
  loading?: boolean;
  error?: string | null;
  selectedLessonId?: string | null;
  locale?: CourseLocale;
  onSelect?: (lesson: CourseLesson) => void;
  onStart?: (lesson: CourseLesson) => void;
  onRetry?: () => void;
}>;

const STATE_COLORS: Readonly<Record<CourseLessonState, string>> = {
  completed: colors.mint,
  available: colors.coral,
  gated: colors.amber,
  locked: colors.muted,
};

export function LearnScreen(props: LearnScreenProps) {
  const controlled =
    props.catalog !== undefined ||
    props.loading !== undefined ||
    props.error !== undefined;
  const remote = useCourseCatalog({ enabled: !controlled });
  const catalog = controlled ? props.catalog ?? null : remote.catalog;
  const loading = controlled ? props.loading ?? false : remote.loading;
  const error = controlled ? props.error ?? null : remote.error;
  const retry = props.onRetry ?? remote.refresh;
  const { width } = useWindowDimensions();
  const narrow = width < 380;
  const locale = props.locale ?? catalog?.locale ?? 'id';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.top}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>
            JALUR BELAJAR · LEVEL {catalog?.accountLevel ?? '—'}
          </Text>
          <Text style={[styles.title, narrow && styles.titleNarrow]}>
            Repetisi kecil.<Text style={styles.coral}> Progres nyata.</Text>
          </Text>
        </View>
        <View style={styles.level}>
          <Text style={styles.levelValue}>{catalog?.accountLevel ?? '—'}</Text>
          <Text style={styles.levelLabel}>LEVEL</Text>
        </View>
      </View>
      <Text style={styles.body}>
        Kesulitan hanya terbuka saat level, penguasaan, dan prasyaratmu
        mendukung.
      </Text>

      {loading ? <LoadingState /> : null}
      {!loading && error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : null}
      {!loading && !error && catalog ? (
        <>
          <View style={styles.summary}>
            <View>
              <Text style={styles.summaryValue}>
                {catalog.completedLessonCount}/{catalog.totalLessonCount}
              </Text>
              <Text style={styles.summaryLabel}>PELAJARAN SELESAI</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryTitle}>Tiga jalur, satu ritme.</Text>
              <Text style={styles.summaryBody}>
                Strength, Yoga, dan Mobility mengikuti progres yang sama.
              </Text>
            </View>
          </View>

          {catalog.tracks.map(track => (
            <TrackSection
              key={track.id}
              narrow={narrow}
              onSelect={props.onSelect}
              onStart={props.onStart}
              locale={locale}
              selectedLessonId={props.selectedLessonId ?? null}
              track={track}
            />
          ))}

          <View style={styles.safeCard}>
            <View style={styles.safeIcon}>
              <Icon color={colors.mint} name="shield" />
            </View>
            <View style={styles.safeCopy}>
              <Text style={styles.safeEyebrow}>PROGRES YANG JUJUR</Text>
              <Text style={styles.safeTitle}>
                Level dan penguasaan diperiksa terpisah.
              </Text>
              <Text style={styles.safeBody}>
                Menyelesaikan satu syarat tidak melewati syarat lain yang belum
                terpenuhi.
              </Text>
            </View>
          </View>
        </>
      ) : null}
      {!loading && !error && !catalog ? (
        <ErrorState
          message="Catalog belum tersedia untuk akun ini."
          onRetry={retry}
        />
      ) : null}
    </ScrollView>
  );
}

function TrackSection({
  narrow,
  onSelect,
  onStart,
  locale,
  selectedLessonId,
  track,
}: Readonly<{
  narrow: boolean;
  onSelect: LearnScreenProps['onSelect'];
  onStart: LearnScreenProps['onStart'];
  locale: CourseLocale;
  selectedLessonId: string | null;
  track: CourseTrack;
}>) {
  const lessons = track.units.flatMap(unit => unit.lessons);
  return (
    <View style={styles.trackSection}>
      <View style={styles.trackHeader}>
        <View style={[styles.trackMarker, { backgroundColor: track.accent }]} />
        <View style={styles.trackHeading}>
          <Text style={styles.trackKey}>{track.key.toUpperCase()}</Text>
          <Text style={styles.trackTitle}>{track.title}</Text>
          {track.description ? (
            <Text style={styles.trackDescription}>{track.description}</Text>
          ) : null}
        </View>
        <Text style={styles.trackCount}>{lessons.length} pelajaran</Text>
      </View>

      <View style={styles.lessonList}>
        {(track.courses.length > 0
          ? track.courses
          : [
              {
                id: `${track.id}-compat`,
                key: `${track.key}-compat`,
                title: track.title,
                description: '',
                order: 1,
                minimumAccountLevel: 0,
                publishingState: 'published',
                units: track.units,
              },
            ]
        ).map(course => (
          <CourseSection
            course={course}
            key={course.id}
            locale={locale}
            narrow={narrow}
            onSelect={onSelect}
            onStart={onStart}
            selectedLessonId={selectedLessonId}
          />
        ))}
      </View>
    </View>
  );
}

function CourseSection({
  course,
  locale,
  narrow,
  onSelect,
  onStart,
  selectedLessonId,
}: Readonly<{
  course: Course;
  locale: CourseLocale;
  narrow: boolean;
  onSelect: LearnScreenProps['onSelect'];
  onStart: LearnScreenProps['onStart'];
  selectedLessonId: string | null;
}>) {
  return (
    <View style={styles.courseSection}>
      <Text style={styles.courseTitle}>{course.title}</Text>
      {course.description ? (
        <Text style={styles.courseDescription}>{course.description}</Text>
      ) : null}
      {course.units.map(unit => (
        <View key={unit.id}>
          <View style={styles.unitHeader}>
            <Text style={styles.unitTitle}>{unit.title}</Text>
            <View style={styles.unitLine} />
          </View>
          {unit.lessons.map(lesson => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              locale={locale}
              narrow={narrow}
              onPress={() => {
                onSelect?.(lesson);
                onStart?.(lesson);
              }}
              selected={selectedLessonId === lesson.id}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function LessonRow({
  lesson,
  locale,
  narrow,
  onPress,
  selected,
}: Readonly<{
  lesson: CourseLesson;
  locale: CourseLocale;
  narrow: boolean;
  onPress: () => void;
  selected: boolean;
}>) {
  const stateCopy = {
    label: resolveCopy(courseCopy.stateLabels[lesson.access.state], locale),
    color: STATE_COLORS[lesson.access.state],
  };
  const launchAllowed = lesson.access.launchAllowed;
  const reasons = lesson.access.reasons;
  const reasonSummary = reasons.map(reason => reason.message).join(' ');
  return (
    <Pressable
      accessibilityHint={
        launchAllowed
          ? 'Membuka pratinjau pelajaran.'
          : reasonSummary || 'Pelajaran belum dapat dibuka.'
      }
      accessibilityLabel={`${lesson.title}, ${stateCopy.label.toLowerCase()}${
        reasonSummary ? `. ${reasonSummary}` : ''
      }`}
      accessibilityRole="button"
      accessibilityState={{ disabled: !launchAllowed, selected }}
      disabled={!launchAllowed}
      onPress={onPress}
      style={({ pressed }) => [
        styles.lessonRow,
        narrow && styles.lessonRowNarrow,
        selected && styles.lessonRowSelected,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.node,
          lesson.access.state === 'completed' && styles.nodeCompleted,
          lesson.access.state === 'available' && styles.nodeAvailable,
          lesson.access.state === 'gated' && styles.nodeGated,
        ]}
      >
        {lesson.access.state === 'completed' ? (
          <Icon color={colors.canvas} name="check" size={21} />
        ) : lesson.access.state === 'available' ? (
          <Icon color={colors.canvas} name="play" size={20} />
        ) : (
          <Icon color={stateCopy.color} name="lock" size={18} />
        )}
      </View>
      <View style={styles.lessonCopy}>
        <View style={styles.lessonTitleRow}>
          <Text style={styles.lessonTitle}>{lesson.title}</Text>
          <Text style={[styles.stateLabel, { color: stateCopy.color }]}>
            {stateCopy.label}
          </Text>
        </View>
        <Text style={styles.lessonDescription} numberOfLines={2}>
          {lesson.description || lesson.exerciseName}
        </Text>
        <View style={styles.lessonMetaRow}>
          <Text style={styles.lessonMeta}>{lesson.exerciseName}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.lessonMeta}>
            {formatLessonTarget(lesson.target, locale)}
          </Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.lessonMeta}>{lesson.xp} XP</Text>
        </View>
        <Text style={styles.equipment}>
          {formatEquipment(lesson.equipment, locale)}
        </Text>
        {reasons.map(reason => (
          <View
            key={`${reason.code}-${reason.message}`}
            style={styles.reasonRow}
          >
            <Text style={[styles.reasonMarker, { color: stateCopy.color }]}>
              !
            </Text>
            <Text style={styles.reasonText}>{reason.message}</Text>
          </View>
        ))}
      </View>
      {launchAllowed ? (
        <Icon color={colors.muted} name="chevron" size={19} />
      ) : null}
    </Pressable>
  );
}

function LoadingState() {
  return (
    <View style={styles.statusCard}>
      <ActivityIndicator color={colors.coral} size="small" />
      <View style={styles.statusCopy}>
        <Text style={styles.statusTitle}>Memuat jalur latihan…</Text>
        <Text style={styles.statusBody}>
          Mengambil catalog dan progres akun terbaru.
        </Text>
      </View>
    </View>
  );
}

function ErrorState({
  message,
  onRetry,
}: Readonly<{ message: string; onRetry: () => void }>) {
  return (
    <View style={styles.statusCard}>
      <View style={styles.errorIcon}>
        <Icon color={colors.amber} name="shield" size={21} />
      </View>
      <View style={styles.statusCopy}>
        <Text style={styles.statusTitle}>Jalur belum dapat dimuat.</Text>
        <Text style={styles.statusBody}>{message}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.retryText}>Coba lagi</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  top: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  headingCopy: { flex: 1, minWidth: 0 },
  eyebrow: { ...type.micro, color: colors.coral, letterSpacing: 1.1 },
  title: {
    ...type.display,
    color: colors.text,
    letterSpacing: -1,
    marginTop: spacing.sm,
    maxWidth: 295,
  },
  titleNarrow: { maxWidth: 240 },
  coral: { color: colors.coral },
  level: {
    alignItems: 'center',
    backgroundColor: colors.raised,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    flexShrink: 0,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  levelValue: {
    ...type.card,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  levelLabel: {
    ...type.micro,
    color: colors.coral,
    fontSize: 8,
    lineHeight: 10,
  },
  body: {
    ...type.body,
    color: colors.secondary,
    marginTop: spacing.sm,
    maxWidth: 350,
  },
  statusCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xxl,
    padding: spacing.md,
  },
  statusCopy: { flex: 1 },
  statusTitle: { ...type.card, color: colors.text, fontSize: 15 },
  statusBody: { ...type.support, color: colors.secondary, marginTop: 3 },
  errorIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,180,84,.10)',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  retryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  retryText: { ...type.micro, color: colors.text, letterSpacing: 0.5 },
  summary: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.xxl,
    padding: spacing.md,
  },
  summaryValue: {
    ...type.section,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    ...type.micro,
    color: colors.mint,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  summaryDivider: {
    backgroundColor: colors.border,
    height: 48,
    marginHorizontal: spacing.md,
    width: 1,
  },
  summaryCopy: { flex: 1 },
  summaryTitle: { ...type.card, color: colors.text, fontSize: 14 },
  summaryBody: { ...type.support, color: colors.secondary, marginTop: 2 },
  trackSection: { marginTop: spacing.xxl },
  trackHeader: {
    alignItems: 'flex-start',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingBottom: spacing.sm,
  },
  trackMarker: {
    borderRadius: 3,
    height: 44,
    marginRight: spacing.sm,
    width: 4,
  },
  trackHeading: { flex: 1 },
  trackKey: {
    ...type.micro,
    color: colors.secondary,
    fontSize: 9,
    letterSpacing: 1,
  },
  trackTitle: { ...type.section, color: colors.text, marginTop: 1 },
  trackDescription: {
    ...type.support,
    color: colors.secondary,
    marginTop: 2,
  },
  trackCount: { ...type.micro, color: colors.muted, marginLeft: spacing.xs },
  lessonList: { marginTop: spacing.md },
  courseSection: { marginBottom: spacing.md },
  courseTitle: { ...type.card, color: colors.text, marginTop: spacing.sm },
  courseDescription: { ...type.support, color: colors.secondary, marginTop: 2 },
  unitHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  unitTitle: { ...type.micro, color: colors.secondary, letterSpacing: 0.5 },
  unitLine: { backgroundColor: colors.border, flex: 1, height: 1 },
  lessonRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    minHeight: 118,
    padding: spacing.sm,
  },
  lessonRowNarrow: { alignItems: 'flex-start' },
  lessonRowSelected: {
    backgroundColor: 'rgba(255,90,107,.07)',
    borderColor: 'rgba(255,90,107,.55)',
  },
  node: {
    alignItems: 'center',
    backgroundColor: colors.raised,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 2,
    flexShrink: 0,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  nodeCompleted: { backgroundColor: colors.mint, borderColor: colors.mint },
  nodeAvailable: { backgroundColor: colors.coral, borderColor: colors.coral },
  nodeGated: {
    backgroundColor: 'rgba(255,180,84,.08)',
    borderColor: colors.amber,
  },
  lessonCopy: { flex: 1, minWidth: 0 },
  lessonTitleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  lessonTitle: {
    ...type.card,
    color: colors.text,
    flex: 1,
    fontSize: 15,
  },
  stateLabel: {
    ...type.micro,
    flexShrink: 0,
    fontSize: 8,
    letterSpacing: 0.5,
    lineHeight: 11,
    marginTop: 3,
  },
  lessonDescription: {
    ...type.support,
    color: colors.secondary,
    marginTop: 2,
  },
  lessonMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  lessonMeta: { ...type.micro, color: colors.text, fontSize: 10 },
  metaDot: { ...type.micro, color: colors.muted, marginHorizontal: 5 },
  equipment: {
    ...type.micro,
    color: colors.secondary,
    fontSize: 10,
    marginTop: 2,
  },
  reasonRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.xs,
  },
  reasonMarker: { ...type.micro, fontWeight: '800', lineHeight: 15 },
  reasonText: {
    ...type.micro,
    color: colors.secondary,
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
  pressed: { opacity: 0.72 },
  safeCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  safeIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(102,221,177,.1)',
    borderRadius: 13,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  safeCopy: { flex: 1 },
  safeEyebrow: {
    ...type.micro,
    color: colors.mint,
    fontSize: 11,
    letterSpacing: 0.7,
    lineHeight: 16,
  },
  safeTitle: { ...type.card, color: colors.text, fontSize: 14, marginTop: 3 },
  safeBody: { ...type.support, color: colors.secondary, marginTop: 3 },
});
