import React from 'react';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing, type } from '../design/tokens';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { SafeFooter } from '../components/SafeFooter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function LessonPreviewScreen({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <PageHeader
        eyebrow="PELAJARAN 02 · FONDASI"
        onBack={onBack}
        title="Kuasai squat-mu."
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 112 + Math.max(insets.bottom, spacing.lg) },
        ]}
      >
        <ImageBackground
          source={require('../assets/images/home-hero.jpg')}
          imageStyle={styles.lessonImage}
          style={styles.lessonHero}
        >
          <View style={styles.lessonScrim} />
          <View style={styles.lessonPill}>
            <Icon color={colors.mint} name="clock" size={17} />
            <Text style={styles.lessonPillText}>8 MENIT</Text>
          </View>
          <View>
            <Text style={styles.lessonHeroTitle}>
              Kontrol lebih dulu.
              <Text style={{ color: colors.coral }}> Kedalaman mengikuti.</Text>
            </Text>
            <Text style={styles.lessonHeroBody}>
              Dua set ringan untuk membangun pijakan dan ritme.
            </Text>
          </View>
        </ImageBackground>
        <View style={styles.lessonStats}>
          {[
            ['8', 'REPETISI'],
            ['2', 'SET'],
            ['0', 'ALAT'],
          ].map(([value, label]) => (
            <View key={label} style={styles.lessonStat}>
              <Text style={styles.lessonStatValue}>{value}</Text>
              <Text style={styles.lessonStatLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.sectionTitle}>Fokus sesi</Text>
        {[
          'Kaki tetap menapak',
          'Lutut mengikuti arah jari kaki',
          'Tempo stabil, tanpa terburu-buru',
        ].map((item, index) => (
          <View key={item} style={styles.focusRow}>
            <View style={styles.focusCheck}>
              <Icon color={colors.canvas} name="check" size={14} />
            </View>
            <Text style={styles.focusText}>{item}</Text>
            <Text style={styles.focusIndex}>0{index + 1}</Text>
          </View>
        ))}
        <View style={styles.notice}>
          <Icon color={colors.amber} name="shield" size={20} />
          <Text style={styles.noticeText}>
            Nyeri bukan target latihan. Berhenti dan pilih variasi lebih aman
            bila perlu.
          </Text>
        </View>
      </ScrollView>
      <SafeFooter>
        <PrimaryButton label="Lanjut ke kamera" onPress={onContinue} />
      </SafeFooter>
    </View>
  );
}

export function AssessmentIntroScreen({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <PageHeader
        eyebrow="ASESMEN GERAK"
        onBack={onBack}
        title="Kenali titik awalmu."
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 112 + Math.max(insets.bottom, spacing.lg) },
        ]}
      >
        <Text style={styles.lead}>
          Tiga menit untuk menyesuaikan jalur latihan dengan cara tubuhmu
          bergerak hari ini.
        </Text>
        <View style={styles.scoreCard}>
          <View style={styles.orbit}>
            <View style={styles.orbitCore}>
              <Text style={styles.orbitValue}>3</Text>
              <Text style={styles.orbitUnit}>MENIT</Text>
            </View>
          </View>
          <View style={styles.scoreCopy}>
            <Text style={styles.cardTitle}>Bukan tes kelulusan.</Text>
            <Text style={styles.cardBody}>
              Kami melihat kontrol, rentang gerak, dan keyakinan tracking—bukan
              bentuk tubuhmu.
            </Text>
          </View>
        </View>
        {[
          [
            'camera',
            'Kamera setinggi pinggul',
            'Seluruh tubuh harus terlihat.',
          ],
          ['person', 'Squat tubuh bebas', 'Lakukan 3 repetisi nyaman.'],
          ['shield', 'Kamu pegang kendali', 'Berhenti jika terasa nyeri.'],
        ].map(([icon, title, body], index) => (
          <View key={title} style={styles.stepRow}>
            <Text style={styles.stepNumber}>0{index + 1}</Text>
            <View style={styles.stepIcon}>
              <Icon
                color={index === 2 ? colors.mint : colors.coral}
                name={icon as 'camera' | 'person' | 'shield'}
                size={22}
              />
            </View>
            <View style={styles.stepCopy}>
              <Text style={styles.stepTitle}>{title}</Text>
              <Text style={styles.stepBody}>{body}</Text>
            </View>
          </View>
        ))}
        <View style={styles.notice}>
          <Icon color={colors.amber} name="shield" size={20} />
          <Text style={styles.noticeText}>
            Jika tracking tidak yakin, kami tidak memberi skor. Tidak ada
            tebakan.
          </Text>
        </View>
      </ScrollView>
      <SafeFooter>
        <PrimaryButton label="Siapkan kamera" onPress={onContinue} />
      </SafeFooter>
    </View>
  );
}

