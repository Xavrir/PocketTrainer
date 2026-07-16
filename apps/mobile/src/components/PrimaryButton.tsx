import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, radius, spacing, type } from '../design/tokens';
import { Icon, IconName } from './Icon';

type Props = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  style?: ViewStyle;
  tone?: 'coral' | 'light' | 'outline';
};

export function PrimaryButton({
  label,
  onPress,
  icon = 'arrow-right',
  disabled = false,
  style,
  tone = 'coral',
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'light' && styles.light,
        tone === 'outline' && styles.outline,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          tone === 'outline' && styles.outlineLabel,
          disabled && styles.disabledLabel,
        ]}
      >
        {label}
      </Text>
      <Icon
        color={
          disabled
            ? colors.muted
            : tone === 'outline'
              ? colors.text
              : colors.canvas
        }
        name={icon}
        size={21}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: radius.control,
    flexDirection: 'row',
    height: 56,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  light: { backgroundColor: colors.text },
  outline: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderWidth: 1,
  },
  label: { ...type.body, color: colors.canvas, fontWeight: '800' },
  outlineLabel: { color: colors.text },
  disabled: { backgroundColor: colors.raised, opacity: 1 },
  disabledLabel: { color: colors.muted },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
