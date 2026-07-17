import { colors } from '../design/tokens';
import { courseCopy, normalizeLocale, resolveCopy } from './localization';
import type {
  Course,
  CourseCatalogView,
  CourseExerciseDefinition,
  CourseLocale,
  CourseLesson,
  CourseLessonAccess,
  CourseLessonReason,
  CourseLessonState,
  CourseLessonTarget,
  CourseTrack,
  CourseTrackKey,
} from './types';

type UnknownRecord = Record<string, unknown>;

type MasterySnapshot = Readonly<{
  score: number;
  mastered: boolean;
  restricted: boolean;
}>;

type ProgressSnapshot = Readonly<{
  accountLevel: number;
  completedLessonIds: ReadonlySet<string>;
  mastery: ReadonlyMap<string, MasterySnapshot>;
  equipment: ReadonlySet<string>;
  restrictions: ReadonlySet<string>;
}>;

type NormalizedRequirements = Readonly<{
  minimumLevel: number;
  prerequisiteLessonIds: readonly string[];
  mastery: readonly Readonly<{
    exerciseKey: string;
    minimumScore: number | null;
  }>[];
  equipment: readonly string[];
  capabilityCount: number;
  blockedByRestrictions: readonly string[];
}>;

const TRACK_KEYS = new Set<CourseTrackKey>(['strength', 'yoga', 'mobility']);

// Only movements with validated, tested posture scoring belong here. Other
// catalog movements remain playable as clearly labelled guided practice.
const POSTURE_SCORING_EXERCISE_KEYS = new Set(['body_squat']);

const TRACK_ACCENTS: Readonly<Record<CourseTrackKey, string>> = {
  strength: colors.coral,
  yoga: colors.violet,
  mobility: colors.mint,
};

const TRACK_FALLBACK_TITLES: Readonly<Record<CourseTrackKey, string>> = {
  strength: courseCopy.trackLabels.strength.id,
  yoga: courseCopy.trackLabels.yoga.id,
  mobility: courseCopy.trackLabels.mobility.id,
};

const EQUIPMENT_LABELS: Readonly<
  Record<string, Readonly<{ id: string; en: string }>>
> = {
  none: { id: 'Tanpa alat', en: 'No equipment' },
  bench_or_wall: { id: 'Bangku atau dinding', en: 'Bench or wall' },
  chair: { id: 'Kursi', en: 'Chair' },
  mat: { id: 'Matras', en: 'Mat' },
  resistance_band: { id: 'Resistance band', en: 'Resistance band' },
  dumbbells: { id: 'Dumbbell', en: 'Dumbbells' },
};

export function adaptCourseCatalog(
  payload: unknown,
  options: Readonly<{ locale?: CourseLocale }> = {},
): CourseCatalogView {
  const root = toRecord(payload);
  if (!root) {
    throw new Error('Respons catalog tidak valid.');
  }
  const catalog = toRecord(root.catalog) ?? root;
  const locale =
    options.locale ??
    normalizeLocale(toRecord(root.profile)?.locale ?? catalog.locale);
  const progress = readProgress(root);
  const accessByLesson =
    toRecord(root.lessonAccess) ?? toRecord(root.lessonStates) ?? {};
  const exercises = indexExercises(catalog.exercises);

  const tracks = toArray(catalog.tracks)
    .map((track, index) =>
      adaptTrack(track, index, progress, accessByLesson, exercises, locale),
    )
    .filter((track): track is CourseTrack => track !== null)
    .sort(byOrder);

  if (tracks.length === 0) {
    throw new Error(
      'Catalog tidak memuat jalur Strength, Yoga, atau Mobility.',
    );
  }

  const allLessons = tracks.flatMap(track =>
    track.units.flatMap(unit => unit.lessons),
  );

  return Object.freeze({
    version: readCatalogVersion(catalog),
    locale,
    accountLevel: progress.accountLevel,
    exercises: Object.freeze(
      [...new Set([...exercises.values()])].map(exercise =>
        adaptExerciseDefinition(exercise, locale),
      ),
    ),
    completedLessonCount: allLessons.filter(
      lesson => lesson.access.state === 'completed',
    ).length,
    totalLessonCount: allLessons.length,
    tracks: Object.freeze(tracks),
  });
}

