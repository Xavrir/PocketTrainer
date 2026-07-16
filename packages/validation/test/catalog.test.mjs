import assert from "node:assert/strict";
import test from "node:test";

import { courseCatalogSchema, validateCatalogExerciseReferences } from "../dist/index.js";

const ids = {
  track: "00000000-0000-4000-8000-000000000001",
  course: "00000000-0000-4000-8000-000000000002",
  unit: "00000000-0000-4000-8000-000000000003",
  lesson1: "00000000-0000-4000-8000-000000000004",
  lesson2: "00000000-0000-4000-8000-000000000005",
};

const lesson = (id, order, prerequisites = []) => ({
  id,
  key: `lesson-${order}`,
  title: { "id-ID": `Pelajaran ${order}`, "en-US": `Lesson ${order}` },
  description: { "id-ID": "Latihan aman", "en-US": "Safe practice" },
  order,
  estimatedMinutes: 8,
  baseXp: 20,
  publishingState: "published",
  requirements: {
    minimumAccountLevel: 1,
    prerequisiteLessonIds: prerequisites,
    mastery: [],
    equipment: ["none"],
    capabilities: [],
    blockedByRestrictionTags: [],
  },
  exercises: [{
    exerciseKey: "body_squat",
    exerciseDefinitionVersion: 1,
    order: 1,
    targetRepetitions: 8,
    sets: 1,
    restAfterMs: 30_000,
  }],
});

const validCatalog = {
  catalogVersion: "2026.07.16",
  schemaVersion: 1,
  publishedAt: "2026-07-16T10:00:00.000Z",
  tracks: [{
    id: ids.track,
    key: "strength",
    title: { "id-ID": "Kekuatan", "en-US": "Strength" },
    description: { "id-ID": "Belajar", "en-US": "Learn" },
    order: 1,
    courses: [{
      id: ids.course,
      key: "strength-foundation",
      trackKey: "strength",
      title: { "id-ID": "Dasar", "en-US": "Foundation" },
      description: { "id-ID": "Mulai", "en-US": "Start" },
      order: 1,
      minimumAccountLevel: 1,
      publishingState: "published",
      units: [{
        id: ids.unit,
        key: "squat-basics",
        title: { "id-ID": "Squat", "en-US": "Squat" },
        description: { "id-ID": "Kontrol", "en-US": "Control" },
        order: 1,
        lessons: [lesson(ids.lesson1, 1), lesson(ids.lesson2, 2, [ids.lesson1])],
      }],
    }],
  }],
};

test("catalog schema accepts an ordered, resolvable curriculum", () => {
  assert.equal(courseCatalogSchema.parse(validCatalog).tracks.length, 1);
  assert.equal(
    validateCatalogExerciseReferences(validCatalog, [{
      exerciseKey: "body_squat",
      exerciseDefinitionVersion: 1,
      mode: "repetition",
    }]).tracks.length,
    1,
  );
  assert.throws(() => validateCatalogExerciseReferences(validCatalog, []));
});

test("catalog schema rejects prerequisite cycles and contradictory targets", () => {
  const cyclic = structuredClone(validCatalog);
  cyclic.tracks[0].courses[0].units[0].lessons[0].requirements.prerequisiteLessonIds = [ids.lesson2];
  assert.equal(courseCatalogSchema.safeParse(cyclic).success, false);

  const contradictory = structuredClone(validCatalog);
  contradictory.tracks[0].courses[0].units[0].lessons[0].exercises[0].targetHoldDurationMs = 10_000;
  assert.equal(courseCatalogSchema.safeParse(contradictory).success, false);
});

test("catalog schema rejects misspelled safety registries", () => {
  const typo = structuredClone(validCatalog);
  typo.tracks[0].courses[0].units[0].lessons[0].requirements.blockedByRestrictionTags = ["knee_fexion"];
  assert.equal(courseCatalogSchema.safeParse(typo).success, false);
});
