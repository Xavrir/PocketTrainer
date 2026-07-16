import type {
  ExerciseDefinition,
  ExerciseStateDefinition,
  FormRule,
  LandmarkName,
  MetricPredicate,
  NormalizedPoseLandmark,
  PoseMetric,
} from "@pockettrainer/contracts";
import { exerciseDefinitionSchema } from "@pockettrainer/validation";

import { BODY_SQUAT_DEFINITION } from "./body-squat.js";
import { INCLINE_PUSH_UP_DEFINITION } from "./incline-push-up.js";
import { JUMPING_JACK_DEFINITION } from "./jumping-jack.js";
import { TREE_POSE_DEFINITION } from "./tree-pose.js";
import { WARRIOR_II_DEFINITION } from "./warrior-ii.js";

const BUNDLED_DEFINITIONS = [
  BODY_SQUAT_DEFINITION,
  INCLINE_PUSH_UP_DEFINITION,
  WARRIOR_II_DEFINITION,
  TREE_POSE_DEFINITION,
  JUMPING_JACK_DEFINITION,
] as const;

export const MOVEMENT_ENGINE_CONTRACT_VERSION = 1 as const;
export const MOVEMENT_ENGINE_SUPPORTED_DEFINITION_VERSION = 1 as const;

export type MovementFrame = Readonly<{
  sequence: number;
  timestampMs: number;
  poseConfidence: number;
  peopleCount: number;
  visible: boolean;
  landmarks: Readonly<Partial<Record<LandmarkName, NormalizedPoseLandmark>>>;
}>;

export type MovementEvaluation = Readonly<{
  contractVersion: 1;
  exerciseKey: string;
  exerciseDefinitionVersion: number;
  scoringVersion: number;
  frameSequence: number;
  droppedFrame: boolean;
  state: string;
  phase: string;
  repCount: number;
  validRepCount: number;
  validHoldDurationMs: number;
  formScore: number | null;
  confidenceEligible: boolean;
  trackingStatus: "eligible" | "paused" | "lost";
  feedbackKey: string | null;
  criticalRulesPassed: boolean;
}>;

export type MovementEngineErrorCode =
  | "INVALID_DEFINITION"
  | "UNSUPPORTED_DEFINITION_VERSION"
  | "DEFINITION_KEY_MISMATCH"
  | "APP_VERSION_INCOMPATIBLE";

export class MovementEngineError extends Error {
  readonly code: MovementEngineErrorCode;

  constructor(code: MovementEngineErrorCode, message: string) {
    super(message);
    this.name = "MovementEngineError";
    this.code = code;
  }
}

export type MovementDefinitionLoaderOptions = Readonly<{
  appVersion: string;
  currentDefinitionVersions?: Readonly<Record<string, number>>;
}>;

export function loadMovementDefinition(
  candidate: unknown,
  expectedExerciseKey: string,
  options: MovementDefinitionLoaderOptions,
): ExerciseDefinition {
  let definition: ExerciseDefinition;
  try {
    definition = exerciseDefinitionSchema.parse(candidate);
  } catch (error) {
    throw new MovementEngineError(
      "INVALID_DEFINITION",
      error instanceof Error ? error.message : "Movement definition is invalid.",
    );
  }

  if (definition.exerciseKey !== expectedExerciseKey) {
    throw new MovementEngineError(
      "DEFINITION_KEY_MISMATCH",
      `Expected ${expectedExerciseKey}, received ${definition.exerciseKey}.`,
    );
  }
  if (definition.exerciseDefinitionVersion !== MOVEMENT_ENGINE_SUPPORTED_DEFINITION_VERSION) {
    throw new MovementEngineError(
      "UNSUPPORTED_DEFINITION_VERSION",
      `Definition version ${definition.exerciseDefinitionVersion} is not supported.`,
    );
  }
  const currentVersion = options.currentDefinitionVersions?.[definition.exerciseKey];
  if (currentVersion !== undefined && currentVersion !== definition.exerciseDefinitionVersion) {
    throw new MovementEngineError(
      "UNSUPPORTED_DEFINITION_VERSION",
      `Definition ${definition.exerciseKey}@${definition.exerciseDefinitionVersion} is not the active version.`,
    );
  }
  if (!isCompatibleAppVersion(options.appVersion, definition.minimumAppVersion)) {
    throw new MovementEngineError(
      "APP_VERSION_INCOMPATIBLE",
      `Definition requires app ${definition.minimumAppVersion}; received ${options.appVersion}.`,
    );
  }
  return definition;
}

