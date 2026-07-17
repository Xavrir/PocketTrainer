import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';
import { NutritionFactsScreen } from '../screens/NutritionFactsScreen';
import { NutritionDiaryScreen } from '../screens/NutritionDiaryScreen';
import { ScanFoodScreen } from '../screens/ScanFoodScreen';
import { calculateDailyTotals } from './types';
import type { NutritionDiaryEntry, NutritionFacts } from './types';
import type { FoodScanResult } from '../native/foodScanner';

const facts: NutritionFacts = {
  foodName: 'Oat bar',
  servingLabel: '1 batang (40 g)',
  status: 'needs-confirmation',
  source: null,
  nutrients: {
    calories: 160,
    proteinGrams: null,
    carbohydrateGrams: 24,
    fatGrams: 5,
    fiberGrams: null,
    sodiumMilligrams: 90,
    sugarGrams: null,
  },
};

const completeFacts: NutritionFacts = {
  ...facts,
  status: 'verified',
  nutrients: {
    calories: 160,
    proteinGrams: 4,
    carbohydrateGrams: 24,
    fatGrams: 5,
    fiberGrams: 3,
    sodiumMilligrams: 90,
    sugarGrams: 8,
  },
};

const entry: NutritionDiaryEntry = {
  id: 'oat-bar',
  mealLabel: 'Camilan',
  loggedAtLabel: '10:00',
  servings: 2,
  facts,
};

function serialized(renderer: ReactTestRenderer.ReactTestRenderer): string {
  return JSON.stringify(renderer.toJSON());
}

