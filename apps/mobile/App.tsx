import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BottomNav, AppTab } from './src/components/BottomNav';
import { HomeScreen } from './src/screens/HomeScreen';
import { LearnScreen } from './src/screens/LearnScreen';
import { CoachScreen } from './src/screens/CoachScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import {
  ConsentScreen,
  SetupScreen,
  SetupStep,
  WelcomeScreen,
} from './src/screens/OnboardingScreens';
import {
  AssessmentIntroScreen,
  CameraSetupScreen,
  SafeVariationScreen,
} from './src/screens/AssessmentScreens';
import {
  applyPainAssessment,
  LiveCoachScreen,
  type LiveCoachSessionSummary,
} from './src/screens/LiveCoachScreen';
import {
  ResultScreen,
  type AuthoritativeWorkoutResult,
  type ResultSyncStatus,
} from './src/screens/ResultScreen';
import { colors } from './src/design/tokens';
import { requestCameraPermission } from './src/native/requestCameraPermission';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { AuthConfigurationScreen, AuthScreen } from './src/screens/AuthScreen';
import { adaptCourseCatalog } from './src/course/catalogAdapter';
import type { CourseLesson } from './src/course/types';
import {
  CourseLessonPreviewScreen,
  type LessonSupportMode,
} from './src/components/lesson/CourseLessonPreviewScreen';
import {
  useBootstrapData,
  useOnboardingPersistence,
  useWorkoutCompletion,
} from './src/data';
import type {
  CompleteWorkoutFlowInput,
  PersistOnboardingInput,
} from './src/api';
import { deleteAccount } from './src/api';
import { useOfflineRuntime } from './src/offline';

const APP_VERSION = '0.2.0';
const CONSENT_VERSION = '1.0.0';

function supportForLesson(lesson: CourseLesson): LessonSupportMode {
  if (
    !lesson.coaching.playable ||
    lesson.target.type === 'unknown' ||
    lesson.target.value === null
  ) {
    return 'unavailable';
  }
  return lesson.coaching.scoringSupported ? 'posture-scored' : 'guided';
}

function derivedOfflineSummary(summary: LiveCoachSessionSummary) {
  const derived: {
    -readonly [Key in keyof LiveCoachSessionSummary]?: LiveCoachSessionSummary[Key];
  } = { ...summary };
  delete derived.feedback;
  return derived;
}

export type Flow =
  | 'welcome'
  | 'consent'
  | 'goal'
  | 'equipment'
  | 'limitations'
  | 'schedule'
  | 'assessment'
  | 'lesson'
  | 'camera'
  | 'live'
  | 'result'
  | 'safe-variation'
  | 'auth-preview'
  | 'auth-config-preview'
  | 'main';

export function resolveAuthenticatedStartFlow(
  initialFlow: Flow | undefined,
  onboardingCompleted: boolean | undefined,
): Flow {
  if (initialFlow) return initialFlow;
  return onboardingCompleted ? 'main' : 'welcome';
}

