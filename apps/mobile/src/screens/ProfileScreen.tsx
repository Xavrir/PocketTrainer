import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../design/tokens';
import { Icon, IconName } from '../components/Icon';

export type ProfileConsentState = 'active' | 'inactive' | 'unknown';
type ProfileExportState = 'idle' | 'loading' | 'success' | 'error';
export type ProfileScreenProps = Readonly<{
  email?: string;
  name?: string;
  memberLabel?: string;
  schedule?: string;
  equipment?: string;
  limitations?: string;
  locale?: 'id' | 'en';
  consent?: ProfileConsentState;
  onExportData?: () => Promise<void>;
  onSignOut?: () => Promise<void>;
  onDeleteAccount?: () => Promise<void>;
  versionLabel?: string;
}>;

export function ProfileScreen({
  email,
  name,
  memberLabel,
  schedule,
  equipment,
  limitations,
  locale,
  consent = 'unknown',
  onExportData,
  onSignOut,
  onDeleteAccount,
  versionLabel,
}: ProfileScreenProps) {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string>();
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const [exportState, setExportState] = useState<ProfileExportState>('idle');
  const displayName =
    name?.trim() ||
    (locale === 'en' ? 'PocketTrainer user' : 'Pengguna PocketTrainer');
  const consentValue =
    consent === 'active'
      ? locale === 'en'
        ? 'Active'
        : 'Aktif'
      : consent === 'inactive'
      ? locale === 'en'
        ? 'Inactive'
        : 'Tidak aktif'
      : locale === 'en'
      ? 'Not confirmed'
      : 'Belum dikonfirmasi';
  const trainingItems: ReadonlyArray<{
    icon: IconName;
    label: string;
    value: string;
  }> = [
    schedule ? { icon: 'clock', label: 'Jadwal', value: schedule } : null,
    equipment ? { icon: 'spark', label: 'Peralatan', value: equipment } : null,
    limitations
      ? { icon: 'shield', label: 'Batas gerak', value: limitations }
      : null,
  ].filter(
    (item): item is { icon: IconName; label: string; value: string } =>
      item !== null,
  );
  const groups: ReadonlyArray<{
    title: string;
    items: ReadonlyArray<{ icon: IconName; label: string; value: string }>;
  }> = [
    ...(trainingItems.length
      ? [{ title: 'LATIHAN', items: trainingItems }]
      : []),
    ...(locale
      ? [
          {
            title: 'PREFERENSI',
            items: [
              {
                icon: 'person' as const,
                label: 'Bahasa',
                value: locale === 'en' ? 'English' : 'Bahasa Indonesia',
              },
            ],
          },
        ]
      : []),
    {
      title: 'DATA & PRIVASI',
      items: [
        {
          icon: 'camera',
          label: 'Pemrosesan kamera',
          value: locale === 'en' ? 'On device only' : 'Hanya di perangkat',
        },
        { icon: 'shield', label: 'Persetujuan', value: consentValue },
      ],
    },
  ];
  const initials = displayName
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.nameBlock}>
          <Text style={styles.eyebrow}>PROFIL</Text>
          <Text style={styles.name}>{displayName}</Text>
          {email || memberLabel ? (
            <Text style={styles.member}>{email ?? memberLabel}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.privacyPromise}>
        <Icon color={colors.mint} name="shield" size={22} />
        <View style={styles.promiseCopy}>
          <Text style={styles.promiseTitle}>Privasi yang bisa kamu lihat</Text>
          <Text style={styles.promiseBody}>
            Frame kamera dan landmark mentah tidak pernah diunggah.
          </Text>
        </View>
      </View>
      {groups.map(group => (
        <View key={group.title} style={styles.group}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <View style={styles.card}>
            {group.items.map((item, index) => (
              <View
                key={item.label}
                style={[styles.row, index > 0 && styles.rowBorder]}
              >
                <View style={styles.iconBox}>
                  <Icon color={colors.secondary} name={item.icon} size={21} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Text style={styles.rowValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
      {onExportData ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>EKSPOR PRIVASI</Text>
          <Pressable
            accessibilityLabel="Ekspor data sebagai JSON"
            accessibilityRole="button"
            accessibilityState={{
              busy: exportState === 'loading',
              disabled: exportState === 'loading',
            }}
            disabled={exportState === 'loading'}
            onPress={async () => {
              setExportState('loading');
              try {
                await onExportData();
                setExportState('success');
              } catch {
                setExportState('error');
              }
            }}
            style={({ pressed }) => [
              styles.exportRow,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.iconBox}>
              <Icon color={colors.mint} name="chart" size={21} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowLabel}>Ekspor data</Text>
              <Text style={styles.rowValue}>
                {exportState === 'loading'
                  ? 'Menyiapkan JSON…'
                  : exportState === 'success'
                  ? 'Diserahkan ke dialog berbagi'
                  : exportState === 'error'
                  ? 'Gagal · ketuk untuk mencoba lagi'
                  : 'JSON melalui dialog berbagi Android'}
              </Text>
            </View>
            {exportState === 'loading' ? (
              <Text style={styles.exportStatus}>MEMUAT</Text>
            ) : (
              <Text style={styles.exportAction}>
                {exportState === 'error' ? 'COBA LAGI' : 'EKSPOR'}
              </Text>
            )}
          </Pressable>
          {exportState === 'success' ? (
            <Text accessibilityLiveRegion="polite" style={styles.exportSuccess}>
              Data berhasil diserahkan ke dialog berbagi Android.
            </Text>
          ) : exportState === 'error' ? (
            <Text accessibilityLiveRegion="polite" style={styles.exportError}>
              Ekspor gagal. Periksa koneksi lalu coba lagi.
            </Text>
          ) : null}
        </View>
      ) : null}
      {onSignOut ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: signingOut, disabled: signingOut }}
            disabled={signingOut}
            onPress={async () => {
              setSigningOut(true);
              setSignOutError(undefined);
              try {
                await onSignOut();
              } catch {
                setSignOutError(
                  'Belum bisa keluar. Periksa koneksi lalu coba lagi.',
                );
              } finally {
                setSigningOut(false);
              }
            }}
            style={[styles.signOut, signingOut && styles.signOutDisabled]}
          >
            <Text style={styles.signOutText}>
              {signingOut ? 'Mengeluarkan…' : 'Keluar dari akun'}
            </Text>
          </Pressable>
          {signOutError ? (
            <Text accessibilityLiveRegion="polite" style={styles.signOutError}>
              {signOutError}
            </Text>
          ) : null}
        </>
      ) : null}
      {onDeleteAccount ? (
        <>
          <Pressable
            accessibilityLabel="Hapus akun dan data"
            accessibilityRole="button"
            accessibilityState={{
              busy: deletingAccount,
              disabled: deletingAccount,
            }}
            disabled={deletingAccount}
            onPress={async () => {
              setDeletingAccount(true);
              setDeleteError(undefined);
              try {
                await onDeleteAccount();
              } catch {
                setDeleteError(
                  'Belum bisa menghapus akun. Coba lagi atau hubungi dukungan.',
                );
              } finally {
                setDeletingAccount(false);
              }
            }}
            style={[styles.delete, deletingAccount && styles.deleteDisabled]}
          >
            <Text style={styles.deleteText}>
              {deletingAccount ? 'Menghapus…' : 'Hapus akun & data'}
            </Text>
          </Pressable>
          {deleteError ? (
            <Text accessibilityLiveRegion="polite" style={styles.deleteError}>
              {deleteError}
            </Text>
          ) : null}
        </>
      ) : null}
      {versionLabel ? <Text style={styles.version}>{versionLabel}</Text> : null}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  profileTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 29,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  avatarText: { ...type.card, color: colors.canvas },
  nameBlock: { flex: 1 },
  eyebrow: { ...type.micro, color: colors.coral, letterSpacing: 1 },
  name: { ...type.section, color: colors.text, marginTop: 2 },
  member: { ...type.micro, color: colors.secondary, marginTop: 2 },
  privacyPromise: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(102,221,177,.07)',
    borderColor: 'rgba(102,221,177,.25)',
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.md,
  },
  promiseCopy: { flex: 1 },
  promiseTitle: { ...type.card, color: colors.text, fontSize: 15 },
  promiseBody: { ...type.support, color: colors.secondary, marginTop: 2 },
  group: { marginTop: spacing.xl },
  groupTitle: {
    ...type.micro,
    color: colors.secondary,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 68,
    paddingHorizontal: spacing.md,
  },
  rowBorder: { borderTopColor: colors.border, borderTopWidth: 1 },
  pressed: { backgroundColor: colors.raised },
  iconBox: {
    alignItems: 'center',
    backgroundColor: colors.raised,
    borderRadius: 11,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  rowCopy: { flex: 1 },
  rowLabel: { ...type.card, color: colors.text, fontSize: 14 },
  rowValue: { ...type.micro, color: colors.secondary, marginTop: 2 },
  exportRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 72,
    paddingHorizontal: spacing.md,
  },
  exportAction: {
    ...type.micro,
    color: colors.mint,
    letterSpacing: 0.7,
  },
  exportStatus: {
    ...type.micro,
    color: colors.secondary,
    letterSpacing: 0.7,
  },
  exportSuccess: {
    ...type.micro,
    color: colors.mint,
    marginTop: spacing.xs,
  },
  exportError: {
    ...type.micro,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  signOut: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  signOutText: { ...type.support, color: colors.text, fontWeight: '700' },
  signOutDisabled: { opacity: 0.45 },
  signOutError: {
    ...type.micro,
    color: colors.danger,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  delete: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  deleteDisabled: { opacity: 0.45 },
  deleteText: { ...type.support, color: colors.danger },
  deleteError: {
    ...type.micro,
    color: colors.danger,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  version: {
    ...type.micro,
    color: colors.muted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
