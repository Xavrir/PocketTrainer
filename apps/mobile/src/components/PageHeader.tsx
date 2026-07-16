import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../design/tokens';
import { Icon } from './Icon';

type Props = {
  eyebrow?: string;
  title?: string;
  onBack?: () => void;
  step?: string;
};
export function PageHeader({ eyebrow, title, onBack, step }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            accessibilityLabel="Kembali"
            accessibilityRole="button"
            onPress={onBack}
            style={styles.back}
          >
            <Icon name="back" />
          </Pressable>
        ) : (
          <View />
        )}
        {step ? <Text style={styles.step}>{step}</Text> : null}
      </View>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  back: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  step: { ...type.micro, color: colors.secondary, letterSpacing: 0.7 },
  eyebrow: {
    ...type.micro,
    color: colors.coral,
    letterSpacing: 1.1,
    marginTop: spacing.xl,
  },
  title: {
    ...type.h1,
    color: colors.text,
    letterSpacing: -0.5,
    marginTop: spacing.xs,
  },
});