function AppContent({
  initialFlow,
  initialTab = 'home',
}: {
  initialFlow?: Flow;
  initialTab?: AppTab;
}) {
  const auth = useAuth();
  const offlineRuntime = useOfflineRuntime(auth.session?.user.id);
  const bootstrapEnabled =
    Boolean(auth.session) &&
    (!offlineRuntime.available || offlineRuntime.initialized);
  const bootstrap = useBootstrapData(bootstrapEnabled, offlineRuntime);
  const onboardingPersistence = useOnboardingPersistence();
  const workoutCompletion = useWorkoutCompletion(offlineRuntime);
  const [flow, setFlow] = useState<Flow>(initialFlow ?? 'welcome');
  const [activeTab, setActiveTab] = useState<AppTab>(initialTab);
  const [accepted, setAccepted] = useState(false);
  const [selections, setSelections] = useState<Record<SetupStep, string[]>>({
    goal: [],
    equipment: [],
    limitations: [],
    schedule: [],
  });
  const [origin, setOrigin] = useState<'assessment' | 'lesson'>('assessment');
  const [selectedLesson, setSelectedLesson] = useState<CourseLesson | null>(
    null,
  );
  const [localSessionId, setLocalSessionId] = useState<string | null>(null);
  const [sessionSummary, setSessionSummary] =
    useState<LiveCoachSessionSummary | null>(null);
  const [syncStatus, setSyncStatus] = useState<ResultSyncStatus>('not_saved');
  const [authoritativeResult, setAuthoritativeResult] =
    useState<AuthoritativeWorkoutResult>();
  const [resultError, setResultError] = useState<string>();
  const onboardingAttemptRef = useRef<PersistOnboardingInput | null>(null);
  const startupRoutingAppliedRef = useRef(Boolean(initialFlow));
  const workoutAttemptRef = useRef<CompleteWorkoutFlowInput | null>(null);
  const courseCatalog = useMemo(() => {
    if (!bootstrap.data) return null;
    try {
      return adaptCourseCatalog(bootstrap.data);
    } catch {
      return null;
    }
  }, [bootstrap.data]);

  useEffect(() => {
    const synced = offlineRuntime.lastSyncedWorkout;
    if (
      !synced ||
      synced.clientSessionId !== localSessionId ||
      !selectedLesson ||
      syncStatus !== 'saved_offline'
    ) {
      return;
    }
    const priorMastery = bootstrap.data?.progress.mastery.find(
      item => item.exerciseKey === selectedLesson.exerciseKey,
    );
    const mastery = synced.result.completion.masteryChanges.find(
      item => item.exerciseKey === selectedLesson.exerciseKey,
    );
    setAuthoritativeResult({
      xpAwarded: synced.result.completion.xpAwarded,
      totalXp: synced.result.completion.totalXp,
      level: synced.result.completion.level,
      masteryBefore: priorMastery?.bestFormScore ?? null,
      masteryAfter:
        mastery?.bestFormScore ?? priorMastery?.bestFormScore ?? null,
      newlyUnlockedLessonIds: synced.result.completion.newlyUnlockedLessonIds,
      progressionSuppressed: synced.result.completion.progressionSuppressed,
      safetyMessage: synced.result.completion.safetyMessage?.id,
    });
    setSyncStatus('server_confirmed');
    bootstrap.reload();
  }, [
    bootstrap,
    localSessionId,
    offlineRuntime.lastSyncedWorkout,
    selectedLesson,
    syncStatus,
  ]);

  useEffect(() => {
    if (selectedLesson || !courseCatalog) return;
    const firstAvailable = courseCatalog.tracks
      .flatMap(track => track.units)
      .flatMap(unit => unit.lessons)
      .find(lesson => lesson.access.launchAllowed);
    if (firstAvailable) setSelectedLesson(firstAvailable);
  }, [courseCatalog, selectedLesson]);
  useEffect(() => {
    if (startupRoutingAppliedRef.current || !bootstrap.data) return;
    startupRoutingAppliedRef.current = true;
    setFlow(
      resolveAuthenticatedStartFlow(
        initialFlow,
        bootstrap.data.profile?.onboardingCompleted,
      ),
    );
  }, [bootstrap.data, initialFlow]);
  const pick = (kind: SetupStep, id: string) =>
    setSelections(current => {
      const multi = kind === 'equipment' || kind === 'limitations';
      const values = current[kind];
      if (multi && id === 'none') {
        return { ...current, [kind]: ['none'] };
      }
      if (multi) {
        const withoutNone = values.filter(value => value !== 'none');
        return {
          ...current,
          [kind]: withoutNone.includes(id)
            ? withoutNone.filter(value => value !== id)
            : [...withoutNone, id],
        };
      }
      return {
        ...current,
        [kind]: [id],
      };
    });
  const firstAvailableLesson = () =>
    courseCatalog?.tracks
      .flatMap(track => track.units)
      .flatMap(unit => unit.lessons)
      .find(lesson => lesson.access.launchAllowed) ?? null;
  const homeSummary = useMemo(
    () => ({
      displayName:
        typeof auth.session?.user.user_metadata?.full_name === 'string'
          ? auth.session.user.user_metadata.full_name
          : auth.session?.user.email?.split('@')[0],
      weekLabel: courseCatalog
        ? `${courseCatalog.completedLessonCount}/${courseCatalog.totalLessonCount} lesson selesai`
        : undefined,
      nextLesson:
        courseCatalog?.tracks
          .flatMap(track => track.units)
          .flatMap(unit => unit.lessons)
          .find(lesson => lesson.access.launchAllowed) ?? null,
      progress: bootstrap.data?.progress,
      courseProgress: courseCatalog
        ? {
            completed: courseCatalog.completedLessonCount,
            total: courseCatalog.totalLessonCount,
          }
        : undefined,
    }),
    [auth.session, bootstrap.data?.progress, courseCatalog],
  );
  const openLesson = (lesson?: CourseLesson) => {
    const nextLesson = lesson ?? selectedLesson ?? firstAvailableLesson();
    if (!nextLesson) {
      Alert.alert(
        'Lesson belum tersedia',
        'Muat catalog server terlebih dahulu lalu pilih lesson yang tersedia.',
      );
      return;
    }
    setSelectedLesson(nextLesson);
    setOrigin('lesson');
    setFlow('lesson');
  };
  const openAssessment = () => {
    const assessmentLesson =
      courseCatalog?.tracks
        .flatMap(track => track.units)
        .flatMap(unit => unit.lessons)
        .find(lesson => lesson.exerciseKey === 'body_squat') ?? null;
    if (assessmentLesson) setSelectedLesson(assessmentLesson);
    setOrigin('assessment');
    setFlow('assessment');
  };
  const beginLiveCoaching = async () => {
    if (!selectedLesson) {
      Alert.alert(
        'Lesson belum dipilih',
        'Pilih lesson dari catalog terlebih dahulu.',
      );
      return;
    }
    try {
      await requestCameraPermission();
      setLocalSessionId(await offlineRuntime.createId());
      setSessionSummary(null);
      setSyncStatus('not_saved');
      setAuthoritativeResult(undefined);
      setResultError(undefined);
      workoutAttemptRef.current = null;
      setFlow('live');
    } catch (error) {
      Alert.alert(
        'Kamera belum siap',
        error instanceof Error ? error.message : 'Izin kamera diperlukan.',
      );
    }
  };

  const persistOnboarding = async () => {
    const scheduleCount = Number(selections.schedule[0] ?? 3);
    const availableDays = [
      'monday',
      'wednesday',
      'friday',
      'saturday',
    ] as const;
    const goal = selections.goal[0];
    const primaryGoal =
      goal === 'mobility'
        ? 'improve_mobility'
        : goal === 'yoga'
        ? 'reduce_stress'
        : 'build_strength';
    const displayName =
      (typeof auth.session?.user.user_metadata?.full_name === 'string'
        ? auth.session.user.user_metadata.full_name
        : auth.session?.user.email?.split('@')[0]) ?? 'Pengguna PocketTrainer';
    try {
      let attempt = onboardingAttemptRef.current;
      if (!attempt) {
        const consentTypes = [
          'privacy',
          'camera_processing',
          'fitness_guidance',
        ] as const;
        const consentIds = await Promise.all(
          consentTypes.map(() => offlineRuntime.createId()),
        );
        attempt = {
          consents: consentTypes.map((type, index) => ({
            type,
            idempotencyKey: consentIds[index]!,
            input: { granted: accepted, version: CONSENT_VERSION },
          })),
          profileIdempotencyKey: await offlineRuntime.createId(),
          profile: {
            displayName,
            locale: 'id',
            timezone: 'Asia/Jakarta',
            primaryGoal,
            experienceLevel: 'foundation',
            equipment: selections.equipment
              .filter(item => item !== 'none')
              .map(item => (item === 'bench' ? 'bench_or_wall' : item)),
            limitations: selections.limitations.filter(item => item !== 'none'),
            schedule: {
              days: availableDays.slice(0, Math.max(1, scheduleCount)),
              durationMinutes: 30,
            },
            onboardingCompleted: true,
          },
        } satisfies PersistOnboardingInput;
      }
      onboardingAttemptRef.current = attempt;
      await onboardingPersistence.save(attempt);
      onboardingAttemptRef.current = null;
      bootstrap.reload();
      openAssessment();
    } catch (error) {
      Alert.alert(
        'Onboarding belum tersimpan',
        error instanceof Error
          ? error.message
          : 'Periksa koneksi dan coba lagi.',
      );
    }
  };

  const submitWorkout = async ({
    painReported,
    perceivedDifficulty,
  }: {
    painReported: boolean;
    perceivedDifficulty: number;
  }) => {
    if (!selectedLesson || !sessionSummary || !bootstrap.data) {
      setSyncStatus('sync_failed');
      setResultError('Catalog atau ringkasan sesi tidak tersedia.');
      return;
    }
    const exercise = bootstrap.data.catalog.exercises.find(
      item => item.exerciseKey === selectedLesson.exerciseKey,
    );
    if (!exercise) {
      setSyncStatus('sync_failed');
      setResultError('Definisi gerakan tidak ditemukan di catalog server.');
      return;
    }
    const summary = applyPainAssessment(sessionSummary, painReported);
    const priorMastery = bootstrap.data.progress.mastery.find(
      item => item.exerciseKey === selectedLesson.exerciseKey,
    );
    setSyncStatus('waiting_to_sync');
    setResultError(undefined);
    try {
      const attempt =
        workoutAttemptRef.current ??
        buildWorkoutAttempt({
          exercise,
          lesson: selectedLesson,
          perceivedDifficulty,
          painReported,
          summary,
        });
      workoutAttemptRef.current = attempt;
      const durable = await workoutCompletion.complete(
        attempt,
        derivedOfflineSummary(summary),
      );
      if (durable.outcome === 'saved_offline') {
        setSessionSummary(summary);
        setAuthoritativeResult(undefined);
        setSyncStatus('saved_offline');
        return;
      }
      const result = durable.result;
      const mastery = result.completion.masteryChanges.find(
        item => item.exerciseKey === selectedLesson.exerciseKey,
      );
      setSessionSummary(summary);
      setAuthoritativeResult({
        xpAwarded: result.completion.xpAwarded,
        totalXp: result.completion.totalXp,
        level: result.completion.level,
        masteryBefore: priorMastery?.bestFormScore ?? null,
        masteryAfter:
          mastery?.bestFormScore ?? priorMastery?.bestFormScore ?? null,
        newlyUnlockedLessonIds: result.completion.newlyUnlockedLessonIds,
        progressionSuppressed: result.completion.progressionSuppressed,
        safetyMessage: result.completion.safetyMessage?.id,
      });
      setSyncStatus('server_confirmed');
      bootstrap.reload();
    } catch (error) {
      setSyncStatus('sync_failed');
      setResultError(
        error instanceof Error
          ? error.message
          : 'Hasil belum dikonfirmasi server.',
      );
      throw error;
    }
  };
  const mainScreen =
    activeTab === 'home' ? (
      <HomeScreen
        onStartLesson={() => openLesson()}
        summary={homeSummary}
      />
    ) : activeTab === 'learn' ? (
      <LearnScreen
        catalog={courseCatalog}
        error={bootstrap.error?.message ?? null}
        loading={bootstrap.loading}
        onRetry={bootstrap.reload}
        onStart={openLesson}
        selectedLessonId={selectedLesson?.id}
      />
    ) : activeTab === 'coach' ? (
      <CoachScreen
        onAssessment={openAssessment}
        onWorkout={() => openLesson()}
      />
    ) : activeTab === 'progress' ? (
      <ProgressScreen
        error={bootstrap.error?.message}
        loading={bootstrap.loading}
        onRetry={bootstrap.reload}
        progress={bootstrap.data?.progress}
      />
    ) : (
      <ProfileScreen
        email={auth.session?.user.email}
        name={
          typeof auth.session?.user.user_metadata?.full_name === 'string'
            ? auth.session.user.user_metadata.full_name
            : bootstrap.data?.profile?.displayName
        }
        memberLabel={
          bootstrap.data?.profile
            ? `Level ${bootstrap.data.profile.experienceLevel}`
            : undefined
        }
        schedule={
          bootstrap.data?.profile
            ? `${bootstrap.data.profile.schedule.days.join(', ')} · ${bootstrap.data.profile.schedule.durationMinutes} mnt`
            : undefined
        }
        equipment={bootstrap.data?.profile?.equipment.join(', ')}
        limitations={bootstrap.data?.profile?.limitations.join(', ')}
        locale={bootstrap.data?.profile?.locale}
        consent={
          bootstrap.data?.consents.length
            ? bootstrap.data.consents.some(
                item => item.type === 'camera_processing' && item.granted,
              )
              ? 'active'
              : 'inactive'
            : 'unknown'
        }
        onSignOut={auth.configured ? auth.signOut : undefined}
        onDeleteAccount={
          auth.configured
            ? async () => {
                await deleteAccount({
                  idempotencyKey: `account-delete-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2, 10)}`,
                });
                await auth.signOut();
              }
            : undefined
        }
      />
    );
  let screen: React.ReactNode;
  if (!initialFlow && bootstrap.loading && !bootstrap.data)
    screen = (
      <View style={styles.authLoading}>
        <ActivityIndicator color={colors.coral} size="large" />
        <Text style={styles.authLoadingText}>Memuat profil dan catalog…</Text>
      </View>
    );
  else if (flow === 'auth-preview') screen = <AuthScreen />;
  else if (flow === 'auth-config-preview') screen = <AuthConfigurationScreen />;
  else if (flow === 'welcome')
    screen = <WelcomeScreen onStart={() => setFlow('consent')} />;
  else if (flow === 'consent')
    screen = (
      <ConsentScreen
        accepted={accepted}
        onBack={() => setFlow('welcome')}
        onContinue={() => setFlow('goal')}
        onToggle={() => setAccepted(value => !value)}
      />
    );
  else if (flow === 'goal')
    screen = (
      <SetupScreen
        kind="goal"
        onBack={() => setFlow('consent')}
        onContinue={() => setFlow('equipment')}
        onSelect={id => pick('goal', id)}
        selected={selections.goal}
      />
    );
  else if (flow === 'equipment')
    screen = (
      <SetupScreen
        kind="equipment"
        onBack={() => setFlow('goal')}
        onContinue={() => setFlow('limitations')}
        onSelect={id => pick('equipment', id)}
        selected={selections.equipment}
      />
    );
  else if (flow === 'limitations')
    screen = (
      <SetupScreen
        kind="limitations"
        onBack={() => setFlow('equipment')}
        onContinue={() => setFlow('schedule')}
        onSelect={id => pick('limitations', id)}
        selected={selections.limitations}
      />
    );
  else if (flow === 'schedule')
    screen = (
      <SetupScreen
        kind="schedule"
        onBack={() => setFlow('limitations')}
        onContinue={() => persistOnboarding().catch(() => undefined)}
        onSelect={id => pick('schedule', id)}
        selected={selections.schedule}
      />
    );
  else if (flow === 'assessment')
    screen = (
      <AssessmentIntroScreen
        onBack={() => setFlow(activeTab === 'coach' ? 'main' : 'schedule')}
        onContinue={() => setFlow('camera')}
      />
    );
  else if (flow === 'lesson')
    screen = selectedLesson ? (
      <CourseLessonPreviewScreen
        lesson={selectedLesson}
        onBack={() => setFlow('main')}
        onStart={lesson => {
          setSelectedLesson(lesson);
          setOrigin('lesson');
          setFlow('camera');
        }}
        support={supportForLesson(selectedLesson)}
      />
    ) : (
      <View style={styles.missingState}>
        <Text style={styles.missingTitle}>Pilih lesson dari catalog.</Text>
        <Text style={styles.missingBody}>
          Detail lesson hanya tersedia setelah catalog server dimuat.
        </Text>
      </View>
    );
  else if (flow === 'camera')
    screen = (
      <CameraSetupScreen
        onBack={() => setFlow(origin === 'lesson' ? 'lesson' : 'assessment')}
        onReady={beginLiveCoaching}
      />
    );
  else if (
    flow === 'live' &&
    selectedLesson &&
    localSessionId &&
    selectedLesson.target.value !== null &&
    selectedLesson.target.type !== 'unknown'
  )
    screen = (
      <LiveCoachScreen
        exerciseKey={selectedLesson.exerciseKey}
        onComplete={summary => {
          setSessionSummary(summary);
          setSyncStatus('not_saved');
          setFlow('result');
        }}
        onStop={() => setFlow(origin === 'lesson' ? 'lesson' : 'assessment')}
        sessionId={localSessionId}
        targetType={
          selectedLesson.target.type === 'reps' ? 'repetitions' : 'duration_ms'
        }
        targetValue={
          selectedLesson.target.type === 'reps'
            ? selectedLesson.target.value
            : selectedLesson.target.value * 1000
        }
      />
    );
  else if (flow === 'live')
    screen = (
      <View style={styles.missingState}>
        <Text style={styles.missingTitle}>Sesi belum siap.</Text>
        <Text style={styles.missingBody}>
          Kembali ke catalog dan mulai lesson yang tersedia.
        </Text>
      </View>
    );
  else if (flow === 'result' && selectedLesson && sessionSummary)
    screen = (
      <ResultScreen
        completion={authoritativeResult}
        error={resultError}
        onDone={() => {
          setActiveTab('home');
          setFlow('main');
        }}
        onSubmitFeedback={submitWorkout}
        onViewSaferVariation={() => setFlow('safe-variation')}
        session={{
          exerciseLabel: selectedLesson.exerciseName,
          exerciseKey: selectedLesson.exerciseKey,
          targetType:
            sessionSummary.targetType === 'repetitions' ? 'reps' : 'seconds',
          targetValue:
            sessionSummary.targetType === 'repetitions'
              ? sessionSummary.targetValue
              : Math.round(sessionSummary.targetValue / 1000),
          completedValue:
            sessionSummary.targetType === 'repetitions'
              ? sessionSummary.repetitionCount
              : Math.floor(sessionSummary.activeDurationMs / 1000),
          totalReps: sessionSummary.repetitionCount,
          validReps:
            sessionSummary.coachingMode === 'posture_scored' &&
            sessionSummary.confidenceEligible
              ? sessionSummary.repetitionCount
              : 0,
          durationMs: sessionSummary.elapsedTimeMs,
          formScore: sessionSummary.formScore,
          trackingEligible: sessionSummary.confidenceEligible,
          scoringSupported: sessionSummary.coachingMode === 'posture_scored',
        }}
        syncStatus={syncStatus}
      />
    );
  else if (flow === 'result')
    screen = (
      <View style={styles.missingState}>
        <Text style={styles.missingTitle}>Belum ada hasil sesi.</Text>
        <Text style={styles.missingBody}>
          Selesaikan target lesson sebelum membuka ringkasan.
        </Text>
      </View>
    );
  else if (flow === 'safe-variation')
    screen = (
      <SafeVariationScreen
        onBack={() => setFlow('result')}
        onDone={() => {
          setActiveTab('home');
          setFlow('main');
        }}
      />
    );
  else
    screen = (
      <>
        <View style={styles.content}>{mainScreen}</View>
        <BottomNav activeTab={activeTab} onChange={setActiveTab} />
      </>
    );
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.canvas} />
      {screen}
    </SafeAreaView>
  );
}

