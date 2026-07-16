import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BrandMark } from '../components/BrandMark';
import { Icon } from '../components/Icon';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius, spacing, type } from '../design/tokens';
import { useAuth } from '../auth/AuthProvider';

type Mode = 'sign-in' | 'sign-up';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [isError, setIsError] = useState(false);

  const submit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setIsError(true);
      setMessage('Masukkan alamat email yang valid.');
      return;
    }
    if (password.length < 8) {
      setIsError(true);
      setMessage('Kata sandi harus memiliki minimal 8 karakter.');
      return;
    }
    setBusy(true);
    setMessage(undefined);
    try {
      const result =
        mode === 'sign-in'
          ? await signIn(normalizedEmail, password)
          : await signUp(normalizedEmail, password);
      if (result.error) {
        setIsError(true);
        setMessage(result.error);
        return;
      }
      if (result.requiresEmailConfirmation) {
        setIsError(false);
        setMessage('Periksa emailmu, lalu konfirmasi akun sebelum masuk.');
        setMode('sign-in');
        setPassword('');
      }
    } finally {
      setBusy(false);
    }
  };

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    setMessage(undefined);
    setPassword('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <BrandMark />
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>AKUN POCKETTRAINER</Text>
          <Text style={styles.title}>
            {mode === 'sign-in' ? 'Lanjutkan progresmu.' : 'Mulai jalurmu.'}
          </Text>
          <Text style={styles.body}>
            {mode === 'sign-in'
              ? 'Masuk untuk menyinkronkan XP, penguasaan, dan jalur latihanmu.'
              : 'Buat akun untuk menyimpan progres dengan aman di semua perangkatmu.'}
          </Text>
        </View>
        <View style={styles.tabs}>
          {(
            [
              ['sign-in', 'Masuk'],
              ['sign-up', 'Daftar'],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === value }}
              key={value}
              onPress={() => changeMode(value)}
              style={[styles.tab, mode === value && styles.tabActive]}
            >
              <Text
                style={[styles.tabText, mode === value && styles.tabTextActive]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrap}>
            <Icon color={colors.secondary} name="person" size={20} />
            <TextInput
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="nama@email.com"
              placeholderTextColor={colors.secondary}
              style={styles.input}
              value={email}
            />
          </View>
          <Text style={[styles.label, styles.passwordLabel]}>Kata sandi</Text>
          <View style={styles.inputWrap}>
            <Icon color={colors.secondary} name="lock" size={20} />
            <TextInput
              accessibilityLabel="Kata sandi"
              autoCapitalize="none"
              autoComplete={
                mode === 'sign-in' ? 'current-password' : 'new-password'
              }
              onChangeText={setPassword}
              maxLength={128}
              placeholder="Minimal 8 karakter"
              placeholderTextColor={colors.secondary}
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>
          {message ? (
            <View style={[styles.message, isError && styles.messageError]}>
              <Icon
                color={isError ? colors.danger : colors.mint}
                name={isError ? 'shield' : 'check'}
                size={18}
              />
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.messageText, isError && styles.messageTextError]}
              >
                {message}
              </Text>
            </View>
          ) : null}
          <PrimaryButton
            disabled={busy}
            label={
              busy
                ? 'Memproses…'
                : mode === 'sign-in'
                ? 'Masuk dengan aman'
                : 'Buat akun'
            }
            onPress={submit}
          />
        </View>
        <View style={styles.privacy}>
          <Icon color={colors.mint} name="shield" size={20} />
          <Text style={styles.privacyText}>
            Supabase hanya menangani identitas. Video latihan tidak pernah
            dikirim saat kamu masuk.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthConfigurationScreen() {
  return (
    <ScrollView
      contentContainerStyle={styles.configurationContent}
      style={styles.configurationScreen}
    >
      <View>
        <BrandMark />
        <View style={styles.configurationIcon}>
          <Icon color={colors.amber} name="shield" size={30} />
        </View>
        <Text style={styles.eyebrow}>KONFIGURASI DIPERLUKAN</Text>
        <Text style={styles.title}>Auth belum terhubung.</Text>
        <Text style={styles.body}>
          Build ini belum memiliki URL dan publishable key Supabase. Hubungi tim
          PocketTrainer atau pasang konfigurasi publik lalu build ulang.
        </Text>
        <View style={styles.configurationNote}>
          <Icon color={colors.mint} name="lock" size={18} />
          <Text style={styles.privacyText}>
            Aplikasi berhenti dengan aman—akses tanpa autentikasi tidak
            diizinkan pada build rilis.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.xxl,
  },
  heading: { marginTop: spacing.huge },
  eyebrow: { ...type.micro, color: colors.coral, letterSpacing: 1.1 },
  title: { ...type.display, color: colors.text, marginTop: spacing.xs },
  body: { ...type.body, color: colors.secondary, marginTop: spacing.sm },
  tabs: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.xl,
    padding: 4,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: colors.raised },
  tabText: { ...type.support, color: colors.secondary, fontWeight: '700' },
  tabTextActive: { color: colors.text },
  form: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: spacing.sm,
    padding: spacing.lg,
  },
  label: { ...type.micro, color: colors.secondary, marginBottom: spacing.xs },
  passwordLabel: { marginTop: spacing.md },
  inputWrap: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.md,
  },
  input: {
    ...type.body,
    color: colors.text,
    flex: 1,
    minHeight: 52,
    paddingVertical: 0,
  },
  message: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(102,221,177,.08)',
    borderRadius: radius.control,
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  messageError: { backgroundColor: 'rgba(255,91,82,.08)' },
  messageText: { ...type.support, color: colors.mint, flex: 1 },
  messageTextError: { color: colors.danger },
  privacy: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  privacyText: { ...type.micro, color: colors.secondary, flex: 1 },
  configurationScreen: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  configurationContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  configurationIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,180,84,.1)',
    borderColor: 'rgba(255,180,84,.3)',
    borderRadius: 22,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.huge,
    width: 64,
  },
  configurationNote: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.md,
  },
});
