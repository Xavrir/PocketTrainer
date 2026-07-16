import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors, type} from '../design/tokens';

export function BrandMark() {
  return <View accessible accessibilityLabel="PocketTrainer" style={styles.row}><View style={styles.mark}><View style={styles.innerMark} /></View><Text style={styles.wordmark}>pockettrainer</Text></View>;
}
const styles = StyleSheet.create({row: {alignItems: 'center', flexDirection: 'row', gap: 10}, mark: {alignItems: 'center', borderColor: colors.coral, borderRadius: 9, borderWidth: 2, height: 26, justifyContent: 'center', transform: [{rotate: '45deg'}], width: 26}, innerMark: {backgroundColor: colors.coral, borderRadius: 4, height: 8, width: 8}, wordmark: {...type.card, color: colors.text, letterSpacing: -0.5}});
