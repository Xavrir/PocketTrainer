import React from 'react';
import {
  requireNativeComponent,
  StyleProp,
  UIManager,
  ViewStyle,
} from 'react-native';
import { PoseEngineEvent } from './poseEngine';

type NativePoseEvent = { nativeEvent: PoseEngineEvent };
type Props = {
  exerciseKey: string;
  paused: boolean;
  onPoseEvent: (event: PoseEngineEvent) => void;
  style?: StyleProp<ViewStyle>;
};

const hasNativeView = Boolean(UIManager.getViewManagerConfig('PoseCameraView'));
const NativePoseCamera = hasNativeView
  ? requireNativeComponent<{
      exerciseKey: string;
      paused: boolean;
      onPoseEvent: (event: NativePoseEvent) => void;
      style?: StyleProp<ViewStyle>;
    }>('PoseCameraView')
  : null;

export const isNativePoseCameraAvailable = hasNativeView;

export function PoseCameraView({
  exerciseKey,
  paused,
  onPoseEvent,
  style,
}: Props) {
  if (!NativePoseCamera) return null;
  return (
    <NativePoseCamera
      exerciseKey={exerciseKey}
      paused={paused}
      onPoseEvent={event => onPoseEvent(event.nativeEvent)}
      style={style}
    />
  );
}
