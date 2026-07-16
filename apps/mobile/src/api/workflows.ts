import {
  completeWorkoutSession,
  createWorkoutSession,
  updateConsent,
  updateProfile,
  uploadWorkoutResults,
} from './apiClient';
import type {
  CompleteWorkoutInput,
  Consent,
  ConsentType,
  CreateWorkoutInput,
  Profile,
  UpdateConsentInput,
  UpdateProfileInput,
  UploadWorkoutResultsInput,
  WorkoutCompletion,
  WorkoutSession,
} from './types';

export type PersistOnboardingInput = {
  consents: ReadonlyArray<{
    idempotencyKey: string;
    input: UpdateConsentInput;
    type: ConsentType;
  }>;
  profile: UpdateProfileInput;
  profileIdempotencyKey: string;
};

export type PersistOnboardingResult = {
  consents: Consent[];
  profile: Profile;
};

export async function persistOnboarding(
  input: PersistOnboardingInput,
): Promise<PersistOnboardingResult> {
  const consents: Consent[] = [];
  for (const consent of input.consents) {
    consents.push(
      await updateConsent(consent.type, consent.input, {
        idempotencyKey: consent.idempotencyKey,
      }),
    );
  }
  const profile = await updateProfile(input.profile, {
    idempotencyKey: input.profileIdempotencyKey,
  });
  return { consents, profile };
}

export type CompleteWorkoutFlowInput = {
  completion: CompleteWorkoutInput;
  completionIdempotencyKey: string;
  create: CreateWorkoutInput;
  createIdempotencyKey: string;
  results: UploadWorkoutResultsInput;
  resultsIdempotencyKey: string;
};

export type CompleteWorkoutFlowResult = {
  completion: WorkoutCompletion;
  createdSession: WorkoutSession;
  sessionWithResults: WorkoutSession;
};

export async function completeWorkoutFlow(
  input: CompleteWorkoutFlowInput,
): Promise<CompleteWorkoutFlowResult> {
  const createdSession = await createWorkoutSession(input.create, {
    idempotencyKey: input.createIdempotencyKey,
  });
  const sessionWithResults = await uploadWorkoutResults(
    createdSession.id,
    input.results,
    { idempotencyKey: input.resultsIdempotencyKey },
  );
  const completion = await completeWorkoutSession(
    createdSession.id,
    input.completion,
    { idempotencyKey: input.completionIdempotencyKey },
  );
  return { completion, createdSession, sessionWithResults };
}