export function getBundledMovementDefinition(exerciseKey: string): ExerciseDefinition | undefined {
  return BUNDLED_DEFINITIONS.find((definition) => definition.exerciseKey === exerciseKey);
}

export function normalizeLandmarks(
  landmarks: Readonly<Partial<Record<LandmarkName, NormalizedPoseLandmark>>>,
): Readonly<Partial<Record<LandmarkName, NormalizedPoseLandmark>>> {
  const leftHip = landmarks.left_hip;
  const rightHip = landmarks.right_hip;
  const leftShoulder = landmarks.left_shoulder;
  const rightShoulder = landmarks.right_shoulder;
  if (!leftHip || !rightHip || !leftShoulder || !rightShoulder) return landmarks;

  const origin = midpoint(leftHip, rightHip);
  if (!origin) return landmarks;
  const shoulderWidth = distance(leftShoulder, rightShoulder);
  const torsoLength = distance(origin, midpoint(leftShoulder, rightShoulder));
  const scale = Math.max(shoulderWidth ?? 0, torsoLength ?? 0, 0.0001);
  return Object.fromEntries(
    Object.entries(landmarks).map(([name, point]) => [
      name,
      point === undefined
        ? point
        : {
            x: (point.x - origin.x) / scale,
            y: (point.y - origin.y) / scale,
            z: (point.z - origin.z) / scale,
            visibility: clamp(point.visibility, 0, 1),
          },
    ]),
  ) as Readonly<Partial<Record<LandmarkName, NormalizedPoseLandmark>>>;
}

export function createMovementEvaluator(
  candidate: unknown,
  options: MovementDefinitionLoaderOptions,
): MovementEvaluator {
  const exerciseKey = readExerciseKey(candidate);
  const definition = loadMovementDefinition(candidate, exerciseKey, options);
  return new MovementEvaluator(definition);
}

export class MovementEvaluator {
  private readonly definition: ExerciseDefinition;
  private state: ExerciseStateDefinition;
  private candidateState: ExerciseStateDefinition | null = null;
  private candidateSinceMs: number | null = null;
  private lastSequence = -1;
  private lastTimestampMs: number | null = null;
  private lastEligibleTimestampMs: number | null = null;
  private lastMetrics = new Map<PoseMetric, number>();
  private smoothedMetrics = new Map<PoseMetric, number>();
  private metricHistory = new Map<PoseMetric, number[]>();
  private recentHipCenters: Array<{ timestampMs: number; x: number; y: number }> = [];
  private holdDurationMs = 0;
  private repCount = 0;
  private validRepCount = 0;
  private lastFormScore: number | null = null;
  private lastCriticalRulesPassed = false;
  private feedbackCandidateKey: string | null = null;
  private feedbackCandidateSinceMs: number | null = null;
  private lastFeedbackAtMs = -Infinity;

  constructor(definition: ExerciseDefinition) {
    this.definition = definition;
    this.state = definition.states.find((item) => item.id === definition.stateMachine.initialStateId) ??
      definition.states[0]!;
  }

  evaluate(frame: MovementFrame): MovementEvaluation {
    if (frame.sequence <= this.lastSequence) {
      return this.snapshot(frame.sequence, false, true);
    }
    this.lastSequence = frame.sequence;
    const timestampMs = Math.max(frame.timestampMs, this.lastTimestampMs ?? frame.timestampMs);
    const elapsedMs = this.lastTimestampMs === null
      ? 0
      : Math.min(timestampMs - this.lastTimestampMs, 250);
    this.lastTimestampMs = timestampMs;

    const points = normalizeLandmarks(frame.landmarks);
    const confidenceEligible = this.isConfidenceEligible(frame, points);
    if (!confidenceEligible) {
      const trackingStatus = this.resolveTrackingLoss(timestampMs);
      return this.snapshot(frame.sequence, confidenceEligible, false, trackingStatus);
    }

    this.lastEligibleTimestampMs = timestampMs;
    const metrics = this.measure(points, elapsedMs, timestampMs);
    this.updateHold(metrics, elapsedMs);
    metrics.set("valid_hold_duration_ms", this.holdDurationMs);
    this.tryTransition(metrics, timestampMs);
    const feedbackKey = this.resolveFeedback(metrics, timestampMs);

    return this.snapshot(frame.sequence, true, false, "eligible", feedbackKey);
  }