export function findCourseLesson(
  catalog: CourseCatalogView | null,
  lessonId: string | null | undefined,
): CourseLesson | null {
  if (!catalog || !lessonId) return null;
  return (
    catalog.tracks
      .flatMap(track => track.units)
      .flatMap(unit => unit.lessons)
      .find(lesson => lesson.id === lessonId) ?? null
  );
}

export function formatEquipment(
  equipment: readonly string[],
  locale: CourseLocale = 'id',
): string {
  if (equipment.length === 0 || equipment.every(item => item === 'none')) {
    return resolveEquipmentCopy('none', locale);
  }
  return equipment
    .filter(item => item !== 'none')
    .map(item =>
      EQUIPMENT_LABELS[item]
        ? resolveCopy(EQUIPMENT_LABELS[item]!, locale)
        : humanizeKey(item),
    )
    .join(', ');
}

export function formatLessonTarget(
  target: CourseLessonTarget,
  locale: CourseLocale = 'id',
): string {
  if (target.value === null || target.type === 'unknown') {
    return resolveCopy(courseCopy.target.unknown, locale);
  }
  return target.type === 'reps'
    ? `${target.value} ${resolveCopy(courseCopy.target.repetitions, locale)}`
    : `${target.value} ${resolveCopy(courseCopy.target.seconds, locale)}`;
}

function resolveEquipmentCopy(value: 'none', locale: CourseLocale): string {
  return resolveCopy(courseCopy.target.noEquipment, locale);
}

function adaptTrack(
  value: unknown,
  fallbackOrder: number,
  progress: ProgressSnapshot,
  accessByLesson: UnknownRecord,
  exercises: ReadonlyMap<string, UnknownRecord>,
  locale: CourseLocale,
): CourseTrack | null {
  const track = toRecord(value);
  if (!track) return null;
  const keyCandidate = readString(track, ['slug', 'key']);
  if (!keyCandidate || !TRACK_KEYS.has(keyCandidate as CourseTrackKey)) {
    return null;
  }
  const key = keyCandidate as CourseTrackKey;
  const courses = toArray(track.courses).map(toRecord).filter(isRecord);
  const adaptedCourses = courses
    .map((course, courseIndex): Course | null => {
      const courseId = readString(course, ['id']) ?? `${key}-course`;
      const courseTitle =
        readLocalized(course.title, locale) ?? TRACK_FALLBACK_TITLES[key];
      const courseDescription = readLocalized(course.description, locale) ?? '';
      const courseMinimumLevel =
        readNumber(course, ['minimumAccountLevel']) ?? 0;
      const coursePublishingState =
        readString(course, ['publishingState']) ?? 'published';
      const units = toArray(course.units).map((unit, unitIndex) => {
        const record = toRecord(unit);
        if (!record) return null;
        const unitTitle =
          readLocalized(record.title, locale) ?? `Unit ${unitIndex + 1}`;
        const lessons = toArray(record.lessons)
          .map((lesson, lessonIndex) =>
            adaptLesson({
              value: lesson,
              fallbackOrder: lessonIndex,
              trackKey: key,
              trackTitle:
                readLocalized(track.title, locale) ??
                TRACK_FALLBACK_TITLES[key],
              courseId,
              courseTitle,
              unitTitle,
              courseMinimumLevel,
              coursePublishingState,
              progress,
              accessByLesson,
              exercises,
              locale,
            }),
          )
          .filter((lesson): lesson is CourseLesson => lesson !== null)
          .sort(byOrder);
        return Object.freeze({
          id:
            readString(record, ['id', 'key']) ??
            `${courseId}-unit-${unitIndex + 1}`,
          title: unitTitle,
          order: readNumber(record, ['order']) ?? unitIndex + 1,
          lessons: Object.freeze(lessons),
        });
      });
      const usableUnits = units
        .filter(isPresent)
        .filter(unit => unit.lessons.length > 0)
        .sort(byOrder);
      if (usableUnits.length === 0) return null;
      return Object.freeze({
        id: courseId,
        key: readString(course, ['key', 'slug']) ?? courseId,
        title: courseTitle,
        description: courseDescription,
        order: readNumber(course, ['order']) ?? courseIndex + 1,
        minimumAccountLevel: courseMinimumLevel,
        publishingState: coursePublishingState,
        units: Object.freeze(usableUnits),
      });
    })
    .filter((course): course is Course => course !== null)
    .sort(byOrder);

  const units = adaptedCourses.flatMap(course => course.units);

  if (units.length === 0) return null;

  const firstCourse = courses[0];
  return Object.freeze({
    id: readString(track, ['id']) ?? key,
    key,
    title: readLocalized(track.title, locale) ?? TRACK_FALLBACK_TITLES[key],
    description: readLocalized(track.description, locale) ?? '',
    accent:
      (firstCourse && readString(firstCourse, ['accent'])) ??
      TRACK_ACCENTS[key],
    order: readNumber(track, ['order']) ?? fallbackOrder + 1,
    courses: Object.freeze(adaptedCourses),
    units: Object.freeze(units),
  });
}

