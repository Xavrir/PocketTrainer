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
import { TabSceneTransition } from './src/components/TabSceneTransition';
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
  AssessmentCompletionV2,
  CompleteWorkoutFlowInput,
  DailyNutrition,
  PersistOnboardingInput,
} from './src/api';
import { deleteAccount } from './src/api';
import { useOfflineRuntime } from './src/offline';
import { createWorkoutMeasurement } from './src/data/workoutMeasurement';
import { useDailyNutrition, usePocketTrainerApi } from './src/data';
import { NutritionDiaryScreen } from './src/nutrition/screens/NutritionDiaryScreen';
import { NutritionFactsScreen } from './src/nutrition/screens/NutritionFactsScreen';
import { ScanFoodScreen } from './src/nutrition/screens/ScanFoodScreen';
import {
  createFactsFromManualLabel,
  type NutritionDiaryEntryUpdate,
  type NutritionDiaryEntry,
  type NutritionDiarySummary,
  type NutritionFacts,
} from './src/nutrition/components/types';
import { sharePrivacyExport } from './src/privacy/sharePrivacyExport';
import {
  AssessmentResultScreen,
  createAssessmentEvidence,
} from './src/assessment';

const APP_VERSION = '0.3.0-beta';
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

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toNutritionFacts(
  value: unknown,
  barcode?: string,
): NutritionFacts | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const food = raw.food && typeof raw.food === 'object' ? raw.food : raw;
  const item = food as Record<string, unknown>;
  const serving =
    item.serving && typeof item.serving === 'object'
      ? (item.serving as Record<string, unknown>)
      : undefined;
  const nutrition =
    item.nutritionPerServing && typeof item.nutritionPerServing === 'object'
      ? (item.nutritionPerServing as Record<string, unknown>)
      : item.nutrition && typeof item.nutrition === 'object'
      ? (item.nutrition as Record<string, unknown>)
      : undefined;
  const name = typeof item.name === 'string' ? item.name.trim() : '';
  if (!name || !nutrition) return null;
  const isOpenFoodFacts =
    (item.source === 'open_food_facts' ||
      item.providerSource === 'open_food_facts' ||
      item.source === 'barcode') &&
    item.authoritative === true;
  const servingLabel =
    typeof serving?.label === 'string' && serving.label.trim()
      ? serving.label
      : `${serving?.amount ?? 1} ${serving?.unit ?? 'porsi'}`;
  const source =
    isOpenFoodFacts
      ? {
          label: 'Open Food Facts',
          detail:
            item.persisted === false
              ? 'Data barcode dari provider pangan kemasan. Belum tersimpan di server; diary akan menunggu sinkronisasi.'
              : 'Data barcode dari provider pangan kemasan dan tersimpan di server.',
        }
      : item.source === 'gemini_unverified'
      ? {
          label: 'Bantuan AI (belum diverifikasi)',
          detail: 'Perkiraan Gemini. Periksa kembali angka pada kemasan.',
        }
      : {
          label: 'Sumber belum terverifikasi',
          detail: 'Periksa angka pada kemasan sebelum menyimpan.',
        };
  return {
    foodName: name,
    servingLabel,
    barcode: typeof item.barcode === 'string' ? item.barcode : barcode,
    status:
      isOpenFoodFacts
        ? 'verified'
        : 'needs-confirmation',
    source,
    nutrients: {
      calories: toNumber(nutrition.caloriesKcal ?? nutrition.calories),
      proteinGrams: toNumber(nutrition.proteinG ?? nutrition.proteinGrams),
      carbohydrateGrams: toNumber(
        nutrition.carbohydrateG ?? nutrition.carbohydrateGrams,
      ),
      fatGrams: toNumber(nutrition.fatG ?? nutrition.fatGrams),
      fiberGrams: toNumber(nutrition.fiberG ?? nutrition.fiberGrams),
      sodiumMilligrams: toNumber(
        nutrition.sodiumMg ?? nutrition.sodiumMilligrams,
      ),
      sugarGrams: toNumber(nutrition.sugarG ?? nutrition.sugarGrams),
    },
  };
}