  private isConfidenceEligible(
    frame: MovementFrame,
    landmarks: Readonly<Partial<Record<LandmarkName, NormalizedPoseLandmark>>>,
  ): boolean {
    if (!Number.isFinite(frame.poseConfidence) || frame.poseConfidence < this.definition.calibration.minimumPoseConfidence) {
      return false;
    }
    if (frame.peopleCount !== this.definition.calibration.maximumPeople || !frame.visible) return false;
    return this.definition.requiredLandmarks.every((name) => {
      const point = landmarks[name];
      return point !== undefined && point.visibility >= this.definition.calibration.minimumPoseConfidence;
    });
  }

  private resolveTrackingLoss(timestampMs: number): "paused" | "lost" {
    const lossStarted = this.lastEligibleTimestampMs ?? timestampMs;
    if (timestampMs - lossStarted >= this.definition.trackingLossResetMs) {
      this.resetMovement();
      return "lost";
    }
    return "paused";
  }

  private measure(
    points: Readonly<Partial<Record<LandmarkName, NormalizedPoseLandmark>>>,
    elapsedMs: number,
    timestampMs: number,
  ): Map<PoseMetric, number> {
    const metrics = new Map<PoseMetric, number>();
    const previousMetrics = new Map(this.lastMetrics);
    const requiredMetrics = new Set<PoseMetric>([
      ...this.definition.rules.map((rule) => rule.metric),
      ...this.definition.states.flatMap((state) => state.predicates.map((predicate) => predicate.metric)),
    ]);
    for (const metric of requiredMetrics) {
      const value = calculateMetric(metric, points, previousMetrics, elapsedMs, this.recentHipCenters);
      if (value === undefined || !Number.isFinite(value)) continue;
      const previous = this.smoothedMetrics.get(metric);
      const smoothed = previous === undefined ? value : previous * 0.65 + value * 0.35;
      metrics.set(metric, smoothed);
      this.smoothedMetrics.set(metric, smoothed);
      this.lastMetrics.set(metric, value);
      const history = this.metricHistory.get(metric) ?? [];
      history.push(smoothed);
      if (history.length > 32) history.shift();
      this.metricHistory.set(metric, history);
    }
    const center = hipCenter(points);
    if (center) {
      this.recentHipCenters.push({ timestampMs, x: center.x, y: center.y });
      while (this.recentHipCenters.length > 1 && timestampMs - this.recentHipCenters[0]!.timestampMs > 500) {
        this.recentHipCenters.shift();
      }
      const displacement = centerDisplacement(this.recentHipCenters);
      if (displacement !== undefined) metrics.set("center_displacement", displacement);
    }
    return metrics;
  }

  private updateHold(metrics: Map<PoseMetric, number>, elapsedMs: number): void {
    const accumulator = this.definition.stateMachine.holdAccumulator;
    if (!accumulator || this.state.id !== accumulator.activeStateId) return;
    const activeState = this.definition.states.find((item) => item.id === accumulator.activeStateId);
    if (activeState && predicatesPass(activeState.predicates, metrics, false)) {
      this.holdDurationMs += elapsedMs;
    }
  }

  private tryTransition(metrics: Map<PoseMetric, number>, timestampMs: number): void {
    const next = this.definition.stateMachine.transitionPriority
      .map((id) => this.definition.states.find((state) => state.id === id))
      .find((state) => state !== undefined && state.id !== this.state.id &&
      state.allowedPreviousStates.includes(this.state.id) &&
        predicatesPass(state.predicates, metrics, true));

    if (!next) {
      if (
        this.candidateState !== null &&
        this.candidateSinceMs !== null &&
        timestampMs - this.candidateSinceMs >= this.candidateState.minimumDurationMs
      ) {
        this.commitTransition(this.candidateState);
        return;
      }
      if (this.candidateState !== null && this.candidateSinceMs !== null) return;
      this.candidateState = null;
      this.candidateSinceMs = null;
      return;
    }
    if (this.candidateState?.id !== next.id) {
      this.candidateState = next;
      this.candidateSinceMs = timestampMs;
    }
    if (timestampMs - (this.candidateSinceMs ?? timestampMs) < next.minimumDurationMs) return;

    this.commitTransition(next);
  }