function adaptLesson(
  input: Readonly<{
    value: unknown;
    fallbackOrder: number;
    trackKey: CourseTrackKey;
    trackTitle: string;
    courseId: string;
    courseTitle: string;
    unitTitle: string;
    courseMinimumLevel: number;
    coursePublishingState: string;
    progress: ProgressSnapshot;
    accessByLesson: UnknownRecord;
    exercises: ReadonlyMap<string, UnknownRecord>;
    locale: CourseLocale;
  }>,
): CourseLesson | null {
  const lesson = toRecord(input.value);
  if (!lesson) return null;
  const id = readString(lesson, ['id', 'key']);
  if (!id) return null;

  const requirements = readRequirements(
    lesson.requirements,
    input.courseMinimumLevel,
  );
  const lessonExercises = toArray(lesson.exercises)
    .map(toRecord)
    .filter(isRecord);
  const lessonExercise = lessonExercises[0] ?? null;
  const definitionId = readString(lesson, ['exerciseDefinitionId']);
  const definition = definitionId
    ? input.exercises.get(definitionId) ?? null
    : null;
  const exerciseKey =
    (lessonExercise && readString(lessonExercise, ['exerciseKey'])) ??
    (definition && readString(definition, ['exerciseKey'])) ??
    'unknown';
  const authoritativeAccess = input.accessByLesson[id];
  const access =
    readAuthoritativeAccess(authoritativeAccess) ??
    deriveAccess({
      id,
      publishingState: readString(lesson, ['publishingState']) ?? 'published',
      coursePublishingState: input.coursePublishingState,
      requirements,
      progress: input.progress,
    });

  return Object.freeze({
    id,
    key: readString(lesson, ['key']) ?? id,
    trackKey: input.trackKey,
    trackTitle: input.trackTitle,
    courseId: input.courseId,
    courseTitle: input.courseTitle,
    unitTitle: input.unitTitle,
    title: readLocalized(lesson.title, input.locale) ?? 'Pelajaran tanpa judul',
    description:
      readLocalized(lesson.summary, input.locale) ??
      readLocalized(lesson.description, input.locale) ??
      '',
    order: readNumber(lesson, ['order']) ?? input.fallbackOrder + 1,
    exerciseKey,
    exerciseName:
      (definition && readLocalized(definition.name, input.locale)) ??
      humanizeKey(exerciseKey),
    exerciseDefinitionId: definitionId,
    exerciseDefinition: definition
      ? adaptExerciseDefinition(definition, input.locale)
      : null,
    target: readTarget(lesson, lessonExercise),
    coaching: readCoaching(definition, readTarget(lesson, lessonExercise)),
    equipment: Object.freeze(requirements.equipment),
    durationMinutes: readNumber(lesson, ['estimatedMinutes']),
    xp: readNumber(lesson, ['xpReward', 'baseXp']) ?? 0,
    access,
  });
}

