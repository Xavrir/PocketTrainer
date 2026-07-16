import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ProfileScreen } from './ProfileScreen';

function textValues(renderer: ReactTestRenderer.ReactTestRenderer): string[] {
  return renderer.root
    .findAll(node => typeof node.props.children === 'string')
    .map(node => node.props.children as string);
}

describe('ProfileScreen', () => {
  it('renders profile values supplied by the integration', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ProfileScreen
          consent="inactive"
          email="raka@example.com"
          equipment="Matras yoga"
          limitations="Lutut sensitif"
          locale="en"
          name="Raka"
          schedule="Monday, Wednesday"
        />,
      );
    });

    expect(textValues(renderer)).toEqual(
      expect.arrayContaining([
        'Monday, Wednesday',
        'Matras yoga',
        'Lutut sensitif',
        'English',
        'Inactive',
      ]),
    );
  });

  it('reports delete failures and exposes a pending state', async () => {
    let rejectDelete!: (error: Error) => void;
    const onDeleteAccount = jest.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectDelete = reject;
        }),
    );
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ProfileScreen onDeleteAccount={onDeleteAccount} />,
      );
    });

    const deleteButton = renderer.root.find(
      node => node.props.accessibilityLabel === 'Hapus akun dan data',
    );
    let press!: Promise<void>;
    ReactTestRenderer.act(() => {
      press = deleteButton.props.onPress();
    });
    expect(textValues(renderer)).toContain('Menghapus…');

    await ReactTestRenderer.act(async () => {
      rejectDelete(new Error('network unavailable'));
      await press;
    });

    expect(onDeleteAccount).toHaveBeenCalledTimes(1);
    expect(textValues(renderer)).toContain(
      'Belum bisa menghapus akun. Coba lagi atau hubungi dukungan.',
    );
  });
});
