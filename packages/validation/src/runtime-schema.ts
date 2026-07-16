export type ValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export class ValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
    this.name = "ValidationError";
    this.issues = issues;
  }
}

export type SafeParseResult<T> =
  | Readonly<{ success: true; data: T }>
  | Readonly<{ success: false; error: ValidationError }>;

export interface RuntimeSchema<T> {
  parse(input: unknown): T;
  safeParse(input: unknown): SafeParseResult<T>;
}

export function createSchema<T>(validate: (input: unknown) => T): RuntimeSchema<T> {
  return Object.freeze({
    parse: validate,
    safeParse(input: unknown): SafeParseResult<T> {
      try {
        return Object.freeze({ success: true, data: validate(input) });
      } catch (error) {
        if (error instanceof ValidationError) {
          return Object.freeze({ success: false, error });
        }
        throw error;
      }
    },
  });
}

export function fail(path: string, message: string): never {
  throw new ValidationError([{ path, message }]);
}
