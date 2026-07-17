import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import {
  generateFoodCandidates,
  generateFoodCandidatesFromImage,
  type FoodCandidateSuggestion,
} from '../../api';
import { colors, radius, spacing, type } from '../../design/tokens';
import {
  emptyNutritionNutrients,
  type FoodCandidateReview,
  type FoodCandidateReviewResponse,
  type ManualLabelInput,
} from '../components/types';
import {
  getFoodScannerCapability,
  normalizeFoodBarcode,
  startFoodScanner,
  type FoodScannerCapability,
  type FoodScanResult,
} from '../native/foodScanner';
import {
  captureFoodImage,
  getFoodImagePickerCapability,
  pickFoodImage,
  type FoodImageAsset,
  type FoodImagePickerCapability,
} from '../native/foodImagePicker';

type ScanMode = 'barcode' | 'label';

export type ScanFoodScreenProps = Readonly<{
  onBack?: () => void;
  onOpenDiary?: () => void;
  onSubmitBarcode: (barcode: string) => void;
  onSubmitManualLabel: (input: ManualLabelInput) => void;
  onRequestLabelCandidates?: (
    label: string,
  ) => Promise<FoodCandidateReviewResponse>;
  onRequestImageCandidates?: (
    image: FoodImageAsset,
  ) => Promise<FoodCandidateReviewResponse>;
  scannerCapability?: FoodScannerCapability;
  onStartScanner?: () => Promise<FoodScanResult>;
  imagePickerCapability?: FoodImagePickerCapability;
  onPickFoodImage?: () => Promise<FoodImageAsset | null>;
  onCaptureFoodImage?: () => Promise<FoodImageAsset | null>;
}>;

