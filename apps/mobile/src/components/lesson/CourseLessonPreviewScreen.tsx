import React from 'react';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  formatEquipment,
  formatLessonTarget,
} from '../../course/catalogAdapter';
import type { CourseLesson } from '../../course/types';
import type { CourseLocale } from '../../course/types';
import { colors, radius, spacing, type } from '../../design/tokens';
import { Icon, type IconName } from '../Icon';
import { PageHeader } from '../PageHeader';
import { PrimaryButton } from '../PrimaryButton';
import { SafeFooter } from '../SafeFooter';

export type LessonSupportMode = 'guided' | 'posture-scored' | 'unavailable';

export type StartableLessonSupportMode = Exclude<
  LessonSupportMode,
  'unavailable'
>;

export type CourseLessonPreviewProps = Readonly<{
  lesson: CourseLesson;
  support: LessonSupportMode;
  locale?: CourseLocale;
  onBack: () => void;
  onStart: (lesson: CourseLesson, support: StartableLessonSupportMode) => void;
}>;

const SUPPORT_COPY: Readonly<
  Record<
    LessonSupportMode,
    Readonly<{
      label: string;
      title: string;
      body: string;
      color: string;
      icon: IconName;
    }>
  >
> = {
  guided: {
    label: 'GUIDED',
    title: 'Panduan terpandu',
    body: 'Ikuti target dan waktu sesi. Mode ini tidak menilai postur melalui kamera.',
    color: colors.violet,
    icon: 'spark',
  },
  'posture-scored': {
    label: 'POSTURE-SCORED',
    title: 'Penilaian postur aktif',
    body: 'Gerakan ini secara eksplisit didukung mesin pose untuk tracking dan skor postur.',
    color: colors.mint,
    icon: 'camera',
  },
  unavailable: {
    label: 'BELUM DIDUKUNG',
    title: 'Mode latihan belum tersedia',
    body: 'Catalog tidak membuktikan dukungan coaching. Mulai dinonaktifkan sampai aplikasi menyediakannya.',
    color: colors.amber,
    icon: 'lock',
  },
};

