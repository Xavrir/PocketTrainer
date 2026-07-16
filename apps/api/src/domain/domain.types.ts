export type LocalizedText = {
  id: string;
  en: string;
};

export type Profile = {
  displayName: string;
  locale: 'id' | 'en';
  timezone: string;
  primaryGoal: 'build_strength' | 'improve_mobility' | 'build_consistency' | 'reduce_stress';
  experienceLevel: 'foundation' | 'beginner' | 'intermediate';
  equipment: string[];
  limitations: string[];
  schedule: {
    days: string[];
    durationMinutes: number;
  };
  onboardingCompleted: boolean;
  updatedAt: string;
};

export type Consent = {
  type: 'privacy' | 'camera_processing' | 'fitness_guidance' | 'analytics';
  granted: boolean;
  version: string;
  updatedAt: string;
};

export type ExerciseDefinition = {
  id: string;
  exerciseKey: string;
  version: number;
  scoringVersion: string;
  poseModelVersion: string;
  name: LocalizedText;
  category: 'strength' | 'yoga' | 'mobility';
  mode: 'repetition' | 'hold';
  cameraView: 'front' | 'side';
  contentUrl: string;
};

export type Lesson = {
  id: string;
  unitId: string;
  exerciseDefinitionId: string;
  title: LocalizedText;
  summary: LocalizedText;
  order: number;
  target: { type: 'reps' | 'seconds'; value: number };
  xpReward: number;
  requirements: {
    minimumLevel: number;
    prerequisiteLessonIds: string[];
    requiredMasteryKeys: string[];
    requiredEquipment: string[];
  };
};

export type Unit = {
  id: string;
  courseId: string;
  title: LocalizedText;
  order: number;
  lessons: Lesson[];
};

export type Course = {
  id: string;
  trackId: string;
  slug: string;
  title: LocalizedText;
  description: LocalizedText;
  accent: string;
  order: number;
  units: Unit[];
};

export type Track = {
  id: string;
  slug: 'strength' | 'yoga' | 'mobility';
  title: LocalizedText;
  description: LocalizedText;
  order: number;
  courses: Course[];
};

export type Catalog = {
  version: number;
  publishedAt: string;
  contentBaseUrl: string;
  exercises: ExerciseDefinition[];
  tracks: Track[];
};

export type SkillMastery = {
  exerciseKey: string;
  bestFormScore: number;
  qualifyingSessions: number;
  mastered: boolean;
  restricted: boolean;
  updatedAt: string;
};

export type Progress = {
  xp: {
    total: number;
    today: number;
    dailyCap: number;
    level: number;
    currentLevelXp: number;
    nextLevelXp: number;
  };
  streak: {
    current: number;
    longest: number;
    todayStatus: 'active' | 'protected' | 'open';
  };
  completedLessonIds: string[];
  mastery: SkillMastery[];
  achievements: Array<{ key: string; unlockedAt: string }>;
};

export type Assessment = {
  id: string;
  status: 'in_progress' | 'completed';
  assessmentVersion: string;
  startedAt: string;
  completedAt?: string;
  result?: AssessmentResult;
};

export type AssessmentResult = {
  lowerBodyControl: number;
  upperBodyControl: number;
  balance: number;
  mobility: number;
  coreStability: number;
  recommendedLevel: 'foundation' | 'beginner' | 'intermediate';
  trackingEligible: boolean;
  restrictions: string[];
};

export type WorkoutPlan = {
  id: string;
  revision: number;
  status: 'active';
  generatedAt: string;
  reason: LocalizedText;
  lessonIds: string[];
};

export type ExerciseResultInput = {
  clientResultId: string;
  exerciseDefinitionId: string;
  exerciseDefinitionVersion: number;
  scoringVersion: string;
  poseModelVersion: string;
  setNumber: number;
  totalReps: number;
  validReps: number;
  formScore?: number;
  completionScore: number;
  controlScore: number;
  consistencyScore: number;
  mainFeedbackCode?: string;
  trackingEligible: boolean;
  durationMs: number;
};

export type WorkoutSession = {
  id: string;
  lessonId: string;
  status: 'in_progress' | 'completed' | 'stopped_for_safety';
  startedAt: string;
  completedAt?: string;
  results: ExerciseResultInput[];
  summary?: WorkoutCompletion;
};

export type WorkoutCompletion = {
  xpAwarded: number;
  xpCapped: boolean;
  totalXp: number;
  level: number;
  masteryChanges: SkillMastery[];
  newlyUnlockedLessonIds: string[];
  planRevision: number;
  progressionSuppressed: boolean;
  safetyMessage?: LocalizedText;
};

export type IdempotencyResult<T> = {
  replayed: boolean;
  value: T;
};

export type Bootstrap = {
  serverTime: string;
  profile: Profile | null;
  consents: Consent[];
  catalog: Catalog;
  progress: Progress;
  currentPlan: WorkoutPlan | null;
};

export type Identity = {
  id: string;
  authSubject: string;
  roles: string[];
};
