export type CourseTrackKey = 'strength' | 'yoga' | 'mobility';

export type CourseLocale = 'id' | 'en';

export type CourseLessonState = 'completed' | 'available' | 'gated' | 'locked';

export type CourseLessonReason = Readonly<{
  code: string;
  message: string;
  currentValue: number | null;
  requiredValue: number | null;
}>;

export type CourseLessonAccess = Readonly<{
  state: CourseLessonState;
  launchAllowed: boolean;
  reasons: readonly CourseLessonReason[];
}>;

export type CourseLessonTarget = Readonly<{
  type: 'reps' | 'seconds' | 'unknown';
  value: number | null;
  sets: number | null;
}>;

export type CourseExerciseDefinition = Readonly<{
  id: string;
  exerciseKey: string;
  version: number | null;
  scoringVersion: string | null;
  poseModelVersion: string | null;
  name: string;
  category: CourseTrackKey | null;
  mode: 'repetition' | 'hold' | 'unknown';
  cameraView: 'front' | 'side' | 'either' | 'unknown';
  contentUrl: string | null;
}>;

export type CourseLessonCoaching = Readonly<{
  mode: 'repetition' | 'hold' | 'unknown';
  target: CourseLessonTarget;
  repetitionSource: 'native' | 'user_confirmed' | 'none';
  scoringSupported: boolean;
  playable: boolean;
}>;

export type CourseLesson = Readonly<{
  id: string;
  key: string;
  trackKey: CourseTrackKey;
  trackTitle: string;
  courseId: string;
  courseTitle: string;
  unitTitle: string;
  title: string;
  description: string;
  order: number;
  exerciseKey: string;
  exerciseName: string;
  exerciseDefinitionId: string | null;
  exerciseDefinition: CourseExerciseDefinition | null;
  target: CourseLessonTarget;
  coaching: CourseLessonCoaching;
  equipment: readonly string[];
  durationMinutes: number | null;
  xp: number;
  access: CourseLessonAccess;
}>;

export type CourseUnit = Readonly<{
  id: string;
  title: string;
  order: number;
  lessons: readonly CourseLesson[];
}>;

export type Course = Readonly<{
  id: string;
  key: string;
  title: string;
  description: string;
  order: number;
  minimumAccountLevel: number;
  publishingState: string;
  units: readonly CourseUnit[];
}>;

export type CourseTrack = Readonly<{
  id: string;
  key: CourseTrackKey;
  title: string;
  description: string;
  accent: string;
  order: number;
  courses: readonly Course[];
  /** Flattened compatibility view for existing launch-flow integrations. */
  units: readonly CourseUnit[];
}>;

export type CourseCatalogView = Readonly<{
  version: string;
  locale: CourseLocale;
  accountLevel: number;
  exercises: readonly CourseExerciseDefinition[];
  completedLessonCount: number;
  totalLessonCount: number;
  tracks: readonly CourseTrack[];
}>;

export type CourseCatalogState = Readonly<{
  catalog: CourseCatalogView | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}>;