export function SafeVariationScreen({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <PageHeader
        eyebrow="VARIASI AMAN"
        onBack={onBack}
        title="Kurangi beban gerak."
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 112 + Math.max(insets.bottom, spacing.lg) },
        ]}
      >
        <View style={styles.safeStopCard}>
          <Icon color={colors.amber} name="shield" size={24} />
          <View style={styles.safeStopCopy}>
            <Text style={styles.safeStopTitle}>Jangan lanjutkan hari ini.</Text>
            <Text style={styles.cardBody}>
              Nyeri menghentikan progresi. Istirahat dan jangan memaksakan
              rentang gerak.
            </Text>
          </View>
        </View>
        <Text style={styles.sectionTitle}>Untuk sesi berikutnya</Text>
        <View style={styles.safeOptionCard}>
          <View style={styles.safeOptionTop}>
            <View style={styles.safeOptionIcon}>
              <Icon color={colors.mint} name="person" size={24} />
            </View>
            <View style={styles.safeOptionCopy}>
              <Text style={styles.safeOptionEyebrow}>VARIASI DISARANKAN</Text>
              <Text style={styles.cardTitle}>Squat dibantu kursi</Text>
            </View>
          </View>
          <Text style={styles.safeOptionBody}>
            Gunakan kursi stabil sebagai batas kedalaman. Mulai hanya saat
            bergerak tanpa nyeri, dengan rentang yang nyaman.
          </Text>
          {[
            'Kursi tidak bergeser dan berada di belakangmu',
            'Turun perlahan sampai menyentuh kursi',
            'Hentikan segera bila nyeri kembali',
          ].map(item => (
            <View key={item} style={styles.safeCheckRow}>
              <Icon color={colors.mint} name="check" size={16} />
              <Text style={styles.safeCheckText}>{item}</Text>
            </View>
          ))}
        </View>
        <View style={styles.notice}>
          <Icon color={colors.amber} name="shield" size={20} />
          <Text style={styles.noticeText}>
            Jika nyeri menetap, memburuk, atau mengganggu aktivitas, cari
            bantuan tenaga kesehatan. PocketTrainer tidak memberi diagnosis.
          </Text>
        </View>
      </ScrollView>
      <SafeFooter>
        <PrimaryButton label="Kembali ke beranda" onPress={onDone} />
      </SafeFooter>
    </View>
  );
}

