import React from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, radius, spacing, type } from '../design/tokens';
import { BrandMark } from '../components/BrandMark';
import { Icon, IconName } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { SafeFooter } from '../components/SafeFooter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <ImageBackground
      source={require('../assets/images/onboarding-warrior.jpg')}
      style={styles.welcome}
    >
      <Svg height="100%" style={StyleSheet.absoluteFill} width="100%">
        <Defs>
          <LinearGradient id="welcome" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.canvas} stopOpacity=".45" />
            <Stop offset="38%" stopColor={colors.canvas} stopOpacity="0" />
            <Stop offset="72%" stopColor={colors.canvas} stopOpacity=".48" />
            <Stop offset="1" stopColor={colors.canvas} stopOpacity=".98" />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#welcome)" height="100%" width="100%" />
      </Svg>
      <View style={styles.welcomeTop}>
        <BrandMark light />
      </View>
      <View
        style={[
          styles.welcomeBottom,
          { paddingBottom: Math.max(insets.bottom + spacing.sm, spacing.xxl) },
        ]}
      >
        <View style={styles.heroTag}>
          <Icon color={colors.mint} name="shield" size={16} />
          <Text style={styles.heroTagText}>
            PELATIHAN PRIVAT DI PERANGKATMU
          </Text>
        </View>
        <Text style={styles.welcomeTitle}>
          Bergerak lebih baik.
          <Text style={styles.coral}> Sedikit demi sedikit.</Text>
        </Text>
        <Text style={styles.welcomeBody}>
          Jalur latihan personal dengan panduan postur real-time—tanpa mengirim
          video kameramu.
        </Text>
        <PrimaryButton label="Mulai perjalanan" onPress={onStart} />
        <Text style={styles.guidance}>
          Untuk panduan kebugaran dewasa, bukan diagnosis medis.
        </Text>
      </View>
    </ImageBackground>
  );
}

export function ConsentScreen({
  accepted,
  onToggle,
  onContinue,
  onBack,
}: {
  accepted: boolean;
  onToggle: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.screen}>
      <PageHeader
        eyebrow="SEBELUM KITA MULAI"
        onBack={onBack}
        step="01 / 05"
        title="Kendalimu tetap milikmu."
      />
      <ScrollView contentContainerStyle={styles.formContent}>
        <View style={styles.privacyCard}>
          <View style={styles.privacyIcon}>
            <Icon color={colors.mint} name="shield" size={28} />
          </View>
          <Text style={styles.cardTitle}>Video tidak meninggalkan ponsel</Text>
          <Text style={styles.cardBody}>
            Analisis postur berjalan di perangkat. Server hanya menerima
            ringkasan repetisi dan skor turunan.
          </Text>
        </View>
        {[
          ['camera', 'Kamera', 'Diperlukan hanya saat sesi coaching.'],
          ['chart', 'Progres', 'Skor bentuk, XP, dan penguasaan disimpan.'],
          ['shield', 'Batas aman', 'Laporkan nyeri dan hentikan kapan saja.'],
        ].map(([icon, title, body]) => (
          <View key={title} style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Icon color={colors.coral} name={icon as IconName} size={22} />
            </View>
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>{title}</Text>
              <Text style={styles.infoBody}>{body}</Text>
            </View>
          </View>
        ))}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
          onPress={onToggle}
          style={[styles.consentRow, accepted && styles.consentRowSelected]}
        >
          <View style={[styles.checkbox, accepted && styles.checkboxSelected]}>
            {accepted ? (
              <Icon color={colors.canvas} name="check" size={16} />
            ) : null}
          </View>
          <Text style={styles.consentText}>
            Saya berusia 18+ dan menyetujui pemrosesan data kebugaran sesuai
            penjelasan di atas.
          </Text>
        </Pressable>
        <Pressable accessibilityRole="link" style={styles.privacyLink}>
          <Text style={styles.privacyLinkText}>Baca Kebijakan Privasi</Text>
        </Pressable>
      </ScrollView>
      <SafeFooter>
        <PrimaryButton
          disabled={!accepted}
          label="Saya mengerti & setuju"
          onPress={onContinue}
        />
      </SafeFooter>
    </View>
  );
}