function toNutritionDiaryEntry(value: unknown): NutritionDiaryEntry | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const facts = toNutritionFacts(raw.food ?? raw);
  if (!facts || typeof raw.id !== 'string') return null;
  const consumedAt =
    typeof raw.consumedAt === 'string' ? new Date(raw.consumedAt) : null;
  return {
    id: raw.id,
    mealType:
      raw.mealType === 'breakfast' ||
      raw.mealType === 'lunch' ||
      raw.mealType === 'dinner' ||
      raw.mealType === 'snack' ||
      raw.mealType === 'other'
        ? raw.mealType
        : undefined,
    mealLabel: typeof raw.mealType === 'string' ? raw.mealType : 'Makanan',
    loggedAtLabel:
      consumedAt && !Number.isNaN(consumedAt.valueOf())
        ? consumedAt.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '—',
    servings:
      typeof raw.servings === 'number'
        ? raw.servings
        : typeof raw.portionAmount === 'number'
        ? raw.portionAmount
        : 1,
    facts,
    syncStatus: 'server-confirmed',
  };
}

function toNutritionDiarySummary(
  daily: DailyNutrition | null,
): NutritionDiarySummary | null {
  if (!daily) return null;
  const total = (
    totalKey: keyof DailyNutrition['totals'],
    entryKey: keyof DailyNutrition['entries'][number],
  ) => {
    const unknownEntryCount = daily.entries.filter(
      entry => toNumber(entry[entryKey]) === null,
    ).length;
    return {
      complete: unknownEntryCount === 0,
      unknownEntryCount,
      value: toNumber(daily.totals[totalKey]) ?? 0,
    };
  };
  return {
    status: 'server-confirmed',
    totals: {
      calories: total('calories', 'calories'),
      proteinGrams: total('proteinGrams', 'proteinGrams'),
      carbohydrateGrams: total(
        'carbohydrateGrams',
        'carbohydrateGrams',
      ),
      fatGrams: total('fatGrams', 'fatGrams'),
      fiberGrams: total('fiberGrams', 'fiberGrams'),
      sodiumMilligrams: total('sodiumMilligrams', 'sodiumMilligrams'),
      sugarGrams: total('sugarGrams', 'sugarGrams'),
    },
  };
}