export function CameraSetupScreen({
  onBack,
  onReady,
}: {
  onBack: () => void;
  onReady: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <PageHeader
        eyebrow="PENEMPATAN KAMERA"
        onBack={onBack}
        step="KALIBRASI"
        title="Beri ruang untuk bergerak."
      />
      <View style={styles.previewWrap}>
        <ImageBackground
          source={require('../assets/images/calibration-standing.jpg')}
          imageStyle={styles.previewImage}
          resizeMode="contain"
          style={styles.preview}
        >
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <View style={styles.previewBadge}>
            <View style={styles.pulse} />
            <Text style={styles.previewBadgeText}>
              JARAK 2–3 M · TUBUH PENUH
            </Text>
          </View>
        </ImageBackground>
      </View>
      <View
        style={[
          styles.setupPanel,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) },
        ]}
      >
        <View style={styles.setupRow}>
          <View style={styles.setupNumber}>
            <Text style={styles.setupNumberText}>1</Text>
          </View>
          <Text style={styles.setupText}>
            Sandarkan ponsel setinggi pinggul, mode potret.
          </Text>
        </View>
        <View style={styles.setupRow}>
          <View style={styles.setupNumber}>
            <Text style={styles.setupNumberText}>2</Text>
          </View>
          <Text style={styles.setupText}>
            Berdiri 2–3 meter dari ponsel. Mundur perlahan sampai kepala,
            tangan, dan kedua kaki terlihat.
          </Text>
        </View>
        <View style={styles.safetyRow}>
          <Icon color={colors.danger} name="stop" size={18} />
          <Text style={styles.safetyText}>
            Tekan tombol merah “Stop” kapan saja untuk mengakhiri sesi.
          </Text>
        </View>
        <PrimaryButton label="Mulai kalibrasi" onPress={onReady} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  lessonHero: {
    height: 300,
    justifyContent: 'space-between',
    overflow: 'hidden',
    padding: spacing.lg,
  },
  lessonImage: { borderRadius: radius.card },
  lessonScrim: {
    backgroundColor: 'rgba(13,11,11,.45)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  lessonPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(13,11,11,.78)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  lessonPillText: { ...type.micro, color: colors.text, letterSpacing: 0.7 },
  lessonHeroTitle: { ...type.h1, color: colors.text, maxWidth: 280 },
  lessonHeroBody: {
    ...type.support,
    color: colors.text,
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  lessonStats: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
  },
  lessonStat: {
    alignItems: 'center',
    borderRightColor: colors.border,
    borderRightWidth: 1,
    flex: 1,
  },
  lessonStatValue: {
    ...type.section,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  lessonStatLabel: { ...type.micro, color: colors.secondary, fontSize: 9 },
  sectionTitle: { ...type.section, color: colors.text, marginTop: spacing.xl },
  focusRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 54,
  },
  focusCheck: {
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderRadius: 10,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  focusText: { ...type.support, color: colors.text, flex: 1 },
  focusIndex: { ...type.micro, color: colors.muted },
  lead: { ...type.body, color: colors.secondary },
  scoreCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  orbit: {
    alignItems: 'center',
    borderColor: 'rgba(255,90,107,.28)',
    borderRadius: 42,
    borderWidth: 8,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  orbitCore: { alignItems: 'center' },
  orbitValue: {
    fontFamily: type.display.fontFamily,
    fontSize: 30,
    fontWeight: '700',
    color: colors.text,
  },
  orbitUnit: { ...type.micro, color: colors.coral, fontSize: 9 },
  scoreCopy: { flex: 1 },
  cardTitle: { ...type.card, color: colors.text },
  cardBody: { ...type.support, color: colors.secondary, marginTop: spacing.xs },
  stepRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  stepNumber: { ...type.micro, color: colors.muted, width: 22 },
  stepIcon: {
    alignItems: 'center',
    backgroundColor: colors.raised,
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  stepCopy: { flex: 1 },
  stepTitle: { ...type.card, color: colors.text, fontSize: 15 },
  stepBody: { ...type.support, color: colors.secondary, marginTop: 2 },
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
  safeStopCard: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,180,84,.08)',
    borderColor: 'rgba(255,180,84,.35)',
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  safeStopCopy: { flex: 1 },
  safeStopTitle: { ...type.card, color: colors.amber },
  safeOptionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: spacing.sm,
    padding: spacing.lg,
  },
  safeOptionTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  safeOptionIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(102,221,177,.12)',
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  safeOptionCopy: { flex: 1 },
  safeOptionEyebrow: {
    ...type.micro,
    color: colors.mint,
    letterSpacing: 0.7,
  },
  safeOptionBody: {
    ...type.support,
    color: colors.secondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  safeCheckRow: {
    alignItems: 'flex-start',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  safeCheckText: { ...type.support, color: colors.text, flex: 1 },
  previewWrap: { flex: 1, padding: spacing.lg },
  preview: {
    backgroundColor: colors.raised,
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  previewImage: { borderRadius: radius.card },
  frame: {
    alignSelf: 'center',
    height: '76%',
    marginTop: spacing.lg,
    position: 'relative',
    width: '68%',
  },
  corner: {
    borderColor: colors.mint,
    height: 34,
    position: 'absolute',
    width: 34,
  },
  tl: { borderLeftWidth: 3, borderTopWidth: 3, left: 0, top: 0 },
  tr: { borderRightWidth: 3, borderTopWidth: 3, right: 0, top: 0 },
  bl: { borderBottomWidth: 3, borderLeftWidth: 3, bottom: 0, left: 0 },
  br: { borderBottomWidth: 3, borderRightWidth: 3, bottom: 0, right: 0 },
  previewBadge: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(13,11,11,.82)',
    borderColor: 'rgba(102,221,177,.4)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  pulse: { backgroundColor: colors.mint, borderRadius: 4, height: 8, width: 8 },
  previewBadgeText: { ...type.micro, color: colors.text, letterSpacing: 0.7 },
  setupPanel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: spacing.md,
    padding: spacing.lg,
  },
  setupRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  setupNumber: {
    alignItems: 'center',
    backgroundColor: colors.raised,
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  setupNumberText: { ...type.support, color: colors.coral, fontWeight: '800' },
  setupText: { ...type.support, color: colors.text, flex: 1 },
  safetyRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,91,82,.08)',
    borderRadius: radius.control,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  safetyText: { ...type.micro, color: colors.secondary, flex: 1 },
});