export type SetupStep = 'goal' | 'equipment' | 'limitations' | 'schedule';
const setup: Record<
  SetupStep,
  {
    step: string;
    eyebrow: string;
    title: string;
    body: string;
    options: Array<{ id: string; label: string; meta: string; icon: IconName }>;
  }
> = {
  goal: {
    step: '02 / 05',
    eyebrow: 'TUJUANMU',
    title: 'Apa yang ingin kamu bangun?',
    body: 'Pilih satu fokus utama. Kamu bisa mengubahnya nanti.',
    options: [
      {
        id: 'strength',
        label: 'Lebih kuat',
        meta: 'Fondasi & kekuatan tubuh',
        icon: 'spark',
      },
      {
        id: 'mobility',
        label: 'Lebih lentur',
        meta: 'Rentang gerak & kontrol',
        icon: 'chart',
      },
      {
        id: 'yoga',
        label: 'Yoga konsisten',
        meta: 'Keseimbangan & ketenangan',
        icon: 'shield',
      },
    ],
  },
  equipment: {
    step: '03 / 05',
    eyebrow: 'PERALATAN',
    title: 'Apa yang tersedia di rumah?',
    body: 'Pilih semua yang kamu punya.',
    options: [
      {
        id: 'none',
        label: 'Tanpa alat',
        meta: 'Cukup ruang 2 × 2 meter',
        icon: 'person',
      },
      {
        id: 'mat',
        label: 'Matras yoga',
        meta: 'Untuk lantai & pose',
        icon: 'learn',
      },
      {
        id: 'bench',
        label: 'Kursi kokoh',
        meta: 'Variasi push-up aman',
        icon: 'shield',
      },
    ],
  },
  limitations: {
    step: '04 / 05',
    eyebrow: 'BATAS GERAK',
    title: 'Ada hal yang perlu kami hindari?',
    body: 'Ini bukan diagnosis. Pilih yang relevan, termasuk “Tidak ada”.',
    options: [
      {
        id: 'knee',
        label: 'Lutut sensitif',
        meta: 'Tawarkan rentang lebih pendek',
        icon: 'shield',
      },
      {
        id: 'wrist',
        label: 'Pergelangan tangan',
        meta: 'Hindari beban berlebih',
        icon: 'shield',
      },
      {
        id: 'none',
        label: 'Tidak ada',
        meta: 'Saya siap melakukan asesmen',
        icon: 'check',
      },
    ],
  },
  schedule: {
    step: '05 / 05',
    eyebrow: 'RITME LATIHAN',
    title: 'Kapan latihan terasa realistis?',
    body: 'Konsistensi kecil lebih penting daripada volume.',
    options: [
      {
        id: '2',
        label: '2× seminggu',
        meta: 'Awal yang ringan',
        icon: 'clock',
      },
      {
        id: '3',
        label: '3× seminggu',
        meta: 'Pilihan seimbang',
        icon: 'flame',
      },
      {
        id: '4',
        label: '4× seminggu',
        meta: 'Untuk ritme aktif',
        icon: 'chart',
      },
    ],
  },
};