  private commitTransition(next: ExerciseStateDefinition): void {
    const previous = this.state;
    this.state = next;
    this.candidateState = null;
    this.candidateSinceMs = null;
    if (this.definition.mode === "repetition" && next.terminal) {
      this.repCount += 1;
      const score = this.scoreCurrentMovement();
      this.lastFormScore = score.formScore;
      this.lastCriticalRulesPassed = score.criticalRulesPassed;
      if (score.formScore !== null && score.criticalRulesPassed) this.validRepCount += 1;
      this.metricHistory.clear();
    } else if (this.definition.mode === "repetition" && previous.id === this.definition.stateMachine.initialStateId) {
      this.metricHistory.clear();
    }
  }

  private scoreCurrentMovement(): { formScore: number | null; criticalRulesPassed: boolean } {
    const scores: Array<{ score: number; weight: number }> = [];
    let criticalRulesPassed = true;
    for (const rule of this.definition.rules) {
      const values = this.metricHistory.get(rule.metric) ?? [];
      const value = values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : undefined;
      if (value === undefined) {
        if (rule.critical) criticalRulesPassed = false;
        continue;
      }
      const score = scoreRange(value, rule.idealRange, rule.hardRange);
      scores.push({ score, weight: rule.weight * rule.phaseWeight });
      if (rule.critical && score <= 0) criticalRulesPassed = false;
    }
    if (!scores.length || !criticalRulesPassed) return { formScore: null, criticalRulesPassed };
    const totalWeight = scores.reduce((sum, item) => sum + item.weight, 0);
    return {
      formScore: Math.round(scores.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight),
      criticalRulesPassed,
    };
  }

  private resolveFeedback(metrics: Map<PoseMetric, number>, timestampMs: number): string | null {
    const candidate = this.definition.rules
      .filter((rule) => rule.phases.includes(this.state.id))
      .map((rule) => ({ rule, score: scoreRange(metrics.get(rule.metric), rule.idealRange, rule.hardRange) }))
      .filter((item): item is { rule: FormRule; score: number } => item.score < 100)
      .sort((left, right) => severityRank(right.rule) - severityRank(left.rule) || left.score - right.score)[0];
    if (!candidate) {
      this.feedbackCandidateKey = null;
      this.feedbackCandidateSinceMs = null;
      return null;
    }
    const feedback = this.definition.feedback.find((item) => item.key === candidate.rule.feedbackKey);
    if (!feedback) return null;
    if (this.feedbackCandidateKey !== feedback.key) {
      this.feedbackCandidateKey = feedback.key;
      this.feedbackCandidateSinceMs = timestampMs;
    }
    if (timestampMs - (this.feedbackCandidateSinceMs ?? timestampMs) < feedback.minimumErrorDurationMs) return null;
    if (timestampMs - this.lastFeedbackAtMs < feedback.cooldownMs) return null;
    this.lastFeedbackAtMs = timestampMs;
    return feedback.key;
  }

  private snapshot(
    frameSequence: number,
    confidenceEligible: boolean,
    droppedFrame: boolean,
    trackingStatus: "eligible" | "paused" | "lost" = confidenceEligible ? "eligible" : "paused",
    feedbackKey: string | null = null,
  ): MovementEvaluation {
    return {
      contractVersion: MOVEMENT_ENGINE_CONTRACT_VERSION,
      exerciseKey: this.definition.exerciseKey,
      exerciseDefinitionVersion: this.definition.exerciseDefinitionVersion,
      scoringVersion: this.definition.scoringVersion,
      frameSequence,
      droppedFrame,
      state: this.state.id,
      phase: this.state.id,
      repCount: this.repCount,
      validRepCount: this.validRepCount,
      validHoldDurationMs: Math.round(this.holdDurationMs),
      formScore: confidenceEligible ? this.lastFormScore : null,
      confidenceEligible,
      trackingStatus,
      feedbackKey,
      criticalRulesPassed: confidenceEligible && this.lastCriticalRulesPassed,
    };
  }

