import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {colors, radius, spacing, type} from '../design/tokens';

const lessons = [
  {title: 'Find your stance', detail: 'Mobility · 5 min', state: 'done', icon: '✓'},
  {title: 'Own your squat', detail: 'Strength · 8 min', state: 'current', icon: '2'},
  {title: 'Build control', detail: 'Strength · 10 min', state: 'locked', icon: '3'},
  {title: 'Move with patience', detail: 'Mobility · 7 min', state: 'locked', icon: '4'},
];

export function LearnScreen({onStart}: {onStart: () => void}) {
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Text style={styles.eyebrow}>YOUR PATH · LEVEL 2</Text><Text style={styles.title}>Small reps.<Text style={styles.coral}> Real progress.</Text></Text>
    <Text style={styles.body}>A safer course path built around how you move today.</Text>
    <View style={styles.track}><View style={styles.trackLine}/>{lessons.map((lesson, index) => <View key={lesson.title} style={styles.lessonRow}><View style={[styles.node, lesson.state === 'done' && styles.nodeDone, lesson.state === 'current' && styles.nodeCurrent]}><Text style={styles.nodeText}>{lesson.icon}</Text></View><View style={styles.lessonCopy}><Text style={styles.lessonTitle}>{lesson.title}</Text><Text style={styles.lessonDetail}>{lesson.detail}</Text></View>{lesson.state === 'current' && <Pressable accessibilityRole="button" onPress={onStart} style={styles.start}><Text style={styles.startText}>START</Text></Pressable>}</View>)}</View>
    <View style={styles.safeCard}><Text style={styles.safeEyebrow}>NEXT SAFE GOAL</Text><Text style={styles.safeTitle}>Hold a steady squat for 20 seconds.</Text><Text style={styles.safeBody}>Mastery, not speed, opens the next variation.</Text></View>
  </ScrollView>;
}

const styles = StyleSheet.create({screen:{flex:1,backgroundColor:colors.canvas},content:{padding:spacing.lg,paddingBottom:spacing.huge},eyebrow:{...type.micro,color:colors.coral,letterSpacing:1.1},title:{...type.display,color:colors.text,marginTop:spacing.sm},coral:{color:colors.coral},body:{...type.body,color:colors.secondary,marginTop:spacing.sm,maxWidth:330},track:{marginTop:spacing.xxl,position:'relative'},trackLine:{position:'absolute',left:23,top:24,bottom:24,width:2,backgroundColor:colors.coral,opacity:.55},lessonRow:{minHeight:88,flexDirection:'row',alignItems:'center',gap:spacing.md},node:{width:48,height:48,borderRadius:24,backgroundColor:colors.raised,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center',zIndex:2},nodeDone:{backgroundColor:colors.mint,borderColor:colors.mint},nodeCurrent:{backgroundColor:colors.coral,borderColor:colors.coral},nodeText:{...type.card,color:colors.canvas},lessonCopy:{flex:1},lessonTitle:{...type.card,color:colors.text},lessonDetail:{...type.support,color:colors.muted,marginTop:2},start:{backgroundColor:colors.coral,borderRadius:radius.pill,paddingHorizontal:12,paddingVertical:8},startText:{...type.micro,color:colors.canvas,letterSpacing:.8},safeCard:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.card,padding:spacing.lg,marginTop:spacing.lg},safeEyebrow:{...type.micro,color:colors.mint,letterSpacing:1},safeTitle:{...type.card,color:colors.text,marginTop:spacing.xs},safeBody:{...type.support,color:colors.secondary,marginTop:spacing.xs}});
