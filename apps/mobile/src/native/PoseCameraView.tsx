import { StyleProp, ViewStyle } from 'react-native';
import { PoseEngineEvent } from './poseEngine';

export const isNativePoseCameraAvailable = false;

export function PoseCameraView(_props: {
  exerciseKey: string;
  paused: boolean;
  onPoseEvent: (event: PoseEngineEvent) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return null;
}