function readTarget(
  lesson: UnknownRecord,
  exercise: UnknownRecord | null,
): CourseLessonTarget {
  const target = toRecord(lesson.target);
  const directType = target ? readString(target, ['type']) : null;
  if (target && (directType === 'reps' || directType === 'seconds')) {
    return Object.freeze({
      type: directType,
      value: readNumber(target, ['value']),
      sets: exercise ? readNumber(exercise, ['sets']) : null,
    });
  }
  if (exercise) {
    const repetitions = readNumber(exercise, ['targetRepetitions']);
    const holdDurationMs = readNumber(exercise, ['targetHoldDurationMs']);
    if (repetitions !== null) {
      return Object.freeze({
        type: 'reps',
        value: repetitions,
        sets: readNumber(exercise, ['sets']),
      });
    }
    if (holdDurationMs !== null) {
      return Object.freeze({
        type: 'seconds',
        value: Math.round(holdDurationMs / 1000),
        sets: readNumber(exercise, ['sets']),
      });
    }
  }
  return Object.freeze({ type: 'unknown', value: null, sets: null });
}

function readCoaching(
  definition: UnknownRecord | null,
  target: CourseLessonTarget,
): CourseLesson['coaching'] {
  const exerciseKey = definition
    ? readString(definition, ['exerciseKey']) ?? 'unknown'
    : 'unknown';
  const rawMode = definition ? readString(definition, ['mode']) : null;
  const mode: CourseLesson['coaching']['mode'] =
    rawMode === 'repetition' || rawMode === 'hold' ? rawMode : 'unknown';
  const scoringSupported =
    definition !== null &&
    mode !== 'unknown' &&
    POSTURE_SCORING_EXERCISE_KEYS.has(exerciseKey);
  return Object.freeze({
    mode,
    target,
    repetitionSource:
      mode !== 'repetition'
        ? 'none'
        : scoringSupported
        ? 'native'
        : 'user_confirmed',
    scoringSupported,
    playable:
      definition !== null && target.value !== null && target.type !== 'unknown',
  });
}

function adaptExerciseDefinition(
  value: UnknownRecord,
  locale: CourseLocale,
): CourseExerciseDefinition {
  const rawMode = readString(value, ['mode']);
  const rawCameraView = readString(value, ['cameraView']);
  const category = readString(value, ['category']);
  return Object.freeze({
    id: readString(value, ['id']) ?? 'unknown',
    exerciseKey: readString(value, ['exerciseKey']) ?? 'unknown',
    version: readNumber(value, ['version']),
    scoringVersion: readString(value, ['scoringVersion']),
    poseModelVersion: readString(value, ['poseModelVersion']),
    name:
      readLocalized(value.name, locale) ??
      humanizeKey(readString(value, ['exerciseKey']) ?? 'unknown'),
    category:
      category === 'strength' || category === 'yoga' || category === 'mobility'
        ? category
        : null,
    mode: rawMode === 'repetition' || rawMode === 'hold' ? rawMode : 'unknown',
    cameraView:
      rawCameraView === 'front' ||
      rawCameraView === 'side' ||
      rawCameraView === 'either'
        ? rawCameraView
        : 'unknown',
    contentUrl: readString(value, ['contentUrl']),
  });
}

