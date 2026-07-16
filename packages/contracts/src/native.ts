import type { IsoDateTime, Uuid } from "./common.js";
import type {
  CameraView,
  ExerciseDefinition,
  PoseSessionSummary,
  RepResult,
} from "./exercise.js";

export type CalibrationStatus =
  | "ready"
  | "too_close"
  | "too_far"
  | "low_light"
  | "body_outside_frame"
  | "multiple_people"
  | "wrong_orientation";

export type TrackingStatus = "eligible" | "paused" | "lost";

type PoseEventBase = Readonly<{
  sessionId: Uuid;
  sequence: number;
  occurredAt: IsoDateTime;
}>;

export type CalibrationStatusEvent = PoseEventBase &
  Readonly<{
    type: "calibration_status";
    status: CalibrationStatus;
    stableDurationMs: number;
  }>;

export type TrackingStatusEvent = PoseEventBase &
  Readonly<{
    type: "tracking_status";
    status: TrackingStatus;
    confidence: number;
    missingLandmarks: readonly string[];
    messageKey?: string;
  }>;

export type MovementUpdateEvent = PoseEventBase &
  Readonly<{
    type: "movement_update";
    state: string;
    repCount: number;
    validRepCount: number;
    validHoldDurationMs: number;
    formScore: number | null;
  }>;

export type RepCompleteEvent = PoseEventBase &
  Readonly<{
    type: "rep_complete";
    rep: RepResult;
  }>;

export type FeedbackChangedEvent = PoseEventBase &
  Readonly<{
    type: "feedback_changed";
    feedbackKey: string | null;
    severity: "coaching" | "important" | "safety" | null;
  }>;

export type SessionCompleteEvent = PoseEventBase &
  Readonly<{
    type: "session_complete";
    summary: PoseSessionSummary;
  }>;

export type RecoverableErrorEvent = PoseEventBase &
  Readonly<{
    type: "recoverable_error";
    code: string;
    messageKey: string;
    recoverable: true;
  }>;

export type PoseEngineEvent =
  | CalibrationStatusEvent
  | TrackingStatusEvent
  | MovementUpdateEvent
  | RepCompleteEvent
  | FeedbackChangedEvent
  | SessionCompleteEvent
  | RecoverableErrorEvent;

export type PoseSessionOptions = Readonly<{
  exerciseKey: string;
  exerciseDefinitionVersion: number;
  cameraFacing: "front" | "back";
  cameraView: CameraView;
  audioFeedbackEnabled: boolean;
  targetRepetitions?: number;
  targetHoldDurationMs?: number;
}>;

export interface NativePoseEngine {
  loadExercise(definition: ExerciseDefinition): Promise<void>;
  startSession(options: PoseSessionOptions): Promise<Uuid>;
  pauseSession(sessionId: Uuid): Promise<void>;
  resumeSession(sessionId: Uuid): Promise<void>;
  stopSession(sessionId: Uuid): Promise<PoseSessionSummary>;
  setCameraFacing(facing: "front" | "back"): Promise<void>;
  setAudioFeedback(enabled: boolean): Promise<void>;
  addEventListener(listener: (event: PoseEngineEvent) => void): () => void;
}
