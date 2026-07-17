import React from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { WorkoutPlan } from '../api';
import { Icon, type IconName } from '../components/Icon';
import { PrimaryButton } from '../components/PrimaryButton';
import { formatEquipment, formatLessonTarget } from '../course/catalogAdapter';
import type { CourseLesson } from '../course/types';
import { colors, radius, spacing, type } from '../design/tokens';

export type CoachScreenProps = Readonly<{
  currentPlan?: WorkoutPlan | null;
  recommendedLesson?: CourseLesson | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onAssessment: () => void;
  onWorkout: (lesson?: CourseLesson) => void;
  onFoodScan?: () => void;
  onNutritionDiary?: () => void;
}>;

export function CoachScreen({
  currentPlan,
  recommendedLesson,
  loading = false,
  error = null,
  onRetry,
  onAssessment,
  onWorkout,
  onFoodScan,
  onNutritionDiary,
}: CoachScreenProps) {
  const recommendation = resolveRecommendation(recommendedLesson);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>PELATIH SAKU</Text>
          <Text style={styles.title}>Siap bergerak?</Text>
        </View>
        <View style={styles.privacy}>
          <Icon color={colors.mint} name="shield" size={19} />
          <Text style={styles.privacyText}>KAMERA LOKAL</Text>
        </View>
      </View>

      <ImageBackground
        imageStyle={styles.heroImage}
        source={require('../assets/images/home-hero.jpg')}
        style={styles.hero}
      >
        <View style={styles.scrim} />
        {loading ? (
          <View accessibilityRole="progressbar" style={styles.heroState}>
            <ActivityIndicator color={colors.coral} size="large" />
            <Text style={styles.stateTitle}>Memuat rencana server…</Text>
            <Text style={styles.stateBody}>
              Rekomendasi tidak ditebak dari data lokal.
            </Text>
          </View>
        ) : error ? (
          <View style={styles.heroState}>
            <View style={styles.stateIcon}>
              <Icon color={colors.amber} name="shield" size={24} />
            </View>
            <Text style={styles.stateTitle}>Rencana belum dapat dimuat.</Text>
            <Text style={styles.stateBody}>{error}</Text>
            {onRetry ? (
              <PrimaryButton
                label="Coba lagi"
                onPress={onRetry}
                style={styles.heroButton}
                tone="light"
              />
            ) : null}
          </View>
        ) : recommendation ? (
          <View style={styles.heroRecommendation}>
            <View style={styles.heroTop}>
              <View style={styles.live}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>REKOMENDASI SERVER</Text>
              </View>
              <Text style={styles.heroTitle}>{recommendation.title}</Text>
              <Text style={styles.heroDescription} numberOfLines={3}>
                {recommendedLesson?.description}
              </Text>
            </View>
            <View>
              <View style={styles.metrics}>
                {recommendation.metrics.map(metric => (
                  <View key={metric.label} style={styles.metric}>
                    <Text style={styles.metricLabel}>{metric.label}</Text>
                    <Text style={styles.metricValue}>{metric.value}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.modeNotice}>
                <Icon
                  color={
                    recommendation.scoringSupported ? colors.mint : colors.amber
                  }
                  name={recommendation.scoringSupported ? 'check' : 'shield'}
                  size={17}
                />
                <Text style={styles.modeNoticeText}>
                  {recommendation.modeLabel}
                </Text>
              </View>
              <PrimaryButton
                label={
                  !recommendation.launchAllowed
                    ? 'Lesson belum dapat diluncurkan'
                    : recommendation.scoringSupported
                    ? 'Mulai coaching squat'
                    : 'Mulai praktik terpandu'
                }
                disabled={!recommendation.launchAllowed}
                onPress={() => onWorkout(recommendedLesson ?? undefined)}
              />
            </View>
          </View>
        ) : currentPlan ? (
          <View style={styles.heroState}>
            <View style={styles.stateIcon}>
              <Icon color={colors.mint} name="check" size={24} />
            </View>
            <Text style={styles.stateTitle}>Rencana aktif ditemukan.</Text>
            <Text style={styles.stateBody}>
              Detail lesson belum tersedia dari catalog. Muat ulang sebelum
              memulai agar target tidak dibuat-buat.
            </Text>
            {onRetry ? (
              <PrimaryButton
                label="Muat ulang catalog"
                onPress={onRetry}
                style={styles.heroButton}
                tone="light"
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.heroState}>
            <View style={styles.stateIcon}>
              <Icon color={colors.coral} name="person" size={25} />
            </View>
            <Text style={styles.stateTitle}>Belum ada rencana aktif.</Text>
            <Text style={styles.stateBody}>
              Lakukan asesmen squat tiga repetisi. Server akan menentukan
              rekomendasi tanpa meminta kamu memilih level sendiri.
            </Text>
            <PrimaryButton
              label="Mulai asesmen 3 repetisi"
              onPress={onAssessment}
              style={styles.heroButton}
              tone="light"
            />
          </View>
        )}
      </ImageBackground>

      <Text style={styles.section}>Pilih mode</Text>
      <View style={styles.options}>
        <CoachOption
          body="Pilih lesson tersedia dari catalog; mode scoring mengikuti dukungan gerakan."
          icon="spark"
          onPress={() => onWorkout()}
          tag="CATALOG"
          title="Latihan cepat"
          tone="violet"
        />
        <CoachOption
          body="Ukur kontrol tubuh bawah dari tiga squat dengan tracking yang memenuhi syarat."
          icon="camera"
          onPress={onAssessment}
          tag="3 REP"
          title="Asesmen gerak"
          tone="mint"
        />
        {onFoodScan ? (
          <CoachOption
            body="Pindai barcode atau masukkan label nutrisi untuk ditinjau."
            icon="camera"
            onPress={onFoodScan}
            tag="NUTRISI"
            title="Scan makanan"
            tone="mint"
          />
        ) : null}
        {onNutritionDiary ? (
          <CoachOption
            body="Lihat entri dan total nutrisi yang sudah dikonfirmasi server."
            icon="chart"
            onPress={onNutritionDiary}
            tag="HARI INI"
            title="Jurnal nutrisi"
            tone="mint"
          />
        ) : null}
      </View>
      <View style={styles.safety}>
        <Icon color={colors.amber} name="shield" size={20} />
        <Text style={styles.safetyText}>
          Pastikan area 2 × 2 meter kosong. Tracking rendah tidak menghasilkan
          skor, dan nyeri menghentikan progresi.
        </Text>
      </View>
    </ScrollView>
  );
}

function CoachOption({
  body,
  icon,
  onPress,
  tag,
  title,
  tone,
}: Readonly<{
  body: string;
  icon: IconName;
  onPress: () => void;
  tag: string;
  title: string;
  tone: 'mint' | 'violet';
}>) {
  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && styles.pressed]}
    >
      <View style={styles.optionIcon}>
        <Icon
          color={tone === 'violet' ? colors.violet : colors.mint}
          name={icon}
        />
      </View>
      <View style={styles.optionCopy}>
        <View style={styles.optionTitleRow}>
          <Text style={styles.optionTitle}>{title}</Text>
          <Text style={styles.optionTag}>{tag}</Text>
        </View>
        <Text style={styles.optionBody}>{body}</Text>
      </View>
      <Icon color={colors.muted} name="chevron" size={20} />
    </Pressable>
  );
}

