import React, {useState} from 'react';
import {StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {BottomNav, AppTab} from './src/components/BottomNav';
import {HomeScreen} from './src/screens/HomeScreen';
import {LearnScreen} from './src/screens/LearnScreen';
import {CoachScreen} from './src/screens/CoachScreen';
import {ProgressScreen} from './src/screens/ProgressScreen';
import {ProfileScreen} from './src/screens/ProfileScreen';
import {colors, spacing, type} from './src/design/tokens';

function ComingSoon({tab}: {tab: AppTab}) {
  const labels: Record<Exclude<AppTab, 'home'>, string> = {learn: 'Your path is loading.', coach: 'Camera coaching is next.', progress: 'Your movement passport is next.', profile: 'Your controls are next.'};
  return <View style={styles.comingSoon}><Text style={styles.comingSoonEyebrow}>{tab.toUpperCase()}</Text><Text style={styles.comingSoonTitle}>{labels[tab as Exclude<AppTab, 'home'>]}</Text><Text style={styles.comingSoonBody}>We’re building this part of your training world.</Text></View>;
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const screen = activeTab === 'home' ? <HomeScreen onStartLesson={() => setActiveTab('coach')} /> : activeTab === 'learn' ? <LearnScreen onStart={() => setActiveTab('coach')} /> : activeTab === 'coach' ? <CoachScreen /> : activeTab === 'progress' ? <ProgressScreen /> : <ProfileScreen />;
  return <SafeAreaView edges={['top']} style={styles.safeArea}><StatusBar barStyle="light-content" backgroundColor={colors.canvas} /><View style={styles.content}>{screen}</View><BottomNav activeTab={activeTab} onChange={setActiveTab} /></SafeAreaView>;
}

export default function App() {return <SafeAreaProvider><AppContent /></SafeAreaProvider>;}

const styles = StyleSheet.create({safeArea: {backgroundColor: colors.canvas, flex: 1}, content: {backgroundColor: colors.canvas, flex: 1}, comingSoon: {flex: 1, justifyContent: 'center', padding: spacing.xl}, comingSoonEyebrow: {...type.micro, color: colors.coral, letterSpacing: 1.2}, comingSoonTitle: {...type.h1, color: colors.text, marginTop: spacing.sm}, comingSoonBody: {...type.body, color: colors.secondary, marginTop: spacing.sm}});