export default function App({
  initialFlow,
  initialTab,
}: { initialFlow?: Flow; initialTab?: AppTab } = {}) {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthBoundary initialFlow={initialFlow} initialTab={initialTab} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AuthBoundary({
  initialFlow,
  initialTab,
}: {
  initialFlow?: Flow;
  initialTab?: AppTab;
}) {
  const { bypassAllowed, configured, loading, session } = useAuth();
  if (!configured && !bypassAllowed) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={colors.canvas} />
        <AuthConfigurationScreen />
      </SafeAreaView>
    );
  }
  if (configured && loading) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.authLoading}>
          <ActivityIndicator color={colors.coral} size="large" />
          <Text style={styles.authLoadingText}>Memulihkan sesi aman…</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (configured && !session) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={colors.canvas} />
        <AuthScreen />
      </SafeAreaView>
    );
  }
  return <AppContent initialFlow={initialFlow} initialTab={initialTab} />;
}

function buildWorkoutAttempt({
  exercise,
  lesson,
  painReported,
  perceivedDifficulty,
  summary,
}: {
  exercise: {
    id: string;
    poseModelVersion: string;
    scoringVersion: string;
    version: number;
  };
  lesson: CourseLesson;
  painReported: boolean;
  perceivedDifficulty: number;
  summary: LiveCoachSessionSummary;
}): CompleteWorkoutFlowInput {
  const postureEligible =
    summary.coachingMode === 'posture_scored' &&
    summary.confidenceEligible &&
    summary.formScore !== null;
  const completionScore = summary.targetMet
    ? 100
    : Math.round(
        Math.max(
          0,
          Math.min(
            100,
            (summary.targetType === 'repetitions'
              ? summary.repetitionCount / Math.max(1, summary.targetValue)
              : summary.activeDurationMs / Math.max(1, summary.targetValue)) *
              100,
          ),
        ),
      );
  return {
    createIdempotencyKey: `${summary.sessionId}:create`,
    resultsIdempotencyKey: `${summary.sessionId}:results`,
    completionIdempotencyKey: `${summary.sessionId}:complete`,
    create: {
      lessonId: lesson.id,
      startedAt: summary.startedAt,
      applicationVersion: APP_VERSION,
    },
    results: {
      results: [
        {
          clientResultId: summary.sessionId,
          exerciseDefinitionId: exercise.id,
          exerciseDefinitionVersion: exercise.version,
          scoringVersion: exercise.scoringVersion,
          poseModelVersion: exercise.poseModelVersion,
          setNumber: 1,
          totalReps:
            summary.targetType === 'repetitions' ? summary.repetitionCount : 0,
          validReps:
            summary.targetType === 'repetitions' && postureEligible
              ? summary.repetitionCount
              : 0,
          ...(postureEligible ? { formScore: summary.formScore! } : {}),
          completionScore,
          controlScore: postureEligible ? Math.round(summary.formScore!) : 0,
          consistencyScore: postureEligible
            ? Math.round((summary.averageTrackingConfidence ?? 0) * 100)
            : 0,
          trackingEligible: postureEligible,
          durationMs: summary.elapsedTimeMs,
        },
      ],
    },
    completion: {
      completedAt: summary.completedAt,
      perceivedDifficulty,
      painReported,
    },
  };
}
const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.canvas,
    flex: 1,
    height: '100%',
    minHeight: 0,
  },
  content: {
    backgroundColor: colors.canvas,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    paddingBottom: 72,
  },
  authLoading: {
    alignItems: 'center',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
  },
  authLoadingText: { color: colors.secondary, fontSize: 14 },
  missingState: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  missingTitle: { color: colors.text, fontSize: 22, fontWeight: '700' },
  missingBody: {
    color: colors.secondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
});