describe('nutrition screens', () => {
  it('keeps camera fallback explicit and submits a manual barcode', async () => {
    const onSubmitBarcode = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ScanFoodScreen
          onSubmitBarcode={onSubmitBarcode}
          onSubmitManualLabel={jest.fn()}
        />,
      );
    });

    expect(serialized(renderer)).toContain('Belum tersedia di build ini.');
    const input = renderer.root.find(
      node => node.props.accessibilityLabel === 'Barcode produk',
    );
    ReactTestRenderer.act(() => input.props.onChangeText('8991234567890'));
    const submit = renderer.root.find(
      node =>
        node.props.accessibilityLabel === undefined &&
        node.props.label === 'Cari barcode',
    );
    ReactTestRenderer.act(() => submit.props.onPress());
    expect(onSubmitBarcode).toHaveBeenCalledWith('8991234567890');
  });

  it('runs the native scanner, forwards a valid result, and deduplicates repeats', async () => {
    const onSubmitBarcode = jest.fn();
    const onStartScanner = jest
      .fn<Promise<FoodScanResult>, []>()
      .mockResolvedValue({ status: 'success', barcode: '8991234567890' });
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ScanFoodScreen
          onStartScanner={onStartScanner}
          onSubmitBarcode={onSubmitBarcode}
          onSubmitManualLabel={jest.fn()}
          scannerCapability={{ available: true, reason: 'ready' }}
        />,
      );
    });

    const scanButton = renderer.root.find(
      node => node.props.accessibilityLabel === 'Mulai pemindaian kamera',
    );
    await ReactTestRenderer.act(async () => {
      await scanButton.props.onPress();
      await scanButton.props.onPress();
    });

    expect(onStartScanner).toHaveBeenCalledTimes(2);
    expect(onSubmitBarcode).toHaveBeenCalledTimes(1);
    expect(serialized(renderer)).toContain(
      'Barcode yang sama baru saja dipindai.',
    );
  });

  it('shows a validation error instead of sending an unsupported manual barcode', async () => {
    const onSubmitBarcode = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ScanFoodScreen
          onSubmitBarcode={onSubmitBarcode}
          onSubmitManualLabel={jest.fn()}
        />,
      );
    });
    const input = renderer.root.find(
      node => node.props.accessibilityLabel === 'Barcode produk',
    );
    ReactTestRenderer.act(() => input.props.onChangeText('12345'));
    const submit = renderer.root.find(
      node => node.props.label === 'Cari barcode',
    );
    ReactTestRenderer.act(() => submit.props.onPress());

    expect(onSubmitBarcode).not.toHaveBeenCalled();
    expect(serialized(renderer)).toContain(
      'Masukkan barcode 8, 12, atau 13 digit tanpa huruf.',
    );
  });

  it('turns manual label fields into explicit nullable nutrition input', async () => {
    const onSubmitManualLabel = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ScanFoodScreen
          onSubmitBarcode={jest.fn()}
          onSubmitManualLabel={onSubmitManualLabel}
        />,
      );
    });
    const tabs = renderer.root.findAll(
      node =>
        node.props.accessibilityRole === 'tab' &&
        typeof node.props.onPress === 'function',
    );
    ReactTestRenderer.act(() => tabs[1].props.onPress());
    const input = (label: string) =>
      renderer.root.find(node => node.props.accessibilityLabel === label);
    ReactTestRenderer.act(() => {
      input('Nama makanan').props.onChangeText('Nasi merah');
      input('Ukuran porsi').props.onChangeText('1 mangkuk (150 g)');
      input('Kalori (kkal)').props.onChangeText('210');
    });
    const submit = renderer.root.find(
      node => node.props.label === 'Tinjau data',
    );
    ReactTestRenderer.act(() => submit.props.onPress());
    expect(onSubmitManualLabel).toHaveBeenCalledWith(
      expect.objectContaining({
        foodName: 'Nasi merah',
        servingLabel: '1 mangkuk (150 g)',
        nutrients: expect.objectContaining({
          calories: 210,
          proteinGrams: null,
        }),
      }),
    );
  });

  it('reviews AI candidates without saving or marking them verified', async () => {
    const onRequestLabelCandidates = jest.fn().mockResolvedValue({
      candidates: [
        {
          foodName: 'Nasi merah pilihan',
          servingLabel: '1 mangkuk (150 g)',
          nutrients: {
            calories: 210,
            proteinGrams: 5,
            carbohydrateGrams: 42,
            fatGrams: 2,
            fiberGrams: null,
            sodiumMilligrams: 12,
            sugarGrams: 11,
          },
        },
      ],
      warning: 'Saran AI saja. Periksa label kemasan.',
    });
    const onSubmitManualLabel = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ScanFoodScreen
          onRequestLabelCandidates={onRequestLabelCandidates}
          onSubmitBarcode={jest.fn()}
          onSubmitManualLabel={onSubmitManualLabel}
        />,
      );
    });
    const tabs = renderer.root.findAll(
      node =>
        node.props.accessibilityRole === 'tab' &&
        typeof node.props.onPress === 'function',
    );
    ReactTestRenderer.act(() => tabs[1].props.onPress());
    const foodNameInput = renderer.root.find(
      node => node.props.accessibilityLabel === 'Nama makanan',
    );
    ReactTestRenderer.act(() => foodNameInput.props.onChangeText('Nasi merah'));
    const aiButton = renderer.root.find(
      node => node.props.label === 'Bantuan AI',
    );
    await ReactTestRenderer.act(async () => {
      aiButton.props.onPress();
      await Promise.resolve();
    });

    expect(onRequestLabelCandidates).toHaveBeenCalledWith('Nasi merah');
    expect(serialized(renderer)).toContain('BELUM DIVERIFIKASI');
    expect(serialized(renderer)).toContain('Nasi merah pilihan');
    expect(onSubmitManualLabel).not.toHaveBeenCalled();

    const reviewButton = renderer.root.find(
      node => node.props.label === 'Gunakan untuk tinjau',
    );
    ReactTestRenderer.act(() => reviewButton.props.onPress());
    expect(onSubmitManualLabel).not.toHaveBeenCalled();
    expect(
      renderer.root.find(node => node.props.accessibilityLabel === 'Serat (g)')
        .props.value,
    ).toBe('');

    const submit = renderer.root.find(
      node => node.props.label === 'Tinjau data',
    );
    ReactTestRenderer.act(() => submit.props.onPress());
    expect(onSubmitManualLabel).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLabel: 'Bantuan AI (belum diverifikasi)',
        nutrients: expect.objectContaining({
          calories: 210,
          fiberGrams: null,
          sugarGrams: 11,
        }),
      }),
    );
  });

  it('renders missing nutrition values as unknown and exposes the source state', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <NutritionFactsScreen
          facts={facts}
          onConfirm={jest.fn()}
          onEdit={jest.fn()}
        />,
      );
    });
    const output = serialized(renderer);
    expect(output).toContain('PERLU KONFIRMASI');
    expect(output).toContain('Belum diketahui');
    expect(output).toContain('Sumber belum tersedia.');
    expect(output).not.toContain('Protein&quot;:0');
  });

  it('calculates known diary subtotals without treating unknown values as zero', async () => {
    const totals = calculateDailyTotals([entry]);
    expect(totals.calories).toEqual({
      value: 320,
      complete: true,
      unknownEntryCount: 0,
    });
    expect(totals.proteinGrams).toEqual({
      value: 0,
      complete: false,
      unknownEntryCount: 1,
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <NutritionDiaryScreen entries={[entry]} onAddFood={jest.fn()} />,
      );
    });
    const output = serialized(renderer);
    expect(output).toContain('320');
    expect(output).toContain('—*');
    expect(output).toContain('Sumber belum tersedia');
    expect(
      renderer.root.findAll(
        node => node.props.accessibilityLabel === 'Buka catatan Oat bar',
      ),
    ).toHaveLength(0);
  });

  it('prefers server daily totals and labels their confirmation state', async () => {
    const totals = calculateDailyTotals([entry]);
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <NutritionDiaryScreen
          dailySummary={{
            status: 'server-confirmed',
            totals: {
              ...totals,
              calories: {
                complete: true,
                unknownEntryCount: 0,
                value: 777,
              },
            },
          }}
          entries={[
            { ...entry, facts: completeFacts, syncStatus: 'server-confirmed' },
          ]}
          onAddFood={jest.fn()}
        />,
      );
    });

    const output = serialized(renderer);
    expect(output).toContain('777');
    expect(output).toContain('Tersimpan di server');
    expect(output).not.toContain('Subtotal dari catatan yang tampil');
  });

  it('renders loading, retry, and each honest persistence state explicitly', async () => {
    const onRetry = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <NutritionDiaryScreen entries={[]} isLoading onAddFood={jest.fn()} />,
      );
    });
    expect(serialized(renderer)).toContain('Memuat catatan dari server');

    await ReactTestRenderer.act(() => {
      renderer.update(
        <NutritionDiaryScreen
          entries={[]}
          loadError="Koneksi terputus."
          onAddFood={jest.fn()}
          onRetry={onRetry}
        />,
      );
    });
    const retry = renderer.root.find(
      node => node.props.accessibilityLabel === 'Coba lagi memuat diary',
    );
    ReactTestRenderer.act(() => retry.props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);

    const statuses = [
      'server-confirmed',
      'waiting-to-sync',
      'session-only',
      'sync-failed',
    ] as const;
    await ReactTestRenderer.act(() => {
      renderer.update(
        <NutritionDiaryScreen
          entries={statuses.map((syncStatus, index) => ({
            ...entry,
            facts: completeFacts,
            id: `${entry.id}-${index}`,
            syncStatus,
          }))}
          onAddFood={jest.fn()}
        />,
      );
    });
    const output = serialized(renderer);
    expect(output).toContain('Tersimpan di server');
    expect(output).toContain('Menunggu sinkronisasi');
    expect(output).toContain('Hanya tersimpan selama sesi ini');
    expect(output).toContain('Sinkronisasi gagal');
  });

  it('keeps incomplete nutrition visibly session-only', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <NutritionDiaryScreen
          entries={[{ ...entry, syncStatus: 'server-confirmed' }]}
          onAddFood={jest.fn()}
        />,
      );
    });

    const output = serialized(renderer);
    expect(output).toContain('Hanya tersimpan selama sesi ini');
    expect(output).not.toContain('Tersimpan di server');
  });

  it('opens a diary entry and submits meal type and serving edits', async () => {
    const onSelectEntry = jest.fn();
    const onUpdateEntry = jest.fn<Promise<void>, [string, unknown]>(
      async () => undefined,
    );
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <NutritionDiaryScreen
          entries={[{ ...entry, mealType: 'snack' }]}
          onAddFood={jest.fn()}
          onSelectEntry={onSelectEntry}
          onUpdateEntry={onUpdateEntry}
        />,
      );
    });

    const open = renderer.root.find(
      node => node.props.accessibilityLabel === 'Buka catatan Oat bar',
    );
    ReactTestRenderer.act(() => open.props.onPress());
    expect(onSelectEntry).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'oat-bar' }),
    );

    const mealOptions = renderer.root.findAll(
      node =>
        node.props.accessibilityRole === 'radio' &&
        typeof node.props.onPress === 'function',
    );
    ReactTestRenderer.act(() => {
      mealOptions[1].props.onPress();
      renderer.root
        .find(node => node.props.accessibilityLabel === 'Jumlah porsi')
        .props.onChangeText('1,5');
    });
    const save = renderer.root.find(
      node => node.props.accessibilityLabel === 'Simpan perubahan makanan',
    );
    await ReactTestRenderer.act(async () => {
      await save.props.onPress();
    });
    expect(onUpdateEntry).toHaveBeenCalledWith('oat-bar', {
      mealType: 'lunch',
      servings: 1.5,
    });
  });

  it('requires destructive confirmation before deleting an entry', async () => {
    const onDeleteEntry = jest.fn<Promise<void>, [string]>(
      async () => undefined,
    );
    const alert = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <NutritionDiaryScreen
          entries={[entry]}
          onAddFood={jest.fn()}
          onDeleteEntry={onDeleteEntry}
        />,
      );
    });
    ReactTestRenderer.act(() => {
      renderer.root
        .find(node => node.props.accessibilityLabel === 'Buka catatan Oat bar')
        .props.onPress();
    });
    ReactTestRenderer.act(() => {
      renderer.root
        .find(node => node.props.accessibilityLabel === 'Hapus catatan makanan')
        .props.onPress();
    });

    expect(onDeleteEntry).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2];
    const destructive = buttons?.find(button => button.style === 'destructive');
    await ReactTestRenderer.act(async () => {
      await destructive?.onPress?.();
    });
    expect(onDeleteEntry).toHaveBeenCalledWith('oat-bar');
    alert.mockRestore();
  });
});