  private resetMovement(): void {
    this.state = this.definition.states.find((item) => item.id === this.definition.stateMachine.resetStateId) ?? this.state;
    this.candidateState = null;
    this.candidateSinceMs = null;
    this.holdDurationMs = 0;
    this.repCount = 0;
    this.validRepCount = 0;
    this.lastFormScore = null;
    this.lastCriticalRulesPassed = false;
    this.lastEligibleTimestampMs = null;
    this.metricHistory.clear();
    this.recentHipCenters = [];
  }
}

export class LatestFrameWinsEvaluator {
  private latestSequence = -1;

  constructor(private readonly evaluator: MovementEvaluator) {}

  submit(frame: MovementFrame): MovementEvaluation {
    if (frame.sequence <= this.latestSequence) {
      return this.evaluator.evaluate({ ...frame, sequence: this.latestSequence });
    }
    this.latestSequence = frame.sequence;
    return this.evaluator.evaluate(frame);
  }
}

function predicatesPass(
  predicates: readonly MetricPredicate[],
  metrics: ReadonlyMap<PoseMetric, number>,
  useEntryHysteresis: boolean,
): boolean {
  return predicates.every((predicate) => {
    const actual = metrics.get(predicate.metric);
    if (actual === undefined) return false;
    const hysteresis = useEntryHysteresis ? predicate.hysteresis ?? 0 : 0;
    switch (predicate.operator) {
      case "gt": return actual > predicate.value + hysteresis;
      case "gte": return actual >= predicate.value + hysteresis;
      case "lt": return actual < predicate.value - hysteresis;
      case "lte": return actual <= predicate.value - hysteresis;
      case "between": return actual >= predicate.value + hysteresis && actual <= (predicate.maximum ?? predicate.value) - hysteresis;
    }
  });
}

function calculateMetric(
  metric: PoseMetric,
  points: Readonly<Partial<Record<LandmarkName, NormalizedPoseLandmark>>>,
  previous: ReadonlyMap<PoseMetric, number>,
  elapsedMs: number,
  recentCenters: readonly { x: number; y: number }[],
): number | undefined {
  const leftKnee = angleFor(points, "left_hip", "left_knee", "left_ankle");
  const rightKnee = angleFor(points, "right_hip", "right_knee", "right_ankle");
  const knee = selectSide(leftKnee, rightKnee, points, "left_knee", "right_knee");
  const leftElbow = angleFor(points, "left_shoulder", "left_elbow", "left_wrist");
  const rightElbow = angleFor(points, "right_shoulder", "right_elbow", "right_wrist");
  const elbow = selectSide(leftElbow, rightElbow, points, "left_elbow", "right_elbow");
  const center = hipCenter(points);
  switch (metric) {
    case "knee_angle": return knee;
    case "knee_angular_velocity": return derivative(knee, previous.get("knee_angle"), elapsedMs);
    case "hip_angle": return selectSide(
      angleFor(points, "left_shoulder", "left_hip", "left_knee"),
      angleFor(points, "right_shoulder", "right_hip", "right_knee"),
      points,
      "left_hip",
      "right_hip",
    );
    case "elbow_angle": return elbow;
    case "elbow_angular_velocity": return derivative(elbow, previous.get("elbow_angle"), elapsedMs);
    case "torso_lean": return torsoLean(points);
    case "body_line_deviation": return bodyLineDeviation(points);
    case "hip_vertical_velocity": return derivative(center?.y, previous.get("hip_vertical_velocity"), elapsedMs, true);
    case "hip_tilt": return axisTilt(points.left_hip, points.right_hip);
    case "shoulder_tilt": return axisTilt(points.left_shoulder, points.right_shoulder);
    case "arm_horizontal_deviation_left": return horizontalDeviation(points.left_shoulder, points.left_wrist);
    case "arm_horizontal_deviation_right": return horizontalDeviation(points.right_shoulder, points.right_wrist);
    case "front_knee_ankle_offset": return frontKneeAnkleOffset(points, leftKnee, rightKnee);
    case "stance_width_ratio": return ratio(distance(points.left_ankle, points.right_ankle), distance(points.left_shoulder, points.right_shoulder));
    case "single_leg_stability": return singleLegStability(points, recentCenters);
    case "raised_knee_lateral_rotation": return raisedKneeRotation(points, leftKnee, rightKnee);
    case "center_displacement": return centerDisplacement(recentCenters);
    case "valid_hold_duration_ms": return 0;
    case "pose_confidence": return minimumVisibility(points);
  }
}