function readRequirements(
  value: unknown,
  courseMinimumLevel: number,
): NormalizedRequirements {
  const requirements = toRecord(value) ?? {};
  const masteryObjects = toArray(requirements.mastery)
    .map(toRecord)
    .filter(isRecord)
    .map(item => ({
      exerciseKey: readString(item, ['exerciseKey']) ?? 'unknown',
      minimumScore: readNumber(item, ['minimumMasteryScore']),
    }));
  const masteryKeys = readStringArray(requirements.requiredMasteryKeys).map(
    exerciseKey => ({ exerciseKey, minimumScore: null }),
  );
  return Object.freeze({
    minimumLevel: Math.max(
      courseMinimumLevel,
      readNumber(requirements, ['minimumLevel', 'minimumAccountLevel']) ?? 0,
    ),
    prerequisiteLessonIds: readStringArray(requirements.prerequisiteLessonIds),
    mastery: Object.freeze([...masteryObjects, ...masteryKeys]),
    equipment: Object.freeze([
      ...readStringArray(requirements.requiredEquipment),
      ...readStringArray(requirements.equipment),
    ]),
    capabilityCount: toArray(requirements.capabilities).length,
    blockedByRestrictions: readStringArray(
      requirements.blockedByRestrictionTags,
    ),
  });
}

function readProgress(root: UnknownRecord): ProgressSnapshot {
  const progress = toRecord(root.progress) ?? {};
  const xp = toRecord(progress.xp);
  const accountLevel =
    (xp && readNumber(xp, ['level'])) ??
    readNumber(progress, ['accountLevel']) ??
    0;
  const masteryItems = [
    ...toArray(progress.mastery),
    ...toArray(progress.skillMastery),
  ];
  const mastery = new Map<string, MasterySnapshot>();
  masteryItems
    .map(toRecord)
    .filter(isRecord)
    .forEach(item => {
      const key = readString(item, ['exerciseKey']);
      if (!key) return;
      const score = readNumber(item, ['bestFormScore', 'masteryScore']) ?? 0;
      mastery.set(
        key,
        Object.freeze({
          score,
          mastered:
            readBoolean(item, ['mastered']) ??
            readString(item, ['level']) === 'mastered',
          restricted: readBoolean(item, ['restricted']) ?? false,
        }),
      );
    });
  const profile = toRecord(root.profile);
  return Object.freeze({
    accountLevel,
    completedLessonIds: new Set(readStringArray(progress.completedLessonIds)),
    mastery,
    equipment: new Set(profile ? readStringArray(profile.equipment) : []),
    restrictions: new Set(
      profile ? readStringArray(profile.exerciseRestrictions) : [],
    ),
  });
}

function deriveAccess(
  input: Readonly<{
    id: string;
    publishingState: string;
    coursePublishingState: string;
    requirements: NormalizedRequirements;
    progress: ProgressSnapshot;
  }>,
): CourseLessonAccess {
  if (input.progress.completedLessonIds.has(input.id)) {
    return Object.freeze({
      state: 'completed',
      launchAllowed: true,
      reasons: Object.freeze([]),
    });
  }

  const reasons: CourseLessonReason[] = [];
  if (
    input.publishingState !== 'published' ||
    input.coursePublishingState !== 'published'
  ) {
    reasons.push(reason('CONTENT_NOT_PUBLISHED', 'Konten belum diterbitkan.'));
  }
  if (input.progress.accountLevel < input.requirements.minimumLevel) {
    reasons.push(
      reason(
        'ACCOUNT_LEVEL_REQUIRED',
        `Butuh level ${input.requirements.minimumLevel}.`,
        input.progress.accountLevel,
        input.requirements.minimumLevel,
      ),
    );
  }
  input.requirements.prerequisiteLessonIds.forEach(prerequisiteId => {
    if (!input.progress.completedLessonIds.has(prerequisiteId)) {
      reasons.push(
        reason(
          'PREREQUISITE_LESSON_REQUIRED',
          'Selesaikan pelajaran prasyarat.',
        ),
      );
    }
  });
  input.requirements.mastery.forEach(requirement => {
    const mastery = input.progress.mastery.get(requirement.exerciseKey);
    const minimumScore = requirement.minimumScore;
    const scoreSatisfied =
      minimumScore === null || (mastery?.score ?? 0) >= minimumScore;
    if (!mastery?.mastered || mastery.restricted || !scoreSatisfied) {
      reasons.push(
        reason(
          'MASTERY_REQUIRED',
          minimumScore === null
            ? `Butuh penguasaan ${humanizeKey(requirement.exerciseKey)}.`
            : `Butuh penguasaan ${humanizeKey(
                requirement.exerciseKey,
              )} ${minimumScore}.`,
          mastery?.score ?? 0,
          minimumScore,
        ),
      );
    }
  });
  input.requirements.equipment.forEach(equipment => {
    if (equipment !== 'none' && !input.progress.equipment.has(equipment)) {
      reasons.push(
        reason(
          'EQUIPMENT_REQUIRED',
          `Butuh ${
            EQUIPMENT_LABELS[equipment]
              ? resolveCopy(EQUIPMENT_LABELS[equipment]!, 'id')
              : humanizeKey(equipment)
          }.`,
        ),
      );
    }
  });
  if (input.requirements.capabilityCount > 0) {
    reasons.push(
      reason(
        'ASSESSMENT_CAPABILITY_REQUIRED',
        'Butuh hasil asesmen yang memenuhi syarat.',
      ),
    );
  }
  input.requirements.blockedByRestrictions.forEach(restriction => {
    if (input.progress.restrictions.has(restriction)) {
      reasons.push(
        reason('ACTIVE_RESTRICTION', 'Dikunci oleh batasan gerak aktif.'),
      );
    }
  });

  const hasHardLock = reasons.some(item =>
    [
      'CONTENT_NOT_PUBLISHED',
      'PREREQUISITE_LESSON_REQUIRED',
      'ACTIVE_RESTRICTION',
    ].includes(item.code),
  );
  return Object.freeze({
    state:
      reasons.length === 0 ? 'available' : hasHardLock ? 'locked' : 'gated',
    launchAllowed: reasons.length === 0,
    reasons: Object.freeze(reasons),
  });
}