function resolveRecommendation(lesson: CourseLesson | null | undefined) {
  if (!lesson) return null;
  const duration =
    lesson.durationMinutes === null
      ? 'Durasi belum tersedia'
      : `${lesson.durationMinutes} menit`;
  const equipment = formatEquipment(lesson.equipment);
  const scoringSupported =
    lesson.exerciseKey === 'body_squat' && lesson.coaching.scoringSupported;
  const launchAllowed = lesson.access.launchAllowed && lesson.coaching.playable;

  return {
    title: lesson.title,
    launchAllowed,
    scoringSupported,
    modeLabel: !launchAllowed
      ? 'Syarat level atau mastery belum terpenuhi; lesson tidak dapat dimulai.'
      : scoringSupported
      ? 'Squat dinilai hanya saat tracking memenuhi syarat.'
      : 'Praktik terpandu — tanpa skor form, mastery, atau unlock.',
    metrics: [
      { label: 'TARGET', value: formatLessonTarget(lesson.target) },
      { label: 'DURASI', value: duration },
      { label: 'ALAT', value: equipment },
    ],
  } as const;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerCopy: { flex: 1, paddingRight: spacing.sm },
  eyebrow: { ...type.micro, color: colors.coral, letterSpacing: 1 },
  title: { ...type.h1, color: colors.text, marginTop: 3 },
  privacy: {
    alignItems: 'center',
    backgroundColor: 'rgba(102,221,177,.08)',
    borderColor: 'rgba(102,221,177,.25)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  privacyText: {
    ...type.micro,
    color: colors.mint,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  hero: {
    minHeight: 420,
    marginTop: spacing.xl,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  heroImage: { borderRadius: radius.card },
  scrim: {
    backgroundColor: 'rgba(13,11,11,.72)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  heroRecommendation: { flex: 1, justifyContent: 'space-between' },
  heroTop: { maxWidth: 290 },
  live: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(13,11,11,.84)',
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
  },
  liveDot: {
    backgroundColor: colors.coral,
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  liveText: {
    ...type.micro,
    color: colors.text,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  heroTitle: { ...type.h1, color: colors.text, marginTop: spacing.lg },
  heroDescription: {
    ...type.support,
    color: colors.text,
    marginTop: spacing.xs,
  },
  heroState: {
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'center',
  },
  stateIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(13,11,11,.72)',
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  stateTitle: { ...type.section, color: colors.text, marginTop: spacing.md },
  stateBody: {
    ...type.body,
    color: colors.secondary,
    marginTop: spacing.xs,
    maxWidth: 310,
  },
  heroButton: { marginTop: spacing.lg, width: '100%' },
  metrics: {
    backgroundColor: 'rgba(13,11,11,.78)',
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.sm,
    padding: spacing.sm,
  },
  metric: { flex: 1, paddingHorizontal: spacing.xxs },
  metricLabel: { ...type.micro, color: colors.muted, fontSize: 9 },
  metricValue: {
    ...type.micro,
    color: colors.text,
    marginTop: spacing.xxs,
  },
  modeNotice: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  modeNoticeText: { ...type.micro, color: colors.text, flex: 1 },
  section: { ...type.section, color: colors.text, marginTop: spacing.xl },
  options: { gap: spacing.sm, marginTop: spacing.sm },
  option: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 96,
    padding: spacing.md,
  },
  pressed: { opacity: 0.72 },
  optionIcon: {
    alignItems: 'center',
    backgroundColor: colors.raised,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  optionCopy: { flex: 1 },
  optionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  optionTitle: { ...type.card, color: colors.text, fontSize: 15 },
  optionTag: { ...type.micro, color: colors.coral, fontSize: 9 },
  optionBody: { ...type.support, color: colors.secondary, marginTop: 3 },
  safety: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  safetyText: { ...type.micro, color: colors.secondary, flex: 1 },
});