export type Flow =
  | 'welcome'
  | 'consent'
  | 'goal'
  | 'equipment'
  | 'limitations'
  | 'schedule'
  | 'assessment'
  | 'assessment-result'
  | 'lesson'
  | 'camera'
  | 'live'
  | 'result'
  | 'safe-variation'
  | 'nutrition-scan'
  | 'nutrition-facts'
  | 'nutrition-diary'
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
  const nutritionApi = usePocketTrainerApi();
  const nutritionDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
  }).format(new Date());
  const nutritionDailyResource = useDailyNutrition(
    nutritionDate,
    Boolean(auth.session),
  );
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
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [assessmentCompletion, setAssessmentCompletion] =
    useState<AssessmentCompletionV2 | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
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
  const [nutritionFacts, setNutritionFacts] = useState<NutritionFacts | null>(
    null,
  );
  const [nutritionFoodId, setNutritionFoodId] = useState<string | null>(null);
  const [nutritionEntries, setNutritionEntries] = useState<
    NutritionDiaryEntry[]
  >([]);
  const [nutritionSyncError, setNutritionSyncError] = useState<string | null>(
    null,
  );
  const onboardingAttemptRef = useRef<PersistOnboardingInput | null>(null);
  const assessmentCreateKeyRef = useRef<string | null>(null);
  const assessmentCompleteKeyRef = useRef<string | null>(null);
  const startupRoutingAppliedRef = useRef(Boolean(initialFlow));
  const workoutAttemptRef = useRef<CompleteWorkoutFlowInput | null>(null);
  useEffect(() => {
    const entries = nutritionDailyResource.data?.entries
      .map(toNutritionDiaryEntry)
      .filter((entry): entry is NutritionDiaryEntry => Boolean(entry));
    if (entries) setNutritionEntries(entries);
  }, [nutritionDailyResource.data]);
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
    if (origin === 'assessment') {
      const completionIdempotencyKey = assessmentCompleteKeyRef.current;
      if (!assessmentId || !sessionSummary || !completionIdempotencyKey) return;
      let evidence;
      try {
        evidence = createAssessmentEvidence(
          synced.result.createdSession.id,
          sessionSummary,
          sessionSummary.painState === 'reported',
        );
      } catch (error) {
        setResultError(
          error instanceof Error
            ? error.message
            : 'Bukti asesmen tidak valid.',
        );
        setSyncStatus('sync_failed');
        return;
      }
      setSyncStatus('waiting_to_sync');
      nutritionApi
        .completeAssessment(
          assessmentId,
          evidence,
          { idempotencyKey: completionIdempotencyKey },
        )
        .then(completion => {
          setAssessmentCompletion(completion);
          setSyncStatus('server_confirmed');
          setFlow('assessment-result');
          bootstrap.reload();
        })
        .catch(error => {
          setResultError(
            error instanceof Error
              ? error.message
              : 'Asesmen belum dikonfirmasi server.',
          );
          setSyncStatus('sync_failed');
        });
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
    assessmentId,
    localSessionId,
    nutritionApi,
    offlineRuntime.lastSyncedWorkout,
    origin,
    selectedLesson,
    sessionSummary,
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
  const recommendedLesson = useMemo(() => {
    const lessonIds = bootstrap.data?.currentPlan?.lessonIds;
    if (!courseCatalog || !lessonIds?.length) return null;
    const lessons = courseCatalog.tracks
      .flatMap(track => track.units)
      .flatMap(unit => unit.lessons);
    return lessonIds
      .map(id => lessons.find(lesson => lesson.id === id))
      .find((lesson): lesson is CourseLesson => Boolean(lesson)) ?? null;
  }, [bootstrap.data?.currentPlan?.lessonIds, courseCatalog]);
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
    if (!assessmentLesson) {
      Alert.alert(
        'Asesmen belum tersedia',
        'Catalog server belum menyediakan lesson squat untuk asesmen.',
      );
      return;
    }
    setSelectedLesson(assessmentLesson);
    setAssessmentId(null);
    setAssessmentCompletion(null);
    setAssessmentError(null);
    assessmentCreateKeyRef.current = null;
    assessmentCompleteKeyRef.current = null;
    setOrigin('assessment');
    setFlow('assessment');
  };
  const prepareAssessment = async () => {
    setAssessmentLoading(true);
    setAssessmentError(null);
    try {
      const idempotencyKey =
        assessmentCreateKeyRef.current ?? (await offlineRuntime.createId());
      assessmentCreateKeyRef.current = idempotencyKey;
      const assessment = await nutritionApi.createAssessment({
        idempotencyKey,
      });
      assessmentCompleteKeyRef.current ??= await offlineRuntime.createId();
      setAssessmentId(assessment.id);
      setFlow('camera');
    } catch (error) {
      setAssessmentError(
        error instanceof Error
          ? error.message
          : 'Asesmen belum dapat dibuat di server.',
      );
    } finally {
      setAssessmentLoading(false);
    }
  };
  const beginLiveCoaching = async () => {
    if (origin === 'assessment' && !assessmentId) {
      Alert.alert(
        'Asesmen belum dibuat',
        'Kembali dan buat asesmen server sebelum menyalakan kamera.',
      );
      return;
    }
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
      if (origin === 'assessment') {
        if (!assessmentId) {
          throw new Error('ID asesmen server tidak tersedia.');
        }
        const completionIdempotencyKey =
          assessmentCompleteKeyRef.current ??
          (await offlineRuntime.createId());
        assessmentCompleteKeyRef.current = completionIdempotencyKey;
        const completion = await nutritionApi.completeAssessment(
          assessmentId,
          createAssessmentEvidence(
            result.createdSession.id,
            summary,
            painReported,
          ),
          { idempotencyKey: completionIdempotencyKey },
        );
        setSessionSummary(summary);
        setAssessmentCompletion(completion);
        setAuthoritativeResult(undefined);
        setSyncStatus('server_confirmed');
        setFlow('assessment-result');
        bootstrap.reload();
        return;
      }
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
  const openNutritionScan = () => {
    setNutritionSyncError(null);
    setNutritionFacts(null);
    setNutritionFoodId(null);
    setFlow('nutrition-scan');
  };
  const submitNutritionBarcode = async (barcode: string) => {
    try {
      const candidate = await nutritionApi.lookupBarcode(barcode);
      const facts = toNutritionFacts(candidate, barcode);
      if (!facts) {
        Alert.alert(
          'Data tidak ditemukan',
          'Barcode belum memiliki data nutrisi. Gunakan tab label kemasan untuk memasukkan angka yang terlihat.',
        );
        return;
      }
      setNutritionFoodId(candidate?.persisted ? candidate.id ?? null : null);
      setNutritionFacts(facts);
      setFlow('nutrition-facts');
    } catch (error) {
      Alert.alert(
        'Barcode belum tersedia',
        error instanceof Error
          ? error.message
          : 'Coba masukkan angka dari label kemasan.',
      );
    }
  };
  const submitNutritionManualLabel = (
    input: Parameters<typeof createFactsFromManualLabel>[0],
  ) => {
    setNutritionFoodId(null);
    setNutritionFacts(createFactsFromManualLabel(input));
    setFlow('nutrition-facts');
  };
  const confirmNutritionFacts = async (facts: NutritionFacts) => {
    setNutritionSyncError(null);
    const localEntryId = `local-${Date.now()}`;
    const localEntry: NutritionDiaryEntry = {
      id: localEntryId,
      mealLabel: 'Camilan',
      loggedAtLabel: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      servings: 1,
      facts,
      syncStatus: 'waiting-to-sync',
    };
    setNutritionEntries(current => [localEntry, ...current]);
    const hasCompleteNutrition = Object.values(facts.nutrients).every(
      value => value !== null,
    );
    if (!hasCompleteNutrition) {
      // Keep incomplete label data local to this session; never turn unknowns into zeroes on the server.
      setNutritionEntries(current =>
        current.map(entry =>
          entry.id === localEntryId
            ? { ...entry, syncStatus: 'session-only' }
            : entry,
        ),
      );
      setFlow('nutrition-diary');
      return;
    }
    try {
      let foodId = nutritionFoodId;
      if (!foodId) {
        const customFood = await nutritionApi.createCustomFood(
          {
            name: facts.foodName,
            serving: { amount: 1, unit: 'serving', label: facts.servingLabel },
            nutritionPerServing: {
              caloriesKcal: facts.nutrients.calories ?? 0,
              proteinG: facts.nutrients.proteinGrams ?? 0,
              carbohydrateG: facts.nutrients.carbohydrateGrams ?? 0,
              fatG: facts.nutrients.fatGrams ?? 0,
              fiberG: facts.nutrients.fiberGrams ?? 0,
              sugarG: facts.nutrients.sugarGrams ?? 0,
              sodiumMg: facts.nutrients.sodiumMilligrams ?? 0,
            },
          },
          { idempotencyKey: `nutrition-food-${Date.now()}` },
        );
        foodId = customFood.id;
      }
      await nutritionApi.createFoodEntry(
        {
          foodItemId: foodId,
          mealType: 'snack',
          consumedAt: new Date().toISOString(),
          portionAmount: 1,
          portionUnit: 'serving',
          calories: facts.nutrients.calories ?? 0,
          proteinGrams: facts.nutrients.proteinGrams ?? undefined,
          carbohydrateGrams: facts.nutrients.carbohydrateGrams ?? undefined,
          fatGrams: facts.nutrients.fatGrams ?? undefined,
          fiberGrams: facts.nutrients.fiberGrams ?? undefined,
          sodiumMilligrams: facts.nutrients.sodiumMilligrams ?? undefined,
          source: facts.status === 'verified' ? 'barcode' : 'custom',
          confidence: facts.status === 'verified' ? 1 : 0.5,
        },
        { idempotencyKey: `nutrition-entry-${Date.now()}` },
      );
      setNutritionEntries(current =>
        current.map(entry =>
          entry.id === localEntryId
            ? { ...entry, syncStatus: 'server-confirmed' }
            : entry,
        ),
      );
      nutritionDailyResource.reload();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Periksa koneksi lalu coba sinkronkan lagi.';
      setNutritionSyncError(message);
      setNutritionEntries(current =>
        current.map(entry =>
          entry.id === localEntryId
            ? { ...entry, syncStatus: 'sync-failed' }
            : entry,
        ),
      );
    }
    setFlow('nutrition-diary');
  };
  const updateNutritionEntry = async (
    entryId: string,
    update: NutritionDiaryEntryUpdate,
  ) => {
    setNutritionSyncError(null);
    setNutritionEntries(current =>
      current.map(entry =>
        entry.id === entryId
          ? { ...entry, syncStatus: 'waiting-to-sync' }
          : entry,
      ),
    );
    try {
      const updated = await nutritionApi.updateFoodEntry(
        entryId,
        {
          mealType: update.mealType,
          portionAmount: update.servings,
        },
        { idempotencyKey: `nutrition-update-${entryId}-${Date.now()}` },
      );
      const mapped = toNutritionDiaryEntry(updated);
      if (!mapped) throw new Error('Server mengembalikan catatan yang tidak valid.');
      setNutritionEntries(current =>
        current.map(entry => (entry.id === entryId ? mapped : entry)),
      );
      nutritionDailyResource.reload();
    } catch (error) {
      setNutritionEntries(current =>
        current.map(entry =>
          entry.id === entryId ? { ...entry, syncStatus: 'sync-failed' } : entry,
        ),
      );
      throw error;
    }
  };
  const deleteNutritionEntry = async (entryId: string) => {
    setNutritionSyncError(null);
    await nutritionApi.deleteFoodEntry(entryId, {
      idempotencyKey: `nutrition-delete-${entryId}-${Date.now()}`,
    });
    setNutritionEntries(current =>
      current.filter(entry => entry.id !== entryId),
    );
    nutritionDailyResource.reload();
  };
  const mainScreen =
    activeTab === 'home' ? (
      <HomeScreen
        error={bootstrap.error?.message}
        loading={bootstrap.loading}
        onRetry={bootstrap.reload}
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
        currentPlan={bootstrap.data?.currentPlan}
        error={bootstrap.error?.message}
        loading={bootstrap.loading}
        onAssessment={openAssessment}
        onRetry={bootstrap.reload}
        onWorkout={openLesson}
        onFoodScan={openNutritionScan}
        onNutritionDiary={() => setFlow('nutrition-diary')}
        recommendedLesson={recommendedLesson}
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
        onExportData={
          auth.configured
            ? async () => {
                const data = await nutritionApi.getPrivacyExport();
                await sharePrivacyExport(data);
              }
            : undefined
        }
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
        versionLabel="PocketTrainer beta · v0.3.0"
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
        error={assessmentError}
        loading={assessmentLoading}
        onBack={() => setFlow(activeTab === 'coach' ? 'main' : 'schedule')}
        onContinue={() => prepareAssessment().catch(() => undefined)}
        onRetry={() => prepareAssessment().catch(() => undefined)}
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
        mode={origin}
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
          origin === 'assessment' || selectedLesson.target.type === 'reps'
            ? 'repetitions'
            : 'duration_ms'
        }
        targetValue={
          origin === 'assessment'
            ? 3
            : selectedLesson.target.type === 'reps'
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
          trackingEligible:
            sessionSummary.coachingMode === 'posture_scored' &&
            sessionSummary.confidenceEligible,
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
  else if (flow === 'assessment-result' && assessmentCompletion)
    screen = (
      <AssessmentResultScreen
        completion={assessmentCompletion}
        onDone={() => {
          setActiveTab('coach');
          setFlow('main');
        }}
      />
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
  else if (flow === 'nutrition-scan')
    screen = (
      <ScanFoodScreen
        onBack={() => setFlow('main')}
        onOpenDiary={() => setFlow('nutrition-diary')}
        onSubmitBarcode={barcode =>
          submitNutritionBarcode(barcode).catch(() => undefined)
        }
        onSubmitManualLabel={submitNutritionManualLabel}
      />
    );
  else if (flow === 'nutrition-facts' && nutritionFacts)
    screen = (
      <NutritionFactsScreen
        facts={nutritionFacts}
        onBack={() => setFlow('nutrition-scan')}
        onConfirm={confirmNutritionFacts}
        onEdit={() => setFlow('nutrition-scan')}
      />
    );
  else if (flow === 'nutrition-diary')
    screen = (
      <NutritionDiaryScreen
        dailySummary={toNutritionDiarySummary(nutritionDailyResource.data)}
        entries={nutritionEntries}
        isLoading={nutritionDailyResource.loading}
        loadError={nutritionDailyResource.error?.message}
        syncError={nutritionSyncError}
        onAddFood={openNutritionScan}
        onBack={() => setFlow('main')}
        onDeleteEntry={deleteNutritionEntry}
        onRetry={nutritionDailyResource.reload}
        onUpdateEntry={updateNutritionEntry}
      />
    );
  else
    screen = (
      <>
        <View style={styles.content}>
          <TabSceneTransition activeTab={activeTab}>
            {mainScreen}
          </TabSceneTransition>
        </View>
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
  const measurement = createWorkoutMeasurement(summary);
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
          totalReps: measurement.totalReps,
          validReps: measurement.validReps,
          ...(postureEligible ? { formScore: summary.formScore! } : {}),
          completionScore,
          controlScore: postureEligible ? Math.round(summary.formScore!) : 0,
          consistencyScore: postureEligible
            ? Math.round((summary.averageTrackingConfidence ?? 0) * 100)
            : 0,
          trackingEligible: postureEligible,
          durationMs: measurement.durationMs,
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
