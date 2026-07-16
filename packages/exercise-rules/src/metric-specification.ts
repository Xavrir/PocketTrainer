import type { PoseMetric, PoseMetricSpecification } from "@pockettrainer/contracts";

const specification = <Metric extends PoseMetric>(
  metric: Metric,
  definition: Omit<PoseMetricSpecification, "metric" | "selectionRule">,
): PoseMetricSpecification => Object.freeze({
  metric,
  ...definition,
  selectionRule: selectionRuleFor(definition.sideSelection),
});

function selectionRuleFor(
  sideSelection: PoseMetricSpecification["sideSelection"],
): PoseMetricSpecification["selectionRule"] {
  if (sideSelection === "most_visible_side") return "highest_minimum_landmark_visibility_left_tie";
  if (sideSelection === "front_leg") return "smallest_knee_angle_left_tie";
  if (sideSelection === "bilateral") return "both_anatomical_sides";
  if (sideSelection === "anatomical_left" || sideSelection === "anatomical_right") {
    return "fixed_anatomical_side";
  }
  return "none";
}

export const POSE_METRIC_SPECIFICATION_VERSION = 1 as const;

export const POSE_METRIC_SPECIFICATION_V1 = Object.freeze({
  knee_angle: specification("knee_angle", {
    unit: "degrees", sideSelection: "most_visible_side", normalization: "none",
    signedDirection: "unsigned", formulaId: "interior_angle_hip_knee_ankle_after_mirror_v1",
  }),
  knee_angular_velocity: specification("knee_angular_velocity", {
    unit: "degrees_per_second", sideSelection: "most_visible_side", normalization: "none",
    signedDirection: "positive_extension", formulaId: "smoothed_knee_angle_first_derivative_v1",
  }),
  hip_angle: specification("hip_angle", {
    unit: "degrees", sideSelection: "most_visible_side", normalization: "none",
    signedDirection: "unsigned", formulaId: "interior_angle_shoulder_hip_knee_after_mirror_v1",
  }),
  elbow_angle: specification("elbow_angle", {
    unit: "degrees", sideSelection: "most_visible_side", normalization: "none",
    signedDirection: "unsigned", formulaId: "interior_angle_shoulder_elbow_wrist_after_mirror_v1",
  }),
  elbow_angular_velocity: specification("elbow_angular_velocity", {
    unit: "degrees_per_second", sideSelection: "most_visible_side", normalization: "none",
    signedDirection: "positive_extension", formulaId: "smoothed_elbow_angle_first_derivative_v1",
  }),
  torso_lean: specification("torso_lean", {
    unit: "degrees", sideSelection: "bilateral", normalization: "none",
    signedDirection: "unsigned", formulaId: "absolute_sagittal_torso_axis_from_world_vertical_v1",
  }),
  body_line_deviation: specification("body_line_deviation", {
    unit: "degrees", sideSelection: "most_visible_side", normalization: "none",
    signedDirection: "unsigned", formulaId: "absolute_shoulder_hip_ankle_collinearity_deviation_v1",
  }),
  hip_vertical_velocity: specification("hip_vertical_velocity", {
    unit: "normalized_per_second", sideSelection: "bilateral", normalization: "torso_length",
    signedDirection: "positive_up", formulaId: "hip_midpoint_world_vertical_first_derivative_v1",
  }),
  hip_tilt: specification("hip_tilt", {
    unit: "degrees", sideSelection: "bilateral", normalization: "none",
    signedDirection: "positive_left_side_up", formulaId: "anatomical_left_to_right_hip_axis_after_mirror_v1",
  }),
  shoulder_tilt: specification("shoulder_tilt", {
    unit: "degrees", sideSelection: "bilateral", normalization: "none",
    signedDirection: "positive_left_side_up", formulaId: "anatomical_left_to_right_shoulder_axis_after_mirror_v1",
  }),
  arm_horizontal_deviation_left: specification("arm_horizontal_deviation_left", {
    unit: "degrees", sideSelection: "anatomical_left", normalization: "none",
    signedDirection: "unsigned", formulaId: "absolute_left_shoulder_wrist_axis_from_horizontal_v1",
  }),
  arm_horizontal_deviation_right: specification("arm_horizontal_deviation_right", {
    unit: "degrees", sideSelection: "anatomical_right", normalization: "none",
    signedDirection: "unsigned", formulaId: "absolute_right_shoulder_wrist_axis_from_horizontal_v1",
  }),
  front_knee_ankle_offset: specification("front_knee_ankle_offset", {
    unit: "normalized_ratio", sideSelection: "front_leg", normalization: "shoulder_width",
    signedDirection: "unsigned", formulaId: "absolute_frontal_knee_ankle_horizontal_offset_v1",
  }),
  stance_width_ratio: specification("stance_width_ratio", {
    unit: "normalized_ratio", sideSelection: "bilateral", normalization: "shoulder_width",
    signedDirection: "unsigned", formulaId: "ankle_distance_over_shoulder_width_v1",
  }),
  single_leg_stability: specification("single_leg_stability", {
    unit: "normalized_ratio", sideSelection: "most_visible_side", normalization: "torso_length",
    signedDirection: "unsigned", formulaId: "one_minus_clamped_support_center_rms_500ms_v1",
  }),
  raised_knee_lateral_rotation: specification("raised_knee_lateral_rotation", {
    unit: "degrees", sideSelection: "most_visible_side", normalization: "none",
    signedDirection: "unsigned", formulaId: "raised_thigh_frontal_abduction_angle_v1",
  }),
  center_displacement: specification("center_displacement", {
    unit: "normalized_ratio", sideSelection: "bilateral", normalization: "torso_length",
    signedDirection: "unsigned", formulaId: "hip_midpoint_rms_displacement_500ms_v1",
  }),
  valid_hold_duration_ms: specification("valid_hold_duration_ms", {
    unit: "milliseconds", sideSelection: "not_applicable", normalization: "none",
    signedDirection: "unsigned", formulaId: "cumulative_active_state_predicate_time_monotonic_v1",
  }),
  pose_confidence: specification("pose_confidence", {
    unit: "confidence", sideSelection: "not_applicable", normalization: "none",
    signedDirection: "unsigned", formulaId: "minimum_required_landmark_visibility_presence_v1",
  }),
}) satisfies Readonly<Record<PoseMetric, PoseMetricSpecification>>;
