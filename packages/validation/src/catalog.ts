import type {
  AssessmentCapability,
  CourseCatalog,
  Equipment,
  ExerciseDefinition,
  Lesson,
  PublishingState,
  RestrictionTag,
  TrackKey,
} from "@pockettrainer/contracts";

import { isoDateTimeSchema, uuidSchema } from "./primitives.js";
import { createSchema, fail } from "./runtime-schema.js";

type UnknownRecord = Record<string, unknown>;

const TRACK_KEYS = new Set<TrackKey>(["strength", "yoga", "mobility"]);
const PUBLISHING_STATES = new Set<PublishingState>(["draft", "review", "published", "retired"]);
const EQUIPMENT = new Set<Equipment>([
  "none", "wall", "chair", "bench", "yoga_mat", "resistance_band", "dumbbell",
]);
const CAPABILITIES = new Set<AssessmentCapability>([
  "lower_body_control", "upper_body_control", "balance", "mobility", "core_stability",
]);
const RESTRICTIONS = new Set<RestrictionTag>([
  "knee_flexion", "wrist_loading", "shoulder_loading", "shoulder_overhead",
  "single_leg_balance", "spinal_flexion", "floor_transition",
]);

export const courseCatalogSchema = createSchema<CourseCatalog>((input) => {
  const catalog = record(input, "$");
  allowedKeys(catalog, ["catalogVersion", "schemaVersion", "publishedAt", "tracks"], "$");
  if (positiveInteger(catalog.schemaVersion, "$.schemaVersion") !== 1) {
    fail("$.schemaVersion", "only catalog schema version 1 is supported");
  }
  nonemptyString(catalog.catalogVersion, "$.catalogVersion");
  isoDateTimeSchema.parse(catalog.publishedAt);
  const tracks = array(catalog.tracks, "$.tracks");
  unique(tracks.map((track, index) => idOf(track, `$.tracks[${index}]`)), "$.tracks[].id");
  unique(tracks.map((track, index) => orderOf(track, `$.tracks[${index}]`)), "$.tracks[].order");
  unique(tracks.map((track, index) => keyOf(track, `$.tracks[${index}]`)), "$.tracks[].key");

  const lessons = new Map<string, Lesson>();
  for (const [trackIndex, trackInput] of tracks.entries()) {
    validateTrack(trackInput, `$.tracks[${trackIndex}]`, lessons);
  }
  validatePrerequisites(lessons);
  const typedCatalog = input as CourseCatalog;
  unique(
    typedCatalog.tracks.flatMap((track) => track.courses.map((course) => course.id)),
    "$.tracks[].courses[].id",
  );
  unique(
    typedCatalog.tracks.flatMap((track) =>
      track.courses.flatMap((course) => course.units.map((unit) => unit.id)),
    ),
    "$.tracks[].courses[].units[].id",
  );
  return typedCatalog;
});

function validateTrack(input: unknown, path: string, lessons: Map<string, Lesson>): void {
  const track = record(input, path);
  allowedKeys(track, ["id", "key", "title", "description", "order", "courses"], path);
  idOf(track, path);
  orderOf(track, path);
  const trackKey = keyOf(track, path);
  if (!TRACK_KEYS.has(trackKey as TrackKey)) {
    fail(`${path}.key`, "must be strength, yoga, or mobility");
  }
  localized(track.title, `${path}.title`);
  localized(track.description, `${path}.description`);
  const courses = array(track.courses, `${path}.courses`);
  unique(courses.map((course, index) => idOf(course, `${path}.courses[${index}]`)), `${path}.courses[].id`);
  unique(courses.map((course, index) => keyOf(course, `${path}.courses[${index}]`)), `${path}.courses[].key`);
  unique(courses.map((course, index) => orderOf(course, `${path}.courses[${index}]`)), `${path}.courses[].order`);
  for (const [courseIndex, course] of courses.entries()) {
    validateCourse(course, `${path}.courses[${courseIndex}]`, trackKey as TrackKey, lessons);
  }
}

