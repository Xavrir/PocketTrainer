import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { BottomNav } from './BottomNav';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('./useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

function renderNav(activeTab: Parameters<typeof BottomNav>[0]['activeTab']) {
  const onChange = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <BottomNav activeTab={activeTab} onChange={onChange} />,
    );
  });
  return { onChange, renderer };
}

function getTabs(renderer: ReactTestRenderer.ReactTestRenderer) {
  const tabs = renderer.root.findAll(
    node =>
      node.props.accessibilityRole === 'tab' &&
      typeof node.props.accessibilityLabel === 'string' &&
      typeof node.props.onPress === 'function',
  );
  return tabs.filter(
    (tab, index) =>
      tabs.findIndex(
        candidate =>
          candidate.props.accessibilityLabel === tab.props.accessibilityLabel,
      ) === index,
  );
}

it('renders all tabs with the active accessibility state', () => {
  const { renderer } = renderNav('learn');
  const tabs = getTabs(renderer);

  expect(tabs).toHaveLength(5);
  expect(tabs.map(tab => tab.props.accessibilityLabel)).toEqual([
    'Beranda tab',
    'Belajar tab',
    'Pelatih tab',
    'Progres tab',
    'Profil tab',
  ]);
  expect(tabs.map(tab => tab.props.accessibilityState.selected)).toEqual([
    false,
    true,
    false,
    false,
    false,
  ]);
});

it('emits the selected tab when pressed', () => {
  const { onChange, renderer } = renderNav('home');
  const tabs = getTabs(renderer);

  tabs[2].props.onPress();

  expect(onChange).toHaveBeenCalledWith('coach');
});
