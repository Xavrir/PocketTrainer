export type PoseEngineEvent =
  | {type: 'calibration_status'; status: 'ready' | 'calibrating' | 'blocked'; reason?: string}
  | {type: 'tracking_status'; confidence: number; visible: boolean}
  | {type: 'movement_update'; phase: string; score: number}
  | {type: 'rep_complete'; rep: number; score: number}
  | {type: 'feedback_changed'; message: string; severity: 'info' | 'caution' | 'stop'}
  | {type: 'session_complete'; reps: number; score: number}
  | {type: 'recoverable_error'; code: string; message: string};

export interface PoseEngine {
  start(exerciseKey: string): Promise<void>;
  stop(): Promise<void>;
  subscribe(listener: (event: PoseEngineEvent) => void): () => void;
}

export const poseEngine: PoseEngine = {
  async start() {}, async stop() {}, subscribe() { return () => {}; },
};