function readAuthoritativeAccess(value: unknown): CourseLessonAccess | null {
  if (typeof value === 'string') {
    const state = normalizeState(value);
    if (!state) return null;
    const code = reasonCodeForStateValue(value);
    return Object.freeze({
      state,
      launchAllowed: state === 'available' || state === 'completed',
      reasons: Object.freeze(
        state === 'available' || state === 'completed'
          ? []
          : [reason(code, messageForStateValue(value))],
      ),
    });
  }
  const access = toRecord(value);
  if (!access) return null;
  const rawState = readString(access, ['state']);
  const state = rawState ? normalizeState(rawState) : null;
  if (!state) return null;
  const reasons = toArray(access.reasons)
    .map(toRecord)
    .filter(isRecord)
    .map(item => {
      const code = readString(item, ['code']) ?? 'LOCKED';
      return reason(
        code,
        messageForReason(code, item),
        readNumber(item, ['currentValue']),
        readNumber(item, ['requiredValue']),
      );
    });
  if (state !== 'available' && state !== 'completed' && reasons.length === 0) {
    reasons.push(
      reason(
        reasonCodeForStateValue(rawState ?? state),
        messageForStateValue(rawState ?? state),
      ),
    );
  }
  return Object.freeze({
    state,
    launchAllowed:
      readBoolean(access, ['launchAllowed']) ??
      (state === 'available' || state === 'completed'),
    reasons: Object.freeze(reasons),
  });
}

function normalizeState(value: string): CourseLessonState | null {
  if (value === 'completed' || value === 'done') return 'completed';
  if (value === 'available' || value === 'current') return 'available';
  if (value === 'gated' || value.startsWith('gated_')) return 'gated';
  if (value === 'locked_level' || value === 'locked_mastery') return 'gated';
  if (value === 'locked' || value.startsWith('locked_')) return 'locked';
  return null;
}

function messageForStateValue(value: string): string {
  if (value.includes('level')) return 'Level akun belum cukup.';
  if (value.includes('mastery')) return 'Penguasaan gerak belum cukup.';
  if (value.includes('equipment'))
    return 'Peralatan yang dibutuhkan belum tersedia.';
  if (value.includes('prerequisite')) return 'Selesaikan pelajaran prasyarat.';
  return 'Pelajaran belum dapat dibuka.';
}

