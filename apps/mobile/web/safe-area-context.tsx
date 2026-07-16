import React from 'react';
import { View, ViewProps } from 'react-native';
export const SafeAreaProvider = ({
  children,
}: {
  children?: React.ReactNode;
}) => <>{children}</>;
export const SafeAreaView = ({
  edges: _,
  ...props
}: ViewProps & { edges?: string[] }) => <View {...props} />;
export const useSafeAreaInsets = () => ({
  top: 0,
  right: 0,
  bottom: 20,
  left: 0,
});