function scoreRange(value: number | undefined, ideal: { minimum?: number; maximum?: number }, hard: { minimum?: number; maximum?: number }): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  if ((ideal.minimum === undefined || value >= ideal.minimum) && (ideal.maximum === undefined || value <= ideal.maximum)) return 100;
  if (hard.minimum !== undefined && value < hard.minimum || hard.maximum !== undefined && value > hard.maximum) return 0;
  if (hard.minimum !== undefined && ideal.minimum !== undefined && value < ideal.minimum) return clamp(100 * (value - hard.minimum) / (ideal.minimum - hard.minimum), 0, 100);
  if (hard.maximum !== undefined && ideal.maximum !== undefined && value > ideal.maximum) return clamp(100 * (hard.maximum - value) / (hard.maximum - ideal.maximum), 0, 100);
  return 0;
}

function severityRank(rule: FormRule): number {
  const feedback = rule.feedbackKey;
  return feedback.includes("knee") || feedback.includes("balance") || feedback.includes("bodyLine") ? 3 : feedback.includes("depth") ? 2 : 1;
}

function readExerciseKey(candidate: unknown): string {
  if (typeof candidate !== "object" || candidate === null || !("exerciseKey" in candidate) || typeof candidate.exerciseKey !== "string") {
    throw new MovementEngineError("INVALID_DEFINITION", "Movement definition must contain an exerciseKey.");
  }
  return candidate.exerciseKey;
}

function isCompatibleAppVersion(appVersion: string, minimumAppVersion: string): boolean {
  const parse = (value: string): [number, number, number] | null => {
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(value);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
  };
  const actual = parse(appVersion);
  const minimum = parse(minimumAppVersion);
  if (!actual || !minimum) return false;
  for (let index = 0; index < 3; index += 1) {
    if (actual[index] !== minimum[index]) return actual[index]! > minimum[index]!;
  }
  return true;
}

function selectSide(left: number | undefined, right: number | undefined, points: Readonly<Partial<Record<LandmarkName, NormalizedPoseLandmark>>>, leftName: LandmarkName, rightName: LandmarkName): number | undefined {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return (points[leftName]?.visibility ?? 0) >= (points[rightName]?.visibility ?? 0) ? left : right;
}

function angleFor(points: Readonly<Partial<Record<LandmarkName, NormalizedPoseLandmark>>>, a: LandmarkName, b: LandmarkName, c: LandmarkName): number | undefined {
  const first = points[a];
  const middle = points[b];
  const last = points[c];
  if (!first || !middle || !last) return undefined;
  const ab = { x: first.x - middle.x, y: first.y - middle.y, z: first.z - middle.z };
  const cb = { x: last.x - middle.x, y: last.y - middle.y, z: last.z - middle.z };
  const denominator = Math.hypot(ab.x, ab.y, ab.z) * Math.hypot(cb.x, cb.y, cb.z);
  if (denominator < 0.000001) return undefined;
  return Math.acos(clamp((ab.x * cb.x + ab.y * cb.y + ab.z * cb.z) / denominator, -1, 1)) * 180 / Math.PI;
}

function torsoLean(points: Readonly<Partial<Record<LandmarkName, NormalizedPoseLandmark>>>): number | undefined {
  const hip = hipCenter(points);
  const shoulder = midpoint(points.left_shoulder, points.right_shoulder);
  if (!hip || !shoulder) return undefined;
  return Math.abs(Math.atan2(shoulder.x - hip.x, hip.y - shoulder.y) * 180 / Math.PI);
}

