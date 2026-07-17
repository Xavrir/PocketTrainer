import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
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
    expect(serialized(renderer)).toContain('Barcode yang sama baru saja dipindai.');
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
    const submit = renderer.root.find(node => node.props.label === 'Cari barcode');
    ReactTestRenderer.act(() => submit.props.onPress());

    expect(onSubmitBarcode).not.toHaveBeenCalled();
    expect(serialized(renderer)).toContain('Masukkan barcode 8, 12, atau 13 digit tanpa huruf.');
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
  });
});
