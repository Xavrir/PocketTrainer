import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, type } from '../design/tokens';
import { Icon, IconName } from './Icon';
import { useReducedMotion } from './useReducedMotion';

export type AppTab = 'home' | 'learn' | 'coach' | 'progress' | 'profile';
type BottomNavProps = { activeTab: AppTab; onChange: (tab: AppTab) => void };
const tabs: Array<{ id: AppTab; label: string; icon: IconName }> = [
  { id: 'home', label: 'Beranda', icon: 'home' },
  { id: 'learn', label: 'Belajar', icon: 'learn' },
  { id: 'coach', label: 'Pelatih', icon: 'camera' },
  { id: 'progress', label: 'Progres', icon: 'chart' },
  { id: 'profile', label: 'Profil', icon: 'person' },
];

const useNativeDriver = Platform.OS !== 'web';

type AnimatedTabProps = Readonly<{
  active: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
  reducedMotion: boolean;
}>;

function AnimatedTab({
  active,
  icon,
  label,
  onPress,
  reducedMotion,
}: AnimatedTabProps) {
  const isCoach = icon === 'camera';
  const selection = useRef(new Animated.Value(active ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = reducedMotion
      ? Animated.timing(selection, {
          duration: 120,
          toValue: active ? 1 : 0,
          useNativeDriver,
        })
      : Animated.spring(selection, {
          friction: 24,
          tension: 220,
          toValue: active ? 1 : 0,
          useNativeDriver,
        });
    animation.start();
    return () => animation.stop();
  }, [active, reducedMotion, selection]);

  const animatePress = (toValue: number) => {
    if (reducedMotion) {
      press.setValue(1);
      return;
    }
    Animated.spring(press, {
      friction: 22,
      tension: 320,
      toValue,
      useNativeDriver,
    }).start();
  };

  const iconScale = selection.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });
  const iconTranslateY = selection.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -1],
  });
  const coachScale = selection.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1.04],
  });
  const activeBackgroundScale = selection.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1],
  });

  const iconColor = isCoach
    ? colors.canvas
    : active
    ? colors.coral
    : colors.muted;

  return (
    <Pressable
      accessibilityLabel={`${label} tab`}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={() => animatePress(0.96)}
      onPressOut={() => animatePress(1)}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
    >
      <Animated.View
        style={[
          styles.tabMotion,
          {
            transform: [
              { scale: press },
              ...(isCoach ? [{ scale: coachScale }] : []),
            ],
          },
        ]}
      >
        {isCoach ? (
          <View style={styles.coachButton}>
            <Icon color={iconColor} name={icon} size={23} />
          </View>
        ) : (
          <Animated.View
            style={[
              styles.iconBox,
              {
                transform: [
                  { scale: iconScale },
                  { translateY: iconTranslateY },
                ],
              },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.activeIconBox,
                {
                  opacity: selection,
                  transform: [{ scale: activeBackgroundScale }],
                },
              ]}
            />
            <Icon color={iconColor} name={icon} size={22} />
          </Animated.View>
        )}
        <Text style={[styles.label, active && styles.activeLabel]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <AnimatedTab
            active={isActive}
            icon={tab.icon}
            key={tab.id}
            label={tab.label}
            onPress={() => onChange(tab.id)}
            reducedMotion={reducedMotion}
          />
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
    minHeight: 56,
    minWidth: 58,
    paddingHorizontal: spacing.xs,
  },
  pressed: { opacity: 0.72 },
  tabMotion: { alignItems: 'center', gap: 4 },
  iconBox: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    position: 'relative',
    width: 34,
  },
  activeIconBox: {
    backgroundColor: 'rgba(255,90,107,0.13)',
    borderRadius: radius.control,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
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
