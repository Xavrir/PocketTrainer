import { NativeModules, Platform } from 'react-native';

export type FoodScannerCapability = Readonly<{
  available: boolean;
  reason: string;
}>;

export type FoodScanResult =
  | Readonly<{ status: 'success'; barcode: string }>
  | Readonly<{ status: 'cancelled' }>
  | Readonly<{ status: 'error'; reason: string }>
  | Readonly<{ status: 'unavailable'; reason: string }>;

type NativeFoodScanner = {
  startScan: () => Promise<FoodScanResult>;
};

const nativeFoodScanner = NativeModules.FoodScanner as
  | NativeFoodScanner
  | undefined;

const unavailableReason =
  'Pemindai barcode native belum tersedia di build ini. Masukkan nomor secara manual.';

const scannerReadyReason =
  'Google Code Scanner menangani kamera di layar aman dan mengembalikan barcode produk tanpa menyimpan gambar.';

export function normalizeFoodBarcode(value: string): string | null {
  const digits = value.trim();
  return /^\d+$/.test(digits) && [8, 12, 13].includes(digits.length)
    ? digits
    : null;
}

/**
 * The native implementation is Google Code Scanner, which owns its camera
 * surface and is intentionally separate from the movement camera pipeline.
 */
export const foodScannerCapability: FoodScannerCapability = {
  available: Platform.OS === 'android' && Boolean(nativeFoodScanner),
  reason:
    Platform.OS === 'android' && nativeFoodScanner
      ? scannerReadyReason
      : unavailableReason,
};

export function getFoodScannerCapability(): FoodScannerCapability {
  return foodScannerCapability;
}

export function startFoodScanner(): Promise<FoodScanResult> {
  if (Platform.OS !== 'android' || !nativeFoodScanner) {
    return Promise.resolve({ status: 'unavailable', reason: unavailableReason });
  }
  return nativeFoodScanner.startScan().then(result => {
    if (result.status !== 'success') return result;
    const barcode = normalizeFoodBarcode(result.barcode);
    return barcode
      ? { status: 'success', barcode }
      : {
          status: 'error',
          reason: 'Barcode kosong atau format tidak didukung. Masukkan manual.',
        };
  });
}
