import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import {
  getTabTransitionDirection,
  TabSceneTransition,
} from './TabSceneTransition';

jest.mock('./useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

it('maps tab movement to a spatial direction', () => {
  expect(getTabTransitionDirection('home', 'profile')).toBe(1);
  expect(getTabTransitionDirection('profile', 'home')).toBe(-1);
  expect(getTabTransitionDirection('learn', 'learn')).toBe(1);
});

it('renders the latest tab scene when navigation changes quickly', () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <TabSceneTransition activeTab="home">
        <Text>Home scene</Text>
      </TabSceneTransition>,
    );
  });

  ReactTestRenderer.act(() => {
    renderer.update(
      <TabSceneTransition activeTab="learn">
        <Text>Learn scene</Text>
      </TabSceneTransition>,
    );
    renderer.update(
      <TabSceneTransition activeTab="profile">
        <Text>Profile scene</Text>
      </TabSceneTransition>,
    );
  });

  expect(JSON.stringify(renderer.toJSON())).toContain('Profile scene');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Learn scene');
});
