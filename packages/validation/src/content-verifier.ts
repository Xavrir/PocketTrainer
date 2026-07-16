import type {
  ExerciseDefinition,
  ExerciseDefinitionManifest,
  ExerciseDefinitionManifestEntry,
} from "@pockettrainer/contracts";

import { exerciseDefinitionSchema } from "./exercise-definition.js";
import { semanticVersionSchema } from "./primitives.js";
import { fail } from "./runtime-schema.js";

export interface ContentCryptoProvider {
  decodeUtf8(content: Uint8Array): string;
  sha256Hex(content: Uint8Array): Promise<string>;
  verifySignature(input: Readonly<{
    keyId: string;
    canonicalPayload: string;
    signature: string;
  }>): Promise<boolean>;
}

export type DefinitionTrustPolicy = Readonly<{
  appVersion: string;
  trustedKeyIds: ReadonlySet<string>;
  currentDefinitionVersions: Readonly<Record<string, number | undefined>>;
  currentDefinitionDigests: Readonly<Record<string, string | undefined>>;
  availableRollbackVersions: Readonly<Record<string, ReadonlySet<number> | undefined>>;
}>;

export type VerifyRemoteDefinitionInput = Readonly<{
  manifest: ExerciseDefinitionManifest;
  entry: ExerciseDefinitionManifestEntry;
  definitionBytes: Uint8Array;
  policy: DefinitionTrustPolicy;
  crypto: ContentCryptoProvider;
}>;

export async function verifyRemoteExerciseDefinition(
  input: VerifyRemoteDefinitionInput,
): Promise<ExerciseDefinition> {
  let definitionJson: unknown;
  try {
    definitionJson = JSON.parse(input.crypto.decodeUtf8(input.definitionBytes));
  } catch {
    fail("$", "definition content must be valid UTF-8 JSON");
  }
  const definition = exerciseDefinitionSchema.parse(definitionJson);
  assertTrustedMetadata(input.manifest, input.entry, definition, input.policy);
  const digest = await input.crypto.sha256Hex(input.definitionBytes);
  if (digest !== input.entry.sha256) {
    fail("$.sha256", "definition content does not match its manifest digest");
  }
  const signatureValid = await input.crypto.verifySignature({
    keyId: input.manifest.keyId,
    canonicalPayload: canonicalManifestEntryPayload(input.manifest, input.entry),
    signature: input.entry.signature,
  });
  if (!signatureValid) {
    fail("$.signature", "definition manifest signature is not trusted");
  }
  return definition;
}

export function canonicalManifestEntryPayload(
  manifest: ExerciseDefinitionManifest,
  entry: ExerciseDefinitionManifestEntry,
): string {
  return JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    catalogVersion: manifest.catalogVersion,
    generatedAt: manifest.generatedAt,
    keyId: manifest.keyId,
    exerciseKey: entry.exerciseKey,
    exerciseDefinitionVersion: entry.exerciseDefinitionVersion,
    minimumAppVersion: entry.minimumAppVersion,
    rollbackExerciseDefinitionVersion: entry.rollbackExerciseDefinitionVersion,
    contentUrl: entry.contentUrl,
    sha256: entry.sha256,
  });
}

function assertTrustedMetadata(
  manifest: ExerciseDefinitionManifest,
  entry: ExerciseDefinitionManifestEntry,
  definition: ExerciseDefinition,
  policy: DefinitionTrustPolicy,
): void {
  semanticVersionSchema.parse(policy.appVersion);
  if (!policy.trustedKeyIds.has(manifest.keyId)) {
    fail("$.keyId", "manifest signing key is not trusted");
  }
  if (!manifest.entries.some((candidate) => entriesEqual(candidate, entry))) {
    fail("$.entries", "entry is not present in the validated manifest");
  }
  if (compareSemver(policy.appVersion, entry.minimumAppVersion) < 0) {
    fail("$.minimumAppVersion", "definition requires a newer application version");
  }
  if (
    definition.exerciseKey !== entry.exerciseKey ||
    definition.exerciseDefinitionVersion !== entry.exerciseDefinitionVersion ||
    definition.minimumAppVersion !== entry.minimumAppVersion ||
    definition.rollbackExerciseDefinitionVersion !== entry.rollbackExerciseDefinitionVersion
  ) {
    fail("$", "definition metadata does not match its signed manifest entry");
  }
  const currentVersion = policy.currentDefinitionVersions[entry.exerciseKey] ?? 0;
  if (entry.exerciseDefinitionVersion < currentVersion) {
    fail("$.exerciseDefinitionVersion", "definition downgrade is not allowed");
  }
  if (
    entry.exerciseDefinitionVersion === currentVersion &&
    policy.currentDefinitionDigests[entry.exerciseKey] !== undefined &&
    policy.currentDefinitionDigests[entry.exerciseKey] !== entry.sha256
  ) {
    fail("$.sha256", "an immutable definition version cannot be replaced with different content");
  }
  if (entry.exerciseDefinitionVersion > 1) {
    const rollback = entry.rollbackExerciseDefinitionVersion;
    const available = policy.availableRollbackVersions[entry.exerciseKey];
    if (rollback === null || !available?.has(rollback)) {
      fail("$.rollbackExerciseDefinitionVersion", "signed rollback target is not available locally");
    }
  }
}

function entriesEqual(
  left: ExerciseDefinitionManifestEntry,
  right: ExerciseDefinitionManifestEntry,
): boolean {
  return canonicalEntry(left) === canonicalEntry(right);
}

function canonicalEntry(entry: ExerciseDefinitionManifestEntry): string {
  return JSON.stringify({
    exerciseKey: entry.exerciseKey,
    exerciseDefinitionVersion: entry.exerciseDefinitionVersion,
    minimumAppVersion: entry.minimumAppVersion,
    rollbackExerciseDefinitionVersion: entry.rollbackExerciseDefinitionVersion,
    contentUrl: entry.contentUrl,
    sha256: entry.sha256,
    signature: entry.signature,
  });
}

function compareSemver(left: string, right: string): number {
  semanticVersionSchema.parse(left);
  semanticVersionSchema.parse(right);
  const [leftCore = "", leftPrerelease] = left.split("-", 2);
  const [rightCore = "", rightPrerelease] = right.split("-", 2);
  const leftParts = leftCore.split(".").map(Number);
  const rightParts = rightCore.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  if (leftPrerelease === undefined && rightPrerelease !== undefined) return 1;
  if (leftPrerelease !== undefined && rightPrerelease === undefined) return -1;
  if (leftPrerelease !== undefined && rightPrerelease !== undefined) {
    const leftIdentifiers = leftPrerelease.split(".");
    const rightIdentifiers = rightPrerelease.split(".");
    const length = Math.max(leftIdentifiers.length, rightIdentifiers.length);
    for (let index = 0; index < length; index += 1) {
      const leftIdentifier = leftIdentifiers[index];
      const rightIdentifier = rightIdentifiers[index];
      if (leftIdentifier === undefined) return -1;
      if (rightIdentifier === undefined) return 1;
      if (leftIdentifier === rightIdentifier) continue;
      const leftNumber = /^\d+$/.test(leftIdentifier) ? Number(leftIdentifier) : null;
      const rightNumber = /^\d+$/.test(rightIdentifier) ? Number(rightIdentifier) : null;
      if (leftNumber !== null && rightNumber !== null) return Math.sign(leftNumber - rightNumber);
      if (leftNumber !== null) return -1;
      if (rightNumber !== null) return 1;
      return leftIdentifier.localeCompare(rightIdentifier);
    }
  }
  return 0;
}
