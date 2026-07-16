import { createSchema, fail } from "./runtime-schema.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_DATE_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const SEMVER_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

function parseMatchingString(input: unknown, pattern: RegExp, label: string): string {
  if (typeof input !== "string" || !pattern.test(input)) {
    return fail("$", `must be a valid ${label}`);
  }
  return input;
}

export const uuidSchema = createSchema<string>((input) =>
  parseMatchingString(input, UUID_PATTERN, "UUID"),
);

export const localDateSchema = createSchema<string>((input) => {
  const value = parseMatchingString(input, LOCAL_DATE_PATTERN, "local date");
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day
  ) {
    return fail("$", "must be a calendar-valid local date");
  }
  return value;
});

export const isoDateTimeSchema = createSchema<string>((input) => {
  if (
    typeof input !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(input)
  ) {
    return fail("$", "must be an ISO 8601 date-time");
  }
  localDateSchema.parse(input.slice(0, 10));
  const timestamp = Date.parse(input);
  if (!Number.isFinite(timestamp)) {
    return fail("$", "must be an ISO 8601 date-time");
  }
  return input;
});

export const semanticVersionSchema = createSchema<string>((input) =>
  parseMatchingString(input, SEMVER_PATTERN, "semantic version"),
);

export const idempotencyKeySchema = createSchema<string>((input) => {
  if (typeof input !== "string") {
    return fail("$", "must be a string");
  }
  const value = input.trim();
  if (value.length < 8 || value.length > 200 || !/^[A-Za-z0-9:_-]+$/.test(value)) {
    return fail("$", "must contain 8-200 safe identifier characters");
  }
  return value;
});
