import type { PoseMetricGoldenFixture } from "@pockettrainer/contracts";

const point = (x: number, y: number, z = 0, visibility = 1) => ({ x, y, z, visibility });

export const POSE_METRIC_GOLDEN_FIXTURES_V1 = Object.freeze([
  {
    id: "left-knee-right-angle",
    metricSpecificationVersion: 1,
    metric: "knee_angle",
    inputStage: "mirror_corrected_normalized_world",
    landmarks: {
      left_hip: point(0, 1),
      left_knee: point(0, 0),
      left_ankle: point(1, 0),
      right_hip: point(0, 1, 0, 0.2),
      right_knee: point(0, 0, 0, 0.2),
      right_ankle: point(1, 0, 0, 0.2),
    },
    expectedValue: 90,
    tolerance: 0.001,
  },
  {
    id: "left-knee-full-extension",
    metricSpecificationVersion: 1,
    metric: "knee_angle",
    inputStage: "mirror_corrected_normalized_world",
    landmarks: {
      left_hip: point(0, 1),
      left_knee: point(0, 0),
      left_ankle: point(0, -1),
    },
    expectedValue: 180,
    tolerance: 0.001,
  },
  {
    id: "left-elbow-right-angle",
    metricSpecificationVersion: 1,
    metric: "elbow_angle",
    inputStage: "mirror_corrected_normalized_world",
    landmarks: {
      left_shoulder: point(0, 1),
      left_elbow: point(0, 0),
      left_wrist: point(1, 0),
    },
    expectedValue: 90,
    tolerance: 0.001,
  },
  {
    id: "front-knee-offset-tenth-shoulder-width",
    metricSpecificationVersion: 1,
    metric: "front_knee_ankle_offset",
    inputStage: "mirror_corrected_normalized_world",
    landmarks: {
      left_shoulder: point(-0.5, 1),
      right_shoulder: point(0.5, 1),
      left_knee: point(0.1, 0),
      left_ankle: point(0, -1),
    },
    expectedValue: 0.1,
    tolerance: 0.0001,
  },
]) satisfies readonly PoseMetricGoldenFixture[];