export function CourseLessonPreviewScreen({
  lesson,
  support,
  locale = 'id',
  onBack,
  onStart,
}: CourseLessonPreviewProps) {
  const insets = useSafeAreaInsets();
  const effectiveSupport = resolveLessonSupportMode(lesson, support);
  const supportCopy = SUPPORT_COPY[effectiveSupport];
  const startMode: StartableLessonSupportMode | null =
    effectiveSupport === 'unavailable' ? null : effectiveSupport;
  const canStart =
    lesson.access.launchAllowed &&
    lesson.coaching.playable &&
    startMode !== null;
  const duration =
    lesson.durationMinutes === null
      ? 'Belum dicantumkan'
      : `${lesson.durationMinutes} menit`;
  const details: readonly Readonly<{
    icon: IconName;
    label: string;
    value: string;
  }>[] = [
    { icon: 'person', label: 'GERAKAN', value: lesson.exerciseName },
    {
      icon: 'spark',
      label: 'TARGET',
      value: formatLessonTarget(lesson.target, locale),
    },
    {
      icon: 'shield',
      label: 'PERALATAN',
      value: formatEquipment(lesson.equipment, locale),
    },
    {
      icon: 'clock',
      label: 'MODE',
      value:
        lesson.coaching.mode === 'hold'
          ? 'Tahan posisi'
          : lesson.coaching.mode === 'repetition'
          ? 'Repetisi'
          : 'Belum dicantumkan',
    },
    { icon: 'clock', label: 'DURASI', value: duration },
    { icon: 'flame', label: 'HADIAH', value: `${lesson.xp} XP` },
  ];

  return (
    <View style={styles.screen}>
      <PageHeader
        eyebrow={`${lesson.trackTitle.toUpperCase()} · ${lesson.unitTitle.toUpperCase()}`}
        onBack={onBack}
        title={lesson.title}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 112 + Math.max(insets.bottom, spacing.lg) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ImageBackground
          imageStyle={styles.heroImage}
          source={require('../../assets/images/home-hero.jpg')}
          style={styles.hero}
        >
          <View style={styles.scrim} />
          <View
            style={[styles.supportBadge, { borderColor: supportCopy.color }]}
          >
            <Icon color={supportCopy.color} name={supportCopy.icon} size={16} />
            <Text
              style={[styles.supportBadgeText, { color: supportCopy.color }]}
            >
              {supportCopy.label}
            </Text>
          </View>
          <View>
            <Text style={styles.exerciseName}>{lesson.exerciseName}</Text>
            <Text style={styles.description}>
              {lesson.description || 'Ikuti target dengan ritme yang nyaman.'}
            </Text>
          </View>
        </ImageBackground>

        <View
          accessibilityLabel={`${supportCopy.title}. ${supportCopy.body}`}
          style={[
            styles.supportCard,
            { borderColor: `${supportCopy.color}66` },
          ]}
        >
          <View
            style={[
              styles.supportIcon,
              { backgroundColor: `${supportCopy.color}18` },
            ]}
          >
            <Icon color={supportCopy.color} name={supportCopy.icon} size={22} />
          </View>
          <View style={styles.supportCopy}>
            <Text style={[styles.supportTitle, { color: supportCopy.color }]}>
              {supportCopy.title}
            </Text>
            <Text style={styles.supportBody}>{supportCopy.body}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Detail pelajaran</Text>
        <View style={styles.detailsCard}>
          {details.map((detail, index) => (
            <View
              key={detail.label}
              style={[
                styles.detailRow,
                index < details.length - 1 && styles.detailRowBorder,
              ]}
            >
              <View style={styles.detailIcon}>
                <Icon color={colors.coral} name={detail.icon} size={19} />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>{detail.label}</Text>
                <Text style={styles.detailValue}>{detail.value}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.notice}>
          <Icon color={colors.amber} name="shield" size={20} />
          <Text style={styles.noticeText}>
            {lesson.access.launchAllowed && lesson.coaching.playable
              ? 'Nyeri bukan target latihan. Berhenti bila terasa nyeri atau tracking tidak yakin.'
              : lesson.access.reasons[0]?.message ??
                'Definisi gerakan atau target pelajaran belum siap.'}
          </Text>
        </View>
      </ScrollView>
      <SafeFooter>
        <PrimaryButton
          disabled={!canStart}
          label={buttonLabel(
            effectiveSupport,
            lesson.access.launchAllowed && lesson.coaching.playable,
          )}
          onPress={() => {
            if (startMode && canStart) {
              onStart(lesson, startMode);
            }
          }}
        />
      </SafeFooter>
    </View>
  );
}

export function resolveLessonSupportMode(
  lesson: CourseLesson,
  requested: LessonSupportMode,
): LessonSupportMode {
  if (!lesson.coaching.playable) return 'unavailable';
  if (requested === 'unavailable') return 'unavailable';
  if (lesson.coaching.scoringSupported) return 'posture-scored';
  return 'guided';
}

function buttonLabel(
  support: LessonSupportMode,
  launchAllowed: boolean,
): string {
  if (!launchAllowed) return 'Syarat pelajaran belum terpenuhi';
  if (support === 'posture-scored') return 'Lanjut ke kamera';
  if (support === 'guided') return 'Mulai panduan';
  return 'Mode latihan belum tersedia';
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  hero: {
    height: 292,
    justifyContent: 'space-between',
    overflow: 'hidden',
    padding: spacing.lg,
  },
  heroImage: { borderRadius: radius.card },
  scrim: {
    backgroundColor: 'rgba(13,11,11,.55)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  supportBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(13,11,11,.82)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  supportBadgeText: {
    ...type.micro,
    fontSize: 9,
    letterSpacing: 0.7,
  },
  exerciseName: { ...type.h1, color: colors.text, maxWidth: 280 },
  description: {
    ...type.support,
    color: colors.text,
    marginTop: spacing.xs,
    maxWidth: 290,
  },
  supportCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  supportIcon: {
    alignItems: 'center',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  supportCopy: { flex: 1 },
  supportTitle: { ...type.card, fontSize: 15 },
  supportBody: { ...type.support, color: colors.secondary, marginTop: 3 },
  sectionTitle: { ...type.section, color: colors.text, marginTop: spacing.xl },
  detailsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 64,
    paddingHorizontal: spacing.md,
  },
  detailRowBorder: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  detailIcon: {
    alignItems: 'center',
    backgroundColor: colors.raised,
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  detailCopy: { flex: 1 },
  detailLabel: {
    ...type.micro,
    color: colors.secondary,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  detailValue: { ...type.support, color: colors.text, marginTop: 1 },
  notice: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,180,84,.08)',
    borderColor: 'rgba(255,180,84,.28)',
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  noticeText: { ...type.support, color: colors.text, flex: 1 },
});
