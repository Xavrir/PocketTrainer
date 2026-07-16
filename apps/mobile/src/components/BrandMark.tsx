import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../design/tokens';

export function BrandMark(_props: { light?: boolean } = {}) {
  return (
    <View accessible accessibilityLabel="PocketTrainer" style={styles.row}>
      <Image
        resizeMode="contain"
        source={require('../assets/images/pockettrainer-mark.png')}
        style={styles.mark}
      />
      <Text style={styles.wordmark}>
        Pocket<Text style={styles.wordmarkAccent}>Trainer</Text>
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  mark: {
    borderRadius: 8,
    height: 34,
    width: 34,
  },
  wordmark: {
    ...type.card,
    color: colors.text,
    fontStyle: 'italic',
    letterSpacing: -0.7,
  },
  wordmarkAccent: { color: colors.coral },
});
