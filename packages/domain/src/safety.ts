import type {
  PainSafetyDecision,
  TrackingGateDecision,
  TrackingGateInput,
  TrackingGateReason,
} from "@pockettrainer/contracts";

export function evaluateTrackingGate(input: TrackingGateInput): TrackingGateDecision {
  const reasons: TrackingGateReason[] = [];
  if (
    !isUnitInterval(input.poseConfidence) ||
    !isUnitInterval(input.minimumPoseConfidence) ||
    input.poseConfidence < input.minimumPoseConfidence
  ) {
    reasons.push("LOW_POSE_CONFIDENCE");
  }
  if (!input.requiredLandmarksPresent) {
    reasons.push("MISSING_REQUIRED_LANDMARKS");
  }
  if (!input.bodyInsideFrame) {
    reasons.push("BODY_OUTSIDE_FRAME");
  }
  if (input.detectedPeople !== 1) {
    reasons.push("MULTIPLE_PEOPLE");
  }
  if (!input.cameraOrientationValid) {
    reasons.push("WRONG_CAMERA_ORIENTATION");
  }
  if (!input.lightingSufficient) {
    reasons.push("LOW_LIGHT");
  }
  return Object.freeze({
    eligible: reasons.length === 0,
    reasons: Object.freeze(reasons),
    userMessageKey:
      reasons.length === 0 ? "tracking.ready" : "tracking.paused.fullBodyNotVisible",
  });
}

function isUnitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function evaluatePainSafety(painReported: boolean): PainSafetyDecision {
  if (painReported) {
    return Object.freeze({
      stopExercise: true,
      allowScore: false,
      allowProgression: false,
      excludeExercise: true,
      guidanceKey: "safety.stopPain",
    });
  }
  return Object.freeze({
    stopExercise: false,
    allowScore: true,
    allowProgression: true,
    excludeExercise: false,
    guidanceKey: "safety.continue",
  });
}

export function isSessionScoringEligible(
  tracking: TrackingGateDecision,
  pain: PainSafetyDecision,
): boolean {
  return tracking.eligible && pain.allowScore;
}
