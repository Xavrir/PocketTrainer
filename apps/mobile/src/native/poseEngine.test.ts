import {
  COMPACT_POSE_EVENT_TYPES,
  isCompactPoseEngineEvent,
} from './poseEngine';

it('represents the required compact native event vocabulary', () => {
  expect(COMPACT_POSE_EVENT_TYPES).toEqual([
    'calibration_status',
    'tracking_status',
    'movement_update',
    'rep_complete',
    'feedback_changed',
    'session_complete',
    'recoverable_error',
  ]);
});

it('rejects raw frames and landmarks at the React Native boundary', () => {
  expect(
    isCompactPoseEngineEvent({
      type: 'movement_update',
      state: 'bottom',
      phase: 'bottom',
      repCount: 1,
      validRepCount: 1,
      validHoldDurationMs: 0,
      formScore: null,
    }),
  ).toBe(true);
  expect(
    isCompactPoseEngineEvent({
      type: 'movement_update',
      phase: 'bottom',
      formScore: null,
      landmarks: [{ x: 0, y: 0 }],
    }),
  ).toBe(false);
});