function validateCourse(
  input: unknown,
  path: string,
  parentTrackKey: TrackKey,
  lessons: Map<string, Lesson>,
): void {
  const course = record(input, path);
  allowedKeys(course, [
    "id", "key", "trackKey", "title", "description", "order",
    "minimumAccountLevel", "publishingState", "units",
  ], path);
  idOf(course, path);
  keyOf(course, path);
  localized(course.title, `${path}.title`);
  localized(course.description, `${path}.description`);
  if (course.trackKey !== parentTrackKey) {
    fail(`${path}.trackKey`, "must match its parent track");
  }
  integer(course.minimumAccountLevel, `${path}.minimumAccountLevel`, 0, 1_000);
  const publishingState = publishing(course.publishingState, `${path}.publishingState`);
  const units = array(course.units, `${path}.units`);
  unique(units.map((unit, index) => idOf(unit, `${path}.units[${index}]`)), `${path}.units[].id`);
  unique(units.map((unit, index) => keyOf(unit, `${path}.units[${index}]`)), `${path}.units[].key`);
  unique(units.map((unit, index) => orderOf(unit, `${path}.units[${index}]`)), `${path}.units[].order`);
  for (const [unitIndex, unit] of units.entries()) {
    validateUnit(unit, `${path}.units[${unitIndex}]`, publishingState, lessons);
  }
}

function validateUnit(
  input: unknown,
  path: string,
  courseState: PublishingState,
  lessons: Map<string, Lesson>,
): void {
  const unit = record(input, path);
  allowedKeys(unit, ["id", "key", "title", "description", "order", "lessons"], path);
  idOf(unit, path);
  keyOf(unit, path);
  orderOf(unit, path);
  localized(unit.title, `${path}.title`);
  localized(unit.description, `${path}.description`);
  const lessonInputs = array(unit.lessons, `${path}.lessons`);
  unique(lessonInputs.map((lesson, index) => idOf(lesson, `${path}.lessons[${index}]`)), `${path}.lessons[].id`);
  unique(lessonInputs.map((lesson, index) => keyOf(lesson, `${path}.lessons[${index}]`)), `${path}.lessons[].key`);
  unique(lessonInputs.map((lesson, index) => orderOf(lesson, `${path}.lessons[${index}]`)), `${path}.lessons[].order`);
  for (const [lessonIndex, lessonInput] of lessonInputs.entries()) {
    const lesson = validateLesson(lessonInput, `${path}.lessons[${lessonIndex}]`);
    if (lesson.publishingState === "published" && courseState !== "published") {
      fail(`${path}.lessons[${lessonIndex}].publishingState`, "cannot be published inside an unpublished course");
    }
    if (lessons.has(lesson.id)) {
      fail(`${path}.lessons[${lessonIndex}].id`, "must be globally unique");
    }
    lessons.set(lesson.id, lesson);
  }
}

function validateLesson(input: unknown, path: string): Lesson {
  const lesson = record(input, path);
  allowedKeys(lesson, [
    "id", "key", "title", "description", "order", "estimatedMinutes",
    "baseXp", "publishingState", "requirements", "exercises",
  ], path);
  idOf(lesson, path);
  keyOf(lesson, path);
  orderOf(lesson, path);
  localized(lesson.title, `${path}.title`);
  localized(lesson.description, `${path}.description`);
  integer(lesson.estimatedMinutes, `${path}.estimatedMinutes`, 1, 180);
  integer(lesson.baseXp, `${path}.baseXp`, 1, 1_000);
  publishing(lesson.publishingState, `${path}.publishingState`);
  validateRequirements(lesson.requirements, `${path}.requirements`);
  const exercises = array(lesson.exercises, `${path}.exercises`);
  unique(exercises.map((exercise, index) => orderOf(exercise, `${path}.exercises[${index}]`)), `${path}.exercises[].order`);
  for (const [index, exerciseInput] of exercises.entries()) {
    const exercisePath = `${path}.exercises[${index}]`;
    const exercise = record(exerciseInput, exercisePath);
    allowedKeys(exercise, [
      "exerciseKey", "exerciseDefinitionVersion", "order", "targetRepetitions",
      "targetHoldDurationMs", "sets", "restAfterMs",
    ], exercisePath);
    nonemptyString(exercise.exerciseKey, `${exercisePath}.exerciseKey`);
    positiveInteger(exercise.exerciseDefinitionVersion, `${exercisePath}.exerciseDefinitionVersion`);
    integer(exercise.sets, `${exercisePath}.sets`, 1, 20);
    integer(exercise.restAfterMs, `${exercisePath}.restAfterMs`, 0, 600_000);
    const hasRepetitions = exercise.targetRepetitions !== undefined;
    const hasHold = exercise.targetHoldDurationMs !== undefined;
    if (hasRepetitions === hasHold) {
      fail(exercisePath, "must define exactly one repetition or hold target");
    }
    if (hasRepetitions) integer(exercise.targetRepetitions, `${exercisePath}.targetRepetitions`, 1, 500);
    if (hasHold) integer(exercise.targetHoldDurationMs, `${exercisePath}.targetHoldDurationMs`, 100, 3_600_000);
  }
  return input as Lesson;
}