export function SetupScreen({
  kind,
  selected,
  onSelect,
  onContinue,
  onBack,
}: {
  kind: SetupStep;
  selected: string[];
  onSelect: (id: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const content = setup[kind];
  const singleChoice = kind === 'goal' || kind === 'schedule';
  return (
    <View style={styles.screen}>
      <PageHeader
        eyebrow={content.eyebrow}
        onBack={onBack}
        step={content.step}
        title={content.title}
      />
      <ScrollView contentContainerStyle={styles.formContent}>
        <Text style={styles.questionBody}>{content.body}</Text>
        <View
          accessibilityLabel={
            singleChoice ? 'Pilih satu opsi' : `${selected.length} opsi dipilih`
          }
          accessibilityRole={singleChoice ? 'radiogroup' : undefined}
          style={styles.options}
        >
          {content.options.map(option => {
            const active = selected.includes(option.id);
            return (
              <Pressable
                accessibilityRole={singleChoice ? 'radio' : 'checkbox'}
                accessibilityState={{ checked: active }}
                key={option.id}
                onPress={() => onSelect(option.id)}
                style={({ pressed }) => [
                  styles.option,
                  active && styles.optionActive,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[styles.optionIcon, active && styles.optionIconActive]}
                >
                  <Icon
                    color={active ? colors.canvas : colors.secondary}
                    name={option.icon}
                  />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionMeta}>{option.meta}</Text>
                </View>
                <View
                  style={[
                    styles.selectionDot,
                    active && styles.selectionDotActive,
                  ]}
                >
                  {active ? (
                    <Icon color={colors.canvas} name="check" size={14} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <SafeFooter>
        <PrimaryButton
          disabled={selected.length === 0}
          label={kind === 'schedule' ? 'Lanjut ke asesmen' : 'Lanjut'}
          onPress={onContinue}
        />
      </SafeFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  welcome: {
    backgroundColor: colors.canvas,
    flex: 1,
    justifyContent: 'space-between',
  },
  welcomeTop: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxl },
  welcomeBottom: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  heroTag: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(13,11,11,.72)',
    borderColor: 'rgba(102,221,177,.35)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  heroTagText: {
    ...type.micro,
    color: colors.text,
    fontSize: 10,
    letterSpacing: 0.7,
  },
  welcomeTitle: {
    ...type.display,
    color: colors.text,
    letterSpacing: -1,
    maxWidth: 360,
  },
  coral: { color: colors.coral },
  welcomeBody: { ...type.body, color: colors.secondary, maxWidth: 350 },
  guidance: { ...type.support, color: colors.secondary, textAlign: 'center' },
  formContent: { padding: spacing.lg, paddingBottom: 144 },
  privacyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.md,
  },
  privacyIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(102,221,177,.12)',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    width: 44,
  },
  cardTitle: { ...type.card, color: colors.text },
  cardBody: { ...type.support, color: colors.secondary, marginTop: spacing.xs },
  infoRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  infoIcon: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  infoCopy: { flex: 1 },
  infoTitle: { ...type.card, color: colors.text, fontSize: 15 },
  infoBody: { ...type.support, color: colors.secondary, marginTop: 2 },
  consentRow: {
    alignItems: 'flex-start',
    backgroundColor: colors.raised,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.md,
  },
  consentRowSelected: { borderColor: colors.coral },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.muted,
    borderRadius: 6,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxSelected: {
    backgroundColor: colors.coral,
    borderColor: colors.coral,
  },
  consentText: { ...type.support, color: colors.text, flex: 1 },
  privacyLink: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  privacyLinkText: {
    ...type.support,
    color: colors.text,
    textDecorationLine: 'underline',
  },
  questionBody: {
    ...type.body,
    color: colors.secondary,
    marginBottom: spacing.xl,
  },
  options: { gap: spacing.sm },
  option: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 82,
    padding: spacing.md,
  },
  optionActive: {
    backgroundColor: 'rgba(255,90,107,.08)',
    borderColor: colors.coral,
  },
  pressed: { opacity: 0.75 },
  optionIcon: {
    alignItems: 'center',
    backgroundColor: colors.raised,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  optionIconActive: { backgroundColor: colors.coral },
  optionCopy: { flex: 1 },
  optionLabel: { ...type.card, color: colors.text },
  optionMeta: { ...type.support, color: colors.secondary, marginTop: 2 },
  selectionDot: {
    alignItems: 'center',
    borderColor: colors.muted,
    borderRadius: 11,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  selectionDotActive: {
    backgroundColor: colors.coral,
    borderColor: colors.coral,
  },
});
