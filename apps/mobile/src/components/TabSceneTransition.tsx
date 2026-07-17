import React, { ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';
import { AppTab } from './BottomNav';
import { useReducedMotion } from './useReducedMotion';

const tabOrder: readonly AppTab[] = [
  'home',
  'learn',
  'coach',
  'progress',
  'profile',
];

const useNativeDriver = Platform.OS !== 'web';

export function getTabTransitionDirection(
  previousTab: AppTab,
  nextTab: AppTab,
): 1 | -1 {
  return tabOrder.indexOf(nextTab) >= tabOrder.indexOf(previousTab) ? 1 : -1;
}

type TabSceneTransitionProps = Readonly<{
  activeTab: AppTab;
  children: ReactNode;
}>;

export function TabSceneTransition({
  activeTab,
  children,
}: TabSceneTransitionProps) {
  const reducedMotion = useReducedMotion();
  const positionProgress = useRef(new Animated.Value(1)).current;
  const opacityProgress = useRef(new Animated.Value(1)).current;
  const previousTab = useRef(activeTab);
  const direction = getTabTransitionDirection(previousTab.current, activeTab);

  useEffect(() => {
    if (previousTab.current === activeTab) return;
    previousTab.current = activeTab;
    positionProgress.stopAnimation();
    opacityProgress.stopAnimation();
    positionProgress.setValue(0);
    opacityProgress.setValue(0);

    const positionAnimation = reducedMotion
      ? Animated.timing(positionProgress, {
          duration: 160,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver,
        })
      : Animated.spring(positionProgress, {
          friction: 26,
          tension: 220,
          toValue: 1,
          useNativeDriver,
        });
    const opacityAnimation = Animated.timing(opacityProgress, {
      duration: reducedMotion ? 160 : 180,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver,
    });

    Animated.parallel([positionAnimation, opacityAnimation]).start();
    return () => {
      positionAnimation.stop();
      opacityAnimation.stop();
    };
  }, [activeTab, opacityProgress, positionProgress, reducedMotion]);

  const translateX = reducedMotion
    ? 0
    : positionProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [direction * 16, 0],
      });

  return (
    <Animated.View
      style={[
        styles.scene,
        {
          opacity: opacityProgress,
          transform: [{ translateX }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1 },
});
