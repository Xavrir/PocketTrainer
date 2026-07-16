import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, type } from '../design/tokens';
import { Icon, IconName } from './Icon';

export type AppTab = 'home' | 'learn' | 'coach' | 'progress' | 'profile';
type BottomNavProps = { activeTab: AppTab; onChange: (tab: AppTab) => void };
const tabs: Array<{ id: AppTab; label: string; icon: IconName }> = [
  { id: 'home', label: 'Beranda', icon: 'home' },
  { id: 'learn', label: 'Belajar', icon: 'learn' },
  { id: 'coach', label: 'Pelatih', icon: 'camera' },
  { id: 'progress', label: 'Progres', icon: 'chart' },
  { id: 'profile', label: 'Profil', icon: 'person' },
];

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        const isCoach = tab.id === 'coach';
        const iconColor = isCoach
          ? colors.canvas
          : isActive
          ? colors.coral
          : colors.muted;
        return (
          <Pressable
            accessibilityLabel={`${tab.label} tab`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <View
              style={[
                isCoach ? styles.coachButton : styles.iconBox,
                isActive && !isCoach && styles.activeIconBox,
              ]}
            >
              <Icon
                color={iconColor}
                name={tab.icon}
                size={isCoach ? 23 : 22}
              />
            </View>
            <Text style={[styles.label, isActive && styles.activeLabel]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    flexDirection: 'row',
    flexShrink: 0,
    justifyContent: 'space-around',
    left: 0,
    paddingHorizontal: 8,
    paddingTop: 10,
    position: 'absolute',
    right: 0,
    zIndex: 20,
  },
  tab: {
    alignItems: 'center',
    gap: 4,
    minHeight: 56,
    minWidth: 58,
    paddingHorizontal: spacing.xs,
  },
  pressed: { opacity: 0.72 },
  iconBox: {
    alignItems: 'center',
    borderRadius: radius.control,
    height: 28,
    justifyContent: 'center',
    width: 34,
  },
  activeIconBox: { backgroundColor: 'rgba(255,90,107,0.13)' },
  coachButton: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 18,
    height: 42,
    justifyContent: 'center',
    marginTop: -17,
    shadowColor: colors.coral,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    width: 58,
  },
  label: { ...type.micro, color: colors.muted, fontSize: 11 },
  activeLabel: { color: colors.text },
});
