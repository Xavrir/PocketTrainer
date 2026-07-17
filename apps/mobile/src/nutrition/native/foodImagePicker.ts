import { NativeModules, Platform } from 'react-native';

export type FoodImageAsset = Readonly<{
  imageBase64: string;
  mimeType: 'image/jpeg';
  sizeBytes: number;
}>;

export type FoodImagePickerCapability = Readonly<{
  available: boolean;
  reason: string;
}>;

type NativeFoodImagePicker = {
  captureImage: () => Promise<FoodImageAsset | null>;
  pickImage: () => Promise<FoodImageAsset | null>;
};

const nativeFoodImagePicker = NativeModules.FoodImagePicker as
  | NativeFoodImagePicker
  | undefined;

const unavailableReason =
  'Pemilih foto native belum tersedia di build ini. Salin angka dari label secara manual.';

export function getFoodImagePickerCapability(): FoodImagePickerCapability {
  if (Platform.OS === 'android' && nativeFoodImagePicker) {
    return {
      available: true,
      reason:
        'Pilih foto label dari galeri/file atau ambil foto baru. Foto diproses sekali untuk saran AI, tidak disimpan oleh aplikasi atau server.',
    };
  }
  return { available: false, reason: unavailableReason };
}

export function captureFoodImage(): Promise<FoodImageAsset | null> {
  if (Platform.OS !== 'android' || !nativeFoodImagePicker) {
    return Promise.reject(new Error(unavailableReason));
  }
  return nativeFoodImagePicker.captureImage();
}

export function pickFoodImage(): Promise<FoodImageAsset | null> {
  if (Platform.OS !== 'android' || !nativeFoodImagePicker) {
    return Promise.reject(new Error(unavailableReason));
  }
  return nativeFoodImagePicker.pickImage();
}