function reasonCodeForStateValue(value: string): string {
  if (value.includes('level')) return 'ACCOUNT_LEVEL_REQUIRED';
  if (value.includes('mastery')) return 'MASTERY_REQUIRED';
  if (value.includes('equipment')) return 'EQUIPMENT_REQUIRED';
  if (value.includes('prerequisite')) return 'PREREQUISITE_LESSON_REQUIRED';
  if (value.includes('content') || value.includes('publish')) {
    return 'CONTENT_NOT_PUBLISHED';
  }
  return value.toUpperCase();
}

function messageForReason(code: string, value: UnknownRecord): string {
  const required = readNumber(value, ['requiredValue']);
  const reference = readString(value, ['reference']);
  switch (code) {
    case 'ACCOUNT_LEVEL_REQUIRED':
      return required === null
        ? 'Butuh level lebih tinggi.'
        : `Butuh level ${required}.`;
    case 'PREREQUISITE_LESSON_REQUIRED':
      return 'Selesaikan pelajaran prasyarat.';
    case 'MASTERY_REQUIRED':
      return required === null
        ? `Butuh penguasaan ${humanizeKey(reference ?? 'gerak')}.`
        : `Butuh penguasaan ${humanizeKey(reference ?? 'gerak')} ${required}.`;
    case 'EQUIPMENT_REQUIRED':
      return `Butuh ${
        EQUIPMENT_LABELS[reference ?? '']
          ? resolveCopy(EQUIPMENT_LABELS[reference ?? '']!, 'id')
          : humanizeKey(reference ?? 'peralatan')
      }.`;
    case 'ASSESSMENT_CAPABILITY_REQUIRED':
      return 'Butuh hasil asesmen yang memenuhi syarat.';
    case 'ACTIVE_RESTRICTION':
      return 'Dikunci oleh batasan gerak aktif.';
    case 'CONTENT_NOT_PUBLISHED':
      return 'Konten belum diterbitkan.';
    default:
      return 'Pelajaran belum dapat dibuka.';
  }
}

function reason(
  code: string,
  message: string,
  currentValue: number | null = null,
  requiredValue: number | null = null,
): CourseLessonReason {
  return Object.freeze({ code, message, currentValue, requiredValue });
}

function indexExercises(value: unknown): ReadonlyMap<string, UnknownRecord> {
  const map = new Map<string, UnknownRecord>();
  toArray(value)
    .map(toRecord)
    .filter(isRecord)
    .forEach(exercise => {
      const id = readString(exercise, ['id']);
      const key = readString(exercise, ['exerciseKey']);
      if (id) map.set(id, exercise);
      if (key) map.set(key, exercise);
    });
  return map;
}

function readCatalogVersion(catalog: UnknownRecord): string {
  const value = catalog.catalogVersion ?? catalog.version;
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : 'unknown';
}

function humanizeKey(value: string): string {
  if (!value || value === 'unknown') return 'Gerakan belum dicantumkan';
  const words = value.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function readLocalized(
  value: unknown,
  locale: CourseLocale = 'id',
): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  const localized = toRecord(value);
  if (!localized) return null;
  return readString(
    localized,
    locale === 'en' ? ['en', 'id', 'id-ID'] : ['id', 'id-ID', 'en'],
  );
}

function readString(
  value: UnknownRecord,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function readNumber(
  value: UnknownRecord,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
}

function readBoolean(
  value: UnknownRecord,
  keys: readonly string[],
): boolean | null {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'boolean') return candidate;
  }
  return null;
}

function readStringArray(value: unknown): string[] {
  return toArray(value).filter(
    (item): item is string => typeof item === 'string' && item.length > 0,
  );
}

function toRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: UnknownRecord | null): value is UnknownRecord {
  return value !== null;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function byOrder<T extends Readonly<{ order: number }>>(a: T, b: T): number {
  return a.order - b.order;
}
