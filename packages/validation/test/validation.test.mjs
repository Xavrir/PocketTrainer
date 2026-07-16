import assert from "node:assert/strict";
import test from "node:test";

import {
  exerciseDefinitionManifestSchema,
  idempotencyKeySchema,
  isoDateTimeSchema,
  localDateSchema,
} from "../dist/index.js";

test("primitive schemas reject ambiguous identifiers and impossible dates", () => {
  assert.equal(idempotencyKeySchema.parse("WORKOUT:session_123"), "WORKOUT:session_123");
  assert.equal(idempotencyKeySchema.safeParse("short").success, false);
  assert.equal(localDateSchema.safeParse("2026-02-30").success, false);
  assert.equal(localDateSchema.parse("2026-07-16"), "2026-07-16");
  assert.equal(isoDateTimeSchema.safeParse("2026-07-16T10:00:00").success, false);
  assert.equal(isoDateTimeSchema.parse("2026-07-16T10:00:00+07:00"), "2026-07-16T10:00:00+07:00");
});

test("remote definition manifests require checksums and signatures", () => {
  const manifest = {
    schemaVersion: 1,
    catalogVersion: "2026.07.16",
    generatedAt: "2026-07-16T10:00:00.000Z",
    keyId: "pockettrainer-content-2026",
    entries: [
      {
        exerciseKey: "body_squat",
        exerciseDefinitionVersion: 1,
        minimumAppVersion: "0.1.0",
        rollbackExerciseDefinitionVersion: null,
        contentUrl: "https://content.example/exercises/body_squat/1.json",
        sha256: "a".repeat(64),
        signature: "b".repeat(86),
      },
    ],
  };

  assert.equal(exerciseDefinitionManifestSchema.parse(manifest).entries.length, 1);
  assert.equal(
    exerciseDefinitionManifestSchema.safeParse({
      ...manifest,
      entries: [{ ...manifest.entries[0], sha256: "not-a-digest" }],
    }).success,
    false,
  );
  assert.equal(
    exerciseDefinitionManifestSchema.safeParse({
      ...manifest,
      entries: [
        {
          ...manifest.entries[0],
          exerciseDefinitionVersion: 2,
          rollbackExerciseDefinitionVersion: null,
        },
      ],
    }).success,
    false,
  );
});
