/** @format */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App, { Flow, resolveAuthenticatedStartFlow } from '../App';
import { AppTab } from '../src/components/BottomNav';

jest.mock('react-native-safe-area-context', () => {
  const ReactRuntime = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) =>
      ReactRuntime.createElement(View, props, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

async function renderApp(initialFlow: Flow, initialTab?: AppTab) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <App initialFlow={initialFlow} initialTab={initialTab} />,
    );
  });
  return renderer;
}

it.each<[Flow, string]>([
  ['welcome', 'Bergerak lebih baik.'],
  ['consent', 'Kendalimu tetap milikmu.'],
  ['goal', 'Apa yang ingin kamu bangun?'],
  ['assessment', 'Kenali titik awalmu.'],
  ['lesson', 'Pilih lesson dari catalog.'],
  ['camera', 'Beri ruang untuk bergerak.'],
  ['live', 'Sesi belum siap.'],
  ['result', 'Belum ada hasil sesi.'],
  ['safe-variation', 'Squat dibantu kursi'],
  ['auth-preview', 'Lanjutkan progresmu.'],
  ['auth-config-preview', 'Auth belum terhubung.'],
])('renders the %s flow', async (flow, expected) => {
  const renderer = await renderApp(flow);
  expect(JSON.stringify(renderer.toJSON())).toContain(expected);
});

it.each<[AppTab, string]>([
  ['home', 'Jadikan hari ini'],
  ['learn', 'Repetisi kecil.'],
  ['coach', 'Siap bergerak?'],
  ['progress', 'Progres belum tersedia.'],
  ['profile', 'Pengguna PocketTrainer'],
])('renders the %s tab', async (tab, expected) => {
  const renderer = await renderApp('main', tab);
  expect(JSON.stringify(renderer.toJSON())).toContain(expected);
});

it('routes returning authenticated users past onboarding', () => {
  expect(resolveAuthenticatedStartFlow(undefined, true)).toBe('main');
  expect(resolveAuthenticatedStartFlow(undefined, false)).toBe('welcome');
  expect(resolveAuthenticatedStartFlow('lesson', true)).toBe('lesson');
});