function validateRequirements(input: unknown, path: string): void {
  const requirements = record(input, path);
  allowedKeys(requirements, [
    "minimumAccountLevel", "prerequisiteLessonIds", "mastery", "equipment",
    "capabilities", "blockedByRestrictionTags",
  ], path);
  integer(requirements.minimumAccountLevel, `${path}.minimumAccountLevel`, 0, 1_000);
  const prerequisites = array(requirements.prerequisiteLessonIds, `${path}.prerequisiteLessonIds`, true);
  unique(prerequisites.map((id, index) => uuid(id, `${path}.prerequisiteLessonIds[${index}]`)), `${path}.prerequisiteLessonIds`);
  const masteryInputs = array(requirements.mastery, `${path}.mastery`, true);
  const masteryKeys: string[] = [];
  for (const [index, masteryInput] of masteryInputs.entries()) {
    const mastery = record(masteryInput, `${path}.mastery[${index}]`);
    allowedKeys(mastery, ["exerciseKey", "minimumMasteryScore"], `${path}.mastery[${index}]`);
    masteryKeys.push(nonemptyString(mastery.exerciseKey, `${path}.mastery[${index}].exerciseKey`));
    percent(mastery.minimumMasteryScore, `${path}.mastery[${index}].minimumMasteryScore`);
  }
  unique(masteryKeys, `${path}.mastery[].exerciseKey`);
  enumArray(requirements.equipment, EQUIPMENT, `${path}.equipment`);
  const capabilityInputs = array(requirements.capabilities, `${path}.capabilities`, true);
  const capabilityKeys: string[] = [];
  for (const [index, capabilityInput] of capabilityInputs.entries()) {
    const capability = record(capabilityInput, `${path}.capabilities[${index}]`);
    allowedKeys(capability, ["capability", "minimumScore"], `${path}.capabilities[${index}]`);
    capabilityKeys.push(enumValue(capability.capability, CAPABILITIES, `${path}.capabilities[${index}].capability`));
    percent(capability.minimumScore, `${path}.capabilities[${index}].minimumScore`);
  }
  unique(capabilityKeys, `${path}.capabilities[].capability`);
  enumArray(requirements.blockedByRestrictionTags, RESTRICTIONS, `${path}.blockedByRestrictionTags`);
}