function parseNumber(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toReviewCandidate({
  barcode,
  brand,
  name,
  nutritionPerServing,
  serving,
}: FoodCandidateSuggestion): FoodCandidateReview {
  return {
    barcode: barcode ?? undefined,
    brand: brand ?? undefined,
    foodName: name,
    nutrients: {
      calories: nutritionPerServing.caloriesKcal,
      carbohydrateGrams: nutritionPerServing.carbohydrateG,
      fatGrams: nutritionPerServing.fatG,
      fiberGrams: nutritionPerServing.fiberG,
      proteinGrams: nutritionPerServing.proteinG,
      sodiumMilligrams: nutritionPerServing.sodiumMg,
      sugarGrams: nutritionPerServing.sugarG,
    },
    servingLabel: serving.label ?? `${serving.amount} ${serving.unit}`,
  };
}

function requestCandidatesFromApi(
  label: string,
): Promise<FoodCandidateReviewResponse> {
  return generateFoodCandidates({ label }).then(response => ({
    candidates: response.candidates.map(toReviewCandidate),
    warning: response.warning,
  }));
}

function requestImageCandidatesFromApi(
  image: FoodImageAsset,
): Promise<FoodCandidateReviewResponse> {
  return generateFoodCandidatesFromImage(image).then(response => ({
    candidates: response.candidates.map(toReviewCandidate),
    warning: response.warning,
  }));
}

function inputNumber(value: number | null): string {
  return value === null ? '' : String(value);
}

function formatCandidateNutrients(candidate: FoodCandidateReview): string {
  const calories = candidate.nutrients.calories ?? '—';
  const protein = candidate.nutrients.proteinGrams ?? '—';
  return `${calories} kkal · protein ${protein} g per porsi`;
}

export function ScanFoodScreen({
  onBack,
  onOpenDiary,
  onSubmitBarcode,
  onSubmitManualLabel,
  onRequestLabelCandidates = requestCandidatesFromApi,
  onRequestImageCandidates = requestImageCandidatesFromApi,
  scannerCapability = getFoodScannerCapability(),
  onStartScanner = startFoodScanner,
  imagePickerCapability = getFoodImagePickerCapability(),
  onPickFoodImage = pickFoodImage,
  onCaptureFoodImage = captureFoodImage,
}: ScanFoodScreenProps) {
  const [mode, setMode] = useState<ScanMode>('barcode');
  const [barcode, setBarcode] = useState('');
  const [foodName, setFoodName] = useState('');
  const [servingLabel, setServingLabel] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [labelError, setLabelError] = useState('');
  const [candidateResult, setCandidateResult] =
    useState<FoodCandidateReviewResponse | null>(null);
  const [candidateError, setCandidateError] = useState('');
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateSource, setCandidateSource] = useState<'label' | 'image'>('label');
  const [scannerLoading, setScannerLoading] = useState(false);
  const [scannerMessage, setScannerMessage] = useState('');
  const [scannerMessageTone, setScannerMessageTone] = useState<'info' | 'error'>('info');
  const lastScannedBarcode = React.useRef<{ barcode: string; at: number } | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const numberFields = useMemo(
    () =>
      [
        ['calories', 'Kalori (kkal)'],
        ['proteinGrams', 'Protein (g)'],
        ['carbohydrateGrams', 'Karbohidrat (g)'],
        ['fatGrams', 'Lemak (g)'],
        ['fiberGrams', 'Serat (g)'],
        ['sodiumMilligrams', 'Natrium (mg)'],
        ['sugarGrams', 'Gula (g)'],
      ] as const,
    [],
  );

  const submitLabel = () => {
    if (!foodName.trim() || !servingLabel.trim()) {
      setLabelError('Nama makanan dan ukuran porsi wajib diisi.');
      return;
    }
    const parsedValues = numberFields.map(
      ([key]) => [key, parseNumber(numbers[key] ?? '')] as const,
    );
    const hasInvalidValue = numberFields.some(
      ([key]) =>
        Boolean(numbers[key]?.trim()) &&
        parseNumber(numbers[key] ?? '') === null,
    );
    if (hasInvalidValue) {
      setLabelError(
        'Gunakan angka positif atau kosongkan nilai yang tidak terlihat.',
      );
      return;
    }
    setLabelError('');
    onSubmitManualLabel({
      foodName,
      servingLabel,
      sourceLabel,
      nutrients: {
        ...emptyNutritionNutrients,
        ...Object.fromEntries(parsedValues),
      },
    });
  };

  const requestCandidates = async () => {
    const label = foodName.trim();
    if (label.length < 2) {
      setLabelError('Masukkan nama makanan terlebih dahulu.');
      return;
    }
    setCandidateError('');
    setCandidateResult(null);
    setCandidateSource('label');
    setCandidateLoading(true);
    try {
      setCandidateResult(await onRequestLabelCandidates(label));
    } catch (error) {
      setCandidateError(
        error instanceof Error
          ? error.message
          : 'Bantuan AI belum tersedia. Periksa label secara manual.',
      );
    } finally {
      setCandidateLoading(false);
    }
  };

  const requestImageCandidates = async (
    selectImage: () => Promise<FoodImageAsset | null>,
  ) => {
    setMode('label');
    setCandidateError('');
    setCandidateResult(null);
    setCandidateSource('image');
    setCandidateLoading(true);
    try {
      const image = await selectImage();
      if (image) setCandidateResult(await onRequestImageCandidates(image));
    } catch (error) {
      setCandidateError(
        error instanceof Error
          ? error.message
          : 'Foto belum dapat dianalisis. Periksa label secara manual.',
      );
    } finally {
      setCandidateLoading(false);
    }
  };

  const reviewCandidate = (candidate: FoodCandidateReview) => {
    setFoodName(candidate.foodName);
    setServingLabel(candidate.servingLabel);
    setNumbers({
      calories: inputNumber(candidate.nutrients.calories),
      carbohydrateGrams: inputNumber(candidate.nutrients.carbohydrateGrams),
      fatGrams: inputNumber(candidate.nutrients.fatGrams),
      fiberGrams: inputNumber(candidate.nutrients.fiberGrams),
      proteinGrams: inputNumber(candidate.nutrients.proteinGrams),
      sodiumMilligrams: inputNumber(candidate.nutrients.sodiumMilligrams),
      sugarGrams: inputNumber(candidate.nutrients.sugarGrams),
    });
    setSourceLabel(
      candidateSource === 'image'
        ? 'Bantuan AI dari foto (belum diverifikasi)'
        : 'Bantuan AI (belum diverifikasi)',
    );
    setLabelError('');
  };

  const submitBarcode = () => {
    const normalized = normalizeFoodBarcode(barcode);
    if (!normalized) {
      setScannerMessage('Masukkan barcode 8, 12, atau 13 digit tanpa huruf.');
      setScannerMessageTone('error');
      return;
    }
    setScannerMessage('');
    onSubmitBarcode(normalized);
  };

  const runScanner = async () => {
    if (scannerLoading) return;
    setScannerLoading(true);
    setScannerMessage('Membuka pemindai barcode…');
    setScannerMessageTone('info');
    try {
      const result = await onStartScanner();
      if (result.status === 'success') {
        const now = Date.now();
        const previous = lastScannedBarcode.current;
        if (previous?.barcode === result.barcode && now - previous.at < 2000) {
          setScannerMessage('Barcode yang sama baru saja dipindai.');
          return;
        }
        lastScannedBarcode.current = { barcode: result.barcode, at: now };
        setBarcode(result.barcode);
        setScannerMessage(`Barcode ${result.barcode} terdeteksi. Mencari produk…`);
        onSubmitBarcode(result.barcode);
      } else if (result.status === 'cancelled') {
        setScannerMessage('Pemindaian dibatalkan. Kamu masih bisa memasukkan barcode manual.');
      } else {
        setScannerMessage(result.reason);
        setScannerMessageTone('error');
      }
    } catch (error) {
      setScannerMessage(
        error instanceof Error
          ? error.message
          : 'Pemindaian gagal. Coba lagi atau masukkan barcode manual.',
      );
      setScannerMessageTone('error');
    } finally {
      setScannerLoading(false);
    }
  };

  const heroOpacity = scrollY.interpolate({
    inputRange: [0, 180],
    outputRange: [1, 0.55],
    extrapolate: 'clamp',
  });
  const heroTranslate = scrollY.interpolate({
    inputRange: [0, 180],
    outputRange: [0, -18],
    extrapolate: 'clamp',
  });

  return (
    <Animated.ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true },
      )}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader eyebrow="NUTRISI CERDAS" onBack={onBack} title="Scan makanan" />

      <Animated.View
        accessibilityLabel="Pemindai kamera"
        style={[
          styles.hero,
          { opacity: heroOpacity, transform: [{ translateY: heroTranslate }] },
        ]}
      >
        <View style={styles.heroTopline} />
        <View style={styles.heroContent}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>SCAN · REVIEW · SIMPAN</Text>
            <Text numberOfLines={3} style={styles.heroTitle}>
              Kenali isi{`\n`}makananmu.
            </Text>
            <Text style={styles.heroBody}>
              Arahkan kamera ke barcode. Kami tampilkan sumber dan angka per
              porsi sebelum apa pun masuk ke diary.
            </Text>
          </View>
          <View style={styles.scanGlyph}>
            <View style={[styles.scanCorner, styles.scanCornerTopLeft]} />
            <View style={[styles.scanCorner, styles.scanCornerTopRight]} />
            <View style={[styles.scanCorner, styles.scanCornerBottomLeft]} />
            <View style={[styles.scanCorner, styles.scanCornerBottomRight]} />
            <Icon color={colors.text} name="camera" size={30} />
            <View style={styles.scanBeam} />
          </View>
        </View>
        <Text style={styles.scannerAvailability}>
          {scannerCapability.available
            ? 'Pemindaian siap digunakan.'
            : 'Belum tersedia di build ini.'}
        </Text>
        <Text style={styles.scannerReason}>{scannerCapability.reason}</Text>
        {scannerCapability.available ? (
          <Pressable
            accessibilityLabel="Mulai pemindaian kamera"
            accessibilityRole="button"
            disabled={scannerLoading}
            onPress={runScanner}
            style={({ pressed }) => [
              styles.scanButton,
              pressed && styles.scanButtonPressed,
              scannerLoading && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.scanButtonText}>
              {scannerLoading ? 'Membuka scanner…' : 'Scan barcode sekarang'}
            </Text>
            <Icon color={colors.canvas} name="arrow-right" size={21} />
          </Pressable>
        ) : null}
        {scannerMessage ? (
          <View
            accessibilityLabel="Status pemindaian barcode"
            style={[
              styles.scannerMessageBox,
              scannerMessageTone === 'error' && styles.scannerMessageError,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                scannerMessageTone === 'error' && styles.statusDotError,
              ]}
            />
            <Text
              style={[
                styles.scannerMessage,
                scannerMessageTone === 'error' && styles.error,
              ]}
            >
              {scannerMessage}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <View style={styles.assuranceRail}>
        <Text style={styles.assuranceText}>SUMBER TERLIHAT</Text>
        <View style={styles.railDivider} />
        <Text style={styles.assuranceText}>KOSONG ≠ NOL</Text>
        <View style={styles.railDivider} />
        <Text style={styles.assuranceText}>KAMU KONFIRMASI</Text>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Tidak ada barcode?</Text>
          <Text style={styles.sectionBody}>Baca label dengan foto, tetap kamu tinjau.</Text>
        </View>
      </View>

      <View accessibilityLabel="Pemilih foto makanan" style={styles.captureGrid}>
        <Pressable
          accessibilityLabel="Ambil foto label"
          accessibilityRole="button"
          disabled={!imagePickerCapability.available || candidateLoading}
          onPress={() => requestImageCandidates(onCaptureFoodImage)}
          style={({ pressed }) => [
            styles.captureCard,
            styles.captureCardPrimary,
            pressed && styles.captureCardPressed,
          ]}
        >
          <View style={styles.captureIcon}>
            <Icon color={colors.canvas} name="camera" size={24} />
          </View>
          <Text style={styles.captureTitle}>Ambil foto</Text>
          <Text style={styles.captureBody}>Kamera langsung ke label nutrisi.</Text>
          <Icon color={colors.canvas} name="arrow-right" size={20} />
        </Pressable>
        <Pressable
          accessibilityLabel="Pilih foto label"
          accessibilityRole="button"
          disabled={!imagePickerCapability.available || candidateLoading}
          onPress={() => requestImageCandidates(onPickFoodImage)}
          style={({ pressed }) => [
            styles.captureCard,
            styles.captureCardSecondary,
            pressed && styles.captureCardPressed,
          ]}
        >
          <View style={[styles.captureIcon, styles.captureIconDark]}>
            <Icon color={colors.coral} name="spark" size={24} />
          </View>
          <Text style={[styles.captureTitle, styles.captureTitleLight]}>Pilih galeri</Text>
          <Text style={[styles.captureBody, styles.captureBodyLight]}>
            Gunakan foto yang sudah ada.
          </Text>
          <Icon color={colors.coral} name="arrow-right" size={20} />
        </Pressable>
      </View>
      <Text style={styles.imageCapabilityText}>
        {candidateLoading ? 'Menganalisis foto…' : imagePickerCapability.reason}
      </Text>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Masukkan sendiri</Text>
          <Text style={styles.sectionBody}>Cepat untuk kode, teliti untuk label.</Text>
        </View>
      </View>

      <View style={styles.modeRow}>
        {(['barcode', 'label'] as const).map(nextMode => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === nextMode }}
            key={nextMode}
            onPress={() => setMode(nextMode)}
            style={[styles.mode, mode === nextMode && styles.modeActive]}
          >
            <Text
              style={[
                styles.modeText,
                mode === nextMode && styles.modeTextActive,
              ]}
            >
              {nextMode === 'barcode' ? 'Barcode manual' : 'Label kemasan'}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'barcode' ? (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Masukkan nomor barcode</Text>
          <Text style={styles.cardBody}>
            8, 12, atau 13 digit. Hasil tetap memerlukan sumber pangan yang
            jelas sebelum dianggap terverifikasi.
          </Text>
          <TextInput
            accessibilityLabel="Barcode produk"
            autoCapitalize="none"
            keyboardType="numeric"
            onChangeText={setBarcode}
            onSubmitEditing={submitBarcode}
            placeholder="Contoh: 8991234567890"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={barcode}
          />
          <PrimaryButton
            disabled={!barcode.trim()}
            icon="arrow-right"
            label="Cari barcode"
            onPress={submitBarcode}
            style={styles.action}
          />
        </View>
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Salin angka dari label</Text>
          <Text style={styles.cardBody}>
            Isi yang terlihat saja. Kolom kosong akan tampil sebagai “Belum
            diketahui” dan meminta konfirmasi di layar berikutnya.
          </Text>
          <TextInput
            accessibilityLabel="Nama makanan"
            onChangeText={value => {
              setFoodName(value);
              setCandidateResult(null);
            }}
            placeholder="Nama makanan"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={foodName}
          />
          <PrimaryButton
            disabled={candidateLoading}
            icon="spark"
            label={candidateLoading ? 'Mencari saran…' : 'Bantuan AI'}
            onPress={requestCandidates}
            style={styles.action}
            tone="outline"
          />
          {candidateError ? (
            <Text style={styles.error}>{candidateError}</Text>
          ) : null}
          {candidateResult ? (
            <View style={styles.candidateReview}>
              <Text style={styles.eyebrow}>SARAN AI · BELUM DIVERIFIKASI</Text>
              <Text style={styles.candidateWarning}>
                {candidateResult.warning}
              </Text>
              {candidateResult.candidates.map((candidate, index) => (
                <View
                  key={`${candidate.foodName}-${index}`}
                  style={styles.candidateCard}
                >
                  <Text style={styles.candidateTitle}>
                    {candidate.foodName}
                  </Text>
                  {candidate.brand ? (
                    <Text style={styles.candidateBody}>{candidate.brand}</Text>
                  ) : null}
                  <Text style={styles.candidateBody}>
                    {candidate.servingLabel}
                  </Text>
                  <Text style={styles.candidateBody}>
                    {formatCandidateNutrients(candidate)}
                  </Text>
                  <PrimaryButton
                    icon="arrow-right"
                    label="Gunakan untuk tinjau"
                    onPress={() => reviewCandidate(candidate)}
                    style={styles.candidateAction}
                    tone="outline"
                  />
                </View>
              ))}
            </View>
          ) : null}
          <TextInput
            accessibilityLabel="Ukuran porsi"
            onChangeText={setServingLabel}
            placeholder="Ukuran porsi, contoh: 1 bungkus (60 g)"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={servingLabel}
          />
          {numberFields.map(([key, label]) => (
            <TextInput
              accessibilityLabel={label}
              key={key}
              keyboardType="decimal-pad"
              onChangeText={value =>
                setNumbers(current => ({ ...current, [key]: value }))
              }
              placeholder={label}
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={numbers[key] ?? ''}
            />
          ))}
          <TextInput
            accessibilityLabel="Sumber label"
            onChangeText={setSourceLabel}
            placeholder="Sumber, contoh: foto label kemasan"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={sourceLabel}
          />
          {labelError ? <Text style={styles.error}>{labelError}</Text> : null}
          <PrimaryButton
            icon="check"
            label="Tinjau data"
            onPress={submitLabel}
            style={styles.action}
          />
        </View>
      )}

      {onOpenDiary ? (
        <Pressable
          accessibilityRole="button"
          onPress={onOpenDiary}
          style={styles.diaryLink}
        >
          <View>
            <Text style={styles.diaryLinkKicker}>RIWAYATMU</Text>
            <Text style={styles.diaryLinkText}>Buka diary nutrisi</Text>
          </View>
          <Icon color={colors.coral} name="arrow-right" size={20} />
        </Pressable>
      ) : null}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 64 },
  hero: {
    backgroundColor: colors.raised,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  heroTopline: {
    backgroundColor: colors.coral,
    height: 3,
    left: 0,
    position: 'absolute',
    right: '42%',
    top: 0,
  },
  heroContent: { alignItems: 'flex-start', flexDirection: 'row' },
  heroCopy: { flex: 1, paddingRight: spacing.sm },
  heroKicker: { ...type.micro, color: colors.coral, letterSpacing: 1.4 },
  heroTitle: {
    ...type.display,
    color: colors.text,
    fontSize: 34,
    lineHeight: 38,
    marginTop: spacing.sm,
    maxWidth: 340,
  },
  heroBody: { ...type.support, color: colors.secondary, marginTop: spacing.sm },
  scanGlyph: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    height: 112,
    justifyContent: 'center',
    marginTop: spacing.xs,
    overflow: 'hidden',
    width: 96,
  },
  scanBeam: {
    backgroundColor: colors.coral,
    height: 2,
    left: 14,
    position: 'absolute',
    right: 14,
  },
  scanCorner: {
    borderColor: colors.coral,
    height: 18,
    position: 'absolute',
    width: 18,
  },
  scanCornerTopLeft: { borderLeftWidth: 2, borderTopWidth: 2, left: 10, top: 10 },
  scanCornerTopRight: { borderRightWidth: 2, borderTopWidth: 2, right: 10, top: 10 },
  scanCornerBottomLeft: {
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    bottom: 10,
    left: 10,
  },
  scanCornerBottomRight: {
    borderBottomWidth: 2,
    borderRightWidth: 2,
    bottom: 10,
    right: 10,
  },
  scannerAvailability: { ...type.card, color: colors.text, marginTop: spacing.lg },
  scannerReason: { ...type.micro, color: colors.muted, marginTop: spacing.xxs },
  scanButton: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: radius.control,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    minHeight: 58,
    paddingHorizontal: spacing.md,
  },
  scanButtonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.55 },
  scanButtonText: { ...type.body, color: colors.canvas, fontWeight: '800' },
  scannerMessageBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderLeftColor: colors.mint,
    borderLeftWidth: 3,
    flexDirection: 'row',
    marginTop: spacing.sm,
    padding: spacing.sm,
  },
  scannerMessageError: { borderLeftColor: colors.danger },
  statusDot: { backgroundColor: colors.mint, borderRadius: 4, height: 7, width: 7 },
  statusDotError: { backgroundColor: colors.danger },
  assuranceRail: {
    alignItems: 'center',
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  assuranceText: {
    ...type.micro,
    color: colors.muted,
    flex: 1,
    fontSize: 10,
    textAlign: 'center',
  },
  railDivider: { backgroundColor: colors.border, height: 24, width: 1 },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginTop: spacing.xxl,
  },
  sectionTitle: { ...type.section, color: colors.text },
  sectionBody: { ...type.support, color: colors.secondary, marginTop: spacing.xxs },
  captureGrid: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  captureCard: {
    flex: 1,
    justifyContent: 'space-between',
    marginHorizontal: spacing.xxs,
    minHeight: 190,
    padding: spacing.md,
  },
  captureCardPrimary: { backgroundColor: colors.amber, borderRadius: radius.card },
  captureCardSecondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  captureCardPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  captureIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(13,11,11,0.12)',
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  captureIconDark: { backgroundColor: colors.raised },
  captureTitle: { ...type.card, color: colors.canvas, marginTop: spacing.md },
  captureTitleLight: { color: colors.text },
  captureBody: {
    ...type.support,
    color: 'rgba(13,11,11,0.72)',
    marginVertical: spacing.xs,
  },
  captureBodyLight: { color: colors.secondary },
  imageCapabilityText: {
    ...type.micro,
    color: colors.muted,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  intro: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  title: { ...type.section, color: colors.text },
  body: { ...type.body, color: colors.secondary, marginTop: spacing.xs },
  scannerCard: {
    backgroundColor: colors.raised,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    margin: spacing.lg,
    padding: spacing.md,
  },
  scannerRow: { alignItems: 'center', flexDirection: 'row' },
  scannerIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  scannerCopy: { flex: 1, marginLeft: spacing.sm },
  eyebrow: { ...type.micro, color: colors.coral, letterSpacing: 1 },
  cardTitle: { ...type.card, color: colors.text, marginTop: spacing.xs },
  cardBody: {
    ...type.support,
    color: colors.secondary,
    marginTop: spacing.xxs,
  },
  smallButton: {
    borderColor: colors.coral,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  smallButtonText: { ...type.micro, color: colors.coral },
  scannerMessage: {
    ...type.support,
    color: colors.secondary,
    flex: 1,
    marginLeft: spacing.xs,
  },
  cameraButton: { marginLeft: spacing.xs },
  modeRow: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.xxs,
  },
  mode: {
    borderRadius: 9,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  modeActive: { backgroundColor: colors.raised },
  modeText: { ...type.support, color: colors.muted, textAlign: 'center' },
  modeTextActive: { color: colors.text, fontWeight: '800' },
  formCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  formTitle: { ...type.card, color: colors.text },
  input: {
    backgroundColor: colors.raised,
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: 1,
    color: colors.text,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    minHeight: 52,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  action: { marginTop: spacing.md },
  candidateReview: {
    backgroundColor: colors.raised,
    borderColor: colors.amber,
    borderRadius: radius.control,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  candidateWarning: {
    ...type.support,
    color: colors.amber,
    marginTop: spacing.xs,
  },
  candidateCard: {
    borderColor: colors.border,
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  candidateTitle: { ...type.card, color: colors.text },
  candidateBody: {
    ...type.support,
    color: colors.secondary,
    marginTop: spacing.xxs,
  },
  candidateAction: { marginTop: spacing.sm },
  error: { ...type.support, color: colors.danger, marginTop: spacing.sm },
  diaryLink: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginTop: spacing.xxl,
    minHeight: 82,
    paddingHorizontal: spacing.lg,
  },
  diaryLinkKicker: { ...type.micro, color: colors.muted, letterSpacing: 1 },
  diaryLinkText: { ...type.card, color: colors.text, marginTop: spacing.xxs },
});
