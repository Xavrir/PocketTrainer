import { NativeModules, Platform } from 'react-native';

export type PoseEngineEventBase = Readonly<{
  sessionId?: string;
  sequence?: number;
  occurredAt?: string;
}>;

export const COMPACT_POSE_EVENT_TYPES = [
  'calibration_status',
  'tracking_status',
  'movement_update',
  'rep_complete',
  'feedback_changed',
  'session_complete',
  'recoverable_error',
] as const;

export type PoseEngineEvent = PoseEngineEventBase & (
  | {
      type: 'calibration_status';
      status:
        | 'ready'
        | 'too_close'
        | 'too_far'
        | 'low_light'
        | 'body_outside_frame'
        | 'multiple_people'
        | 'wrong_orientation';
      stableDurationMs?: number;
      reason?: string;
    }
  | {
      type: 'tracking_status';
      status?: 'eligible' | 'paused' | 'lost';
      confidence: number;
      visible: boolean;
      missingLandmarks?: readonly string[];
      reason?: string;
    }
  | {
      type: 'movement_update';
      state?: string;
      phase: string;
      repCount?: number;
      validRepCount?: number;
      validHoldDurationMs?: number;
      formScore: number | null;
    }
  | {
      type: 'rep_complete';
      rep: number;
      formScore: number | null;
      confidence: number;
      valid?: boolean;
    }
  | {
      type: 'feedback_changed';
      message: string;
      severity: 'info' | 'caution' | 'stop';
      feedbackKey?: string | null;
    }
  | {
      type: 'session_complete';
      reps: number;
      formScore: number | null;
    }
  | { type: 'recoverable_error'; code: string; message: string; recoverable?: true; messageKey?: string });

export function isCompactPoseEngineEvent(value: unknown): value is PoseEngineEvent {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.type !== 'string' || !COMPACT_POSE_EVENT_TYPES.includes(record.type as (typeof COMPACT_POSE_EVENT_TYPES)[number])) {
    return false;
  }
  return !('frame' in record || 'landmarks' in record || 'rawLandmarks' in record || 'rawFrame' in record);
}

export interface PoseEngine {
  start(exerciseKey: string): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  subscribe(listener: (event: PoseEngineEvent) => void): () => void;
}

const nativePoseEngine = NativeModules.PoseEngine as
  | {
      start(exerciseKey: string): Promise<void>;
      pause(): Promise<void>;
      resume(): Promise<void>;
      stop(): Promise<void>;
    }
  | undefined;

export const poseEngine: PoseEngine = {
  async start(exerciseKey) {
    if (Platform.OS === 'android' && nativePoseEngine) {
      await nativePoseEngine.start(exerciseKey);
    }
  },
  async pause() {
    if (Platform.OS === 'android' && nativePoseEngine) {
      await nativePoseEngine.pause();
    }
  },
  async resume() {
    if (Platform.OS === 'android' && nativePoseEngine) {
      await nativePoseEngine.resume();
    }
  },
  async stop() {
    if (Platform.OS === 'android' && nativePoseEngine) {
      await nativePoseEngine.stop();
    }
  },
  subscribe() {
    return () => {};
  },
};