function validatePrerequisites(lessons: ReadonlyMap<string, Lesson>): void {
  for (const lesson of lessons.values()) {
    for (const prerequisite of lesson.requirements.prerequisiteLessonIds) {
      const prerequisiteLesson = lessons.get(prerequisite);
      if (prerequisiteLesson === undefined) fail(`lesson:${lesson.id}`, `references unknown prerequisite ${prerequisite}`);
      if (prerequisite === lesson.id) fail(`lesson:${lesson.id}`, "cannot require itself");
      if (lesson.publishingState === "published" && prerequisiteLesson.publishingState !== "published") {
        fail(`lesson:${lesson.id}`, "a published lesson cannot require unpublished content");
      }
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (lessonId: string): void => {
    if (visiting.has(lessonId)) fail(`lesson:${lessonId}`, "prerequisites must not form a cycle");
    if (visited.has(lessonId)) return;
    visiting.add(lessonId);
    const lesson = lessons.get(lessonId);
    lesson?.requirements.prerequisiteLessonIds.forEach(visit);
    visiting.delete(lessonId);
    visited.add(lessonId);
  };
  lessons.forEach((lesson) => visit(lesson.id));
}

function record(input: unknown, path: string): UnknownRecord {
  if (typeof input !== "object" || input === null || Array.isArray(input)) fail(path, "must be an object");
  return input as UnknownRecord;
}
function array(input: unknown, path: string, empty = false): readonly unknown[] {
  if (!Array.isArray(input) || (!empty && input.length === 0)) fail(path, empty ? "must be an array" : "must be a non-empty array");
  return input;
}
function nonemptyString(input: unknown, path: string): string {
  if (typeof input !== "string" || input.trim() === "") fail(path, "must be a non-empty string");
  return input;
}
function uuid(input: unknown, path: string): string {
  const parsed = uuidSchema.safeParse(input);
  if (!parsed.success) fail(path, "must be a UUID");
  return parsed.data;
}
function idOf(input: unknown, path: string): string { return uuid(record(input, path).id, `${path}.id`); }
function keyOf(input: unknown, path: string): string { return nonemptyString(record(input, path).key, `${path}.key`); }
function orderOf(input: unknown, path: string): number { return nonnegativeInteger(record(input, path).order, `${path}.order`); }
function integer(
  input: unknown,
  path: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (typeof input !== "number" || !Number.isInteger(input) || input < minimum || input > maximum) {
    fail(path, `must be an integer between ${minimum} and ${maximum}`);
  }
  return input;
}
function positiveInteger(input: unknown, path: string): number { return integer(input, path, 1); }
function nonnegativeInteger(input: unknown, path: string): number { return integer(input, path, 0); }
function percent(input: unknown, path: string): number {
  if (typeof input !== "number" || !Number.isFinite(input) || input < 0 || input > 100) fail(path, "must be between 0 and 100");
  return input;
}
function publishing(input: unknown, path: string): PublishingState {
  return enumValue(input, PUBLISHING_STATES, path);
}
function enumValue<T extends string>(input: unknown, values: ReadonlySet<T>, path: string): T {
  if (typeof input !== "string" || !values.has(input as T)) fail(path, "contains an unsupported value");
  return input as T;
}
function enumArray<T extends string>(input: unknown, values: ReadonlySet<T>, path: string): void {
  const items = array(input, path, true);
  const parsed = items.map((item, index) => enumValue(item, values, `${path}[${index}]`));
  unique(parsed, path);
}
function localized(input: unknown, path: string): void {
  const text = record(input, path);
  allowedKeys(text, ["id-ID", "en-US"], path);
  nonemptyString(text["id-ID"], `${path}.id-ID`);
  nonemptyString(text["en-US"], `${path}.en-US`);
}
function unique<T>(values: readonly T[], path: string): void {
  if (new Set(values).size !== values.length) fail(path, "must contain unique values");
}

function allowedKeys(value: UnknownRecord, allowed: readonly string[], path: string): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unknown !== undefined) fail(`${path}.${unknown}`, "is not supported by this schema version");
}

export function validateCatalogExerciseReferences(
  catalogInput: unknown,
  definitions: readonly ExerciseDefinition[],
): CourseCatalog {
  const catalog = courseCatalogSchema.parse(catalogInput);
  const definitionsByVersion = new Map(
    definitions.map((definition) => [
      `${definition.exerciseKey}@${definition.exerciseDefinitionVersion}`,
      definition,
    ]),
  );
  for (const track of catalog.tracks) {
    for (const course of track.courses) {
      for (const unit of course.units) {
        for (const lesson of unit.lessons) {
          for (const exercise of lesson.exercises) {
            const definition = definitionsByVersion.get(
              `${exercise.exerciseKey}@${exercise.exerciseDefinitionVersion}`,
            );
            if (definition === undefined) {
              fail(`lesson:${lesson.id}`, `references unavailable definition ${exercise.exerciseKey}@${exercise.exerciseDefinitionVersion}`);
            }
            if (definition.mode === "repetition" && exercise.targetRepetitions === undefined) {
              fail(`lesson:${lesson.id}`, `${definition.exerciseKey} requires a repetition target`);
            }
            if (definition.mode === "hold" && exercise.targetHoldDurationMs === undefined) {
              fail(`lesson:${lesson.id}`, `${definition.exerciseKey} requires a hold target`);
            }
          }
        }
      }
    }
  }
  return catalog;
}