function bodyLineDeviation(points: Readonly<Partial<Record<LandmarkName, NormalizedPoseLandmark>>>): number | undefined {
  const shoulder = midpoint(points.left_shoulder, points.right_shoulder);
  const hip = hipCenter(points);
  const ankle = midpoint(points.left_ankle, points.right_ankle);
  if (!shoulder || !hip || !ankle) return undefined;
  return Math.abs(Math.atan2(shoulder.y - ankle.y, shoulder.x - ankle.x) * 180 / Math.PI - Math.atan2(hip.y - ankle.y, hip.x - ankle.x) * 180 / Math.PI);
}

function axisTilt(left: NormalizedPoseLandmark | undefined, right: NormalizedPoseLandmark | undefined): number | undefined {
  if (!left || !right) return undefined;
  return Math.atan2(right.y - left.y, right.x - left.x) * 180 / Math.PI;
}

function horizontalDeviation(from: NormalizedPoseLandmark | undefined, to: NormalizedPoseLandmark | undefined): number | undefined {
  if (!from || !to) return undefined;
  return Math.abs(Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI);
}

function frontKneeAnkleOffset(points: Readonly<Partial<Record<LandmarkName, NormalizedPoseLandmark>>>, leftKnee: number | undefined, rightKnee: number | undefined): number | undefined {
  const useLeft = leftKnee !== undefined && (rightKnee === undefined || leftKnee <= rightKnee);
  const knee = useLeft ? points.left_knee : points.right_knee;
  const ankle = useLeft ? points.left_ankle : points.right_ankle;
  return ratio(knee && ankle ? Math.abs(knee.x - ankle.x) : undefined, distance(points.left_shoulder, points.right_shoulder));
}

function raisedKneeRotation(points: Readonly<Partial<Record<LandmarkName, NormalizedPoseLandmark>>>, leftKnee: number | undefined, rightKnee: number | undefined): number | undefined {
  const useLeft = leftKnee !== undefined && (rightKnee === undefined || leftKnee <= rightKnee);
  const hip = useLeft ? points.left_hip : points.right_hip;
  const knee = useLeft ? points.left_knee : points.right_knee;
  if (!hip || !knee) return undefined;
  return Math.abs(Math.atan2(knee.x - hip.x, knee.y - hip.y) * 180 / Math.PI);
}

function singleLegStability(points: Readonly<Partial<Record<LandmarkName, NormalizedPoseLandmark>>>, recentCenters: readonly { x: number; y: number }[]): number | undefined {
  const ankleDistance = distance(points.left_ankle, points.right_ankle);
  if (ankleDistance === undefined) return undefined;
  return clamp(1 - ankleDistance / 2, 0, 1) * (1 - clamp(centerDisplacement(recentCenters) ?? 0, 0, 1));
}

function centerDisplacement(points: readonly { x: number; y: number }[]): number | undefined {
  if (points.length < 2) return 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return Math.hypot(last.x - first.x, last.y - first.y);
}

function hipCenter(points: Readonly<Partial<Record<LandmarkName, NormalizedPoseLandmark>>>): { x: number; y: number; z: number } | undefined {
  return midpoint(points.left_hip, points.right_hip);
}

function midpoint(first: NormalizedPoseLandmark | undefined, second: NormalizedPoseLandmark | undefined): { x: number; y: number; z: number } | undefined {
  if (!first || !second) return undefined;
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2, z: (first.z + second.z) / 2 };
}

function distance(first: NormalizedPoseLandmark | { x: number; y: number; z?: number } | undefined, second: NormalizedPoseLandmark | { x: number; y: number; z?: number } | undefined): number | undefined {
  if (!first || !second) return undefined;
  return Math.hypot(first.x - second.x, first.y - second.y, (first.z ?? 0) - (second.z ?? 0));
}

function ratio(numerator: number | undefined, denominator: number | undefined): number | undefined {
  return numerator === undefined || denominator === undefined || denominator < 0.000001 ? undefined : numerator / denominator;
}

function derivative(current: number | undefined, previous: number | undefined, elapsedMs: number, invert = false): number | undefined {
  if (current === undefined || previous === undefined || elapsedMs <= 0) return 0;
  const value = (current - previous) / elapsedMs * 1000;
  return invert ? -value : value;
}

function minimumVisibility(points: Readonly<Partial<Record<LandmarkName, NormalizedPoseLandmark>>>): number {
  const values = Object.values(points).map((point) => point?.visibility ?? 0);
  return values.length ? Math.min(...values) : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
