import React, { useEffect, useState } from 'react';
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

type BusyAction = 'google' | 'send-email-otp' | 'verify-email-otp';

export function AuthScreen() {
  const {
    callbackError,
    clearCallbackError,
    sendEmailOtp,
    signInWithGoogle,
    verifyEmailOtp,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [busy, setBusy] = useState<BusyAction>();
  const [message, setMessage] = useState<string>();
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!callbackError) return;
    setIsError(true);
    setMessage(callbackError);
    clearCallbackError();
  }, [callbackError, clearCallbackError]);

  const showResult = (error?: string) => {
    setIsError(Boolean(error));
    setMessage(error);
  };

  const continueWithGoogle = async () => {
    setBusy('google');
    showResult();
    try {
      const result = await signInWithGoogle();
      if (result.error) showResult(result.error);
      else {
        setIsError(false);
        setMessage('Selesaikan login Google di browser yang terbuka.');
      }
    } finally {
      setBusy(undefined);
    }
  };

  const updateEmail = (value: string) => {
    setEmail(value);
    if (otpRequested) {
      setOtpRequested(false);
      setOtp('');
    }
  };

  const requestEmailOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      showResult('Masukkan alamat email yang valid.');
      return;
    }
    setBusy('send-email-otp');
    showResult();
    try {
      const result = await sendEmailOtp(normalizedEmail);
      if (result.error) {
        showResult(result.error);
        return;
      }
      if (result.emailOtpSent) {
        setEmail(normalizedEmail);
        setOtp('');
        setOtpRequested(true);
        setIsError(false);
        setMessage('Kode OTP 6 digit sudah dikirim ke emailmu.');
      }
    } finally {
      setBusy(undefined);
    }
  };

  const verifyOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\d{6}$/.test(otp)) {
      showResult('Masukkan kode OTP 6 digit.');
      return;
    }
    setBusy('verify-email-otp');
    showResult();
    try {
      const result = await verifyEmailOtp(normalizedEmail, otp);
      if (result.error) {
        showResult(result.error);
        return;
      }
      setIsError(false);
      setMessage('Kode diterima. Menyiapkan akunmu…');
    } finally {
      setBusy(undefined);
    }
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
          <Text style={styles.title}>Lanjutkan progresmu.</Text>
          <Text style={styles.body}>
            Masuk untuk menyinkronkan XP, penguasaan, dan jalur latihanmu.
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Lanjut dengan Google"
          accessibilityRole="button"
          accessibilityState={{
            busy: busy === 'google',
            disabled: Boolean(busy),
          }}
          disabled={Boolean(busy)}
          onPress={continueWithGoogle}
          style={({ pressed }) => [
            styles.googleButton,
            pressed && styles.googleButtonPressed,
            busy && styles.buttonDisabled,
          ]}
        >
          <View style={styles.googleMark}>
            <Text style={styles.googleMarkText}>G</Text>
          </View>
          <Text style={styles.googleButtonText}>
            {busy === 'google' ? 'Membuka Google…' : 'Lanjut dengan Google'}
          </Text>
        </Pressable>
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ATAU DENGAN EMAIL</Text>
          <View style={styles.dividerLine} />
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
              editable={!busy}
              keyboardType="email-address"
              onChangeText={updateEmail}
              placeholder="nama@email.com"
              placeholderTextColor={colors.secondary}
              style={styles.input}
              value={email}
            />
          </View>
          {otpRequested ? (
            <>
              <Text style={[styles.label, styles.otpLabel]}>Kode OTP</Text>
              <View style={styles.inputWrap}>
                <Icon color={colors.secondary} name="lock" size={20} />
                <TextInput
                  accessibilityLabel="Kode OTP"
                  autoCapitalize="none"
                  autoComplete="one-time-code"
                  autoCorrect={false}
                  editable={!busy}
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={value =>
                    setOtp(value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="123456"
                  placeholderTextColor={colors.secondary}
                  style={styles.input}
                  value={otp}
                />
              </View>
            </>
          ) : null}
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
            disabled={Boolean(busy)}
            label={
              busy === 'send-email-otp'
                ? 'Mengirim kode…'
                : busy === 'verify-email-otp'
                ? 'Memverifikasi…'
                : otpRequested
                ? 'Verifikasi kode'
                : 'Kirim kode OTP'
            }
            onPress={otpRequested ? verifyOtp : requestEmailOtp}
          />
          {otpRequested ? (
            <Pressable
              accessibilityLabel="Kirim ulang kode OTP"
              accessibilityRole="button"
              accessibilityState={{ disabled: Boolean(busy) }}
              disabled={Boolean(busy)}
              onPress={requestEmailOtp}
              style={styles.resendButton}
            >
              <Text style={styles.resendText}>Kirim ulang kode OTP</Text>
            </Pressable>
          ) : null}
          <Text style={styles.emailHint}>
            Supabase akan mengirim kode sekali pakai. Masukkan 6 digit kode dari
            email untuk melanjutkan.
          </Text>
        </View>
        <View style={styles.privacy}>
          <Icon color={colors.mint} name="shield" size={20} />
          <Text style={styles.privacyText}>
            Google dan Supabase hanya menangani identitas. Video latihan tidak
            pernah dikirim saat kamu masuk.
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
  googleButton: {
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: radius.control,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.xl,
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  googleButtonPressed: { opacity: 0.88 },
  buttonDisabled: { opacity: 0.55 },
  googleMark: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  googleMarkText: { color: '#4285F4', fontSize: 17, fontWeight: '800' },
  googleButtonText: {
    ...type.body,
    color: '#201D1D',
    fontWeight: '700',
  },
  divider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },
  dividerLine: { backgroundColor: colors.border, flex: 1, height: 1 },
  dividerText: { ...type.micro, color: colors.secondary },
  form: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
  },
  label: { ...type.micro, color: colors.secondary, marginBottom: spacing.xs },
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
  otpLabel: { marginTop: spacing.md },
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
  emailHint: {
    ...type.support,
    color: colors.secondary,
    marginTop: spacing.sm,
  },
  resendButton: {
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  resendText: { ...type.support, color: colors.coral, fontWeight: '700' },
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
