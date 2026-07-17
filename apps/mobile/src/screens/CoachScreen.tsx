import React from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing, type } from '../design/tokens';
import { Icon, IconName } from '../components/Icon';
import { PrimaryButton } from '../components/PrimaryButton';

type Props = {
  onAssessment: () => void;
  onWorkout: () => void;
  onFoodScan?: () => void;
  onNutritionDiary?: () => void;
};
export function CoachScreen({
  onAssessment,
  onWorkout,
  onFoodScan,
  onNutritionDiary,
}: Props) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>PELATIH SAKU</Text>
          <Text style={styles.title}>Siap bergerak?</Text>
        </View>
        <View style={styles.privacy}>
          <Icon color={colors.mint} name="shield" size={19} />
          <Text style={styles.privacyText}>ON-DEVICE</Text>
        </View>
      </View>
      <ImageBackground
        imageStyle={styles.heroImage}
        source={require('../assets/images/home-hero.jpg')}
        style={styles.hero}
      >
        <View style={styles.scrim} />
        <View style={styles.heroTop}>
          <View style={styles.live}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>REKOMENDASI HARI INI</Text>
          </View>
          <Text style={styles.heroTitle}>Kuasai squat-mu.</Text>
          <Text style={styles.heroMeta}>8 menit · 2 set · Tanpa alat</Text>
        </View>
        <PrimaryButton label="Siapkan kamera" onPress={onWorkout} />
      </ImageBackground>
      <Text style={styles.section}>Pilih mode</Text>
      <View style={styles.options}>
        {[
          {
            icon: 'spark',
            title: 'Latihan cepat',
            body: 'Pilih satu gerakan untuk melatih bentuk.',
            tag: 'PRAKTIK',
          },
          {
            icon: 'camera',
            title: 'Asesmen gerak',
            body: 'Perbarui kemampuan dan jalur personalmu.',
            tag: '3 MENIT',
          },
          ...(onFoodScan
            ? [
                {
                  icon: 'camera',
                  title: 'Scan makanan',
                  body: 'Pindai barcode atau masukkan label nutrisi.',
                  tag: 'NUTRISI',
                },
              ]
            : []),
          ...(onNutritionDiary
            ? [
                {
                  icon: 'chart',
                  title: 'Jurnal nutrisi',
                  body: 'Lihat ringkasan kalori dan makro hari ini.',
                  tag: 'HARI INI',
                },
              ]
            : []),
        ].map((item, index) => (
          <Pressable
            key={item.title}
            onPress={() => {
              if (item.title === 'Asesmen gerak') return onAssessment();
              if (item.title === 'Scan makanan') return onFoodScan?.();
              if (item.title === 'Jurnal nutrisi') return onNutritionDiary?.();
              return onWorkout();
            }}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
          >
            <View style={styles.optionIcon}>
              <Icon
                color={index === 0 ? colors.violet : colors.mint}
                name={item.icon as IconName}
              />
            </View>
            <View style={styles.optionCopy}>
              <View style={styles.optionTitleRow}>
                <Text style={styles.optionTitle}>{item.title}</Text>
                <Text style={styles.optionTag}>{item.tag}</Text>
              </View>
              <Text style={styles.optionBody}>{item.body}</Text>
            </View>
            <Icon color={colors.muted} name="chevron" size={20} />
          </Pressable>
        ))}
      </View>
      <View style={styles.safety}>
        <Icon color={colors.amber} name="shield" size={20} />
        <Text style={styles.safetyText}>
          Pastikan area 2 × 2 meter kosong. Hentikan sesi jika terasa nyeri.
        </Text>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
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
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  privacyText: {
    ...type.micro,
    color: colors.mint,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  hero: {
    height: 330,
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  heroImage: { borderRadius: radius.card },
  scrim: {
    backgroundColor: 'rgba(13,11,11,.45)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  heroTop: { maxWidth: 250 },
  live: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(13,11,11,.8)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
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
  heroMeta: { ...type.support, color: colors.text, marginTop: spacing.xs },
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
    minHeight: 86,
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
