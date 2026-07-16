import { PermissionsAndroid } from 'react-native';

export async function requestCameraPermission(): Promise<boolean> {
  const permission = PermissionsAndroid.PERMISSIONS.CAMERA;
  if (await PermissionsAndroid.check(permission)) return true;

  const result = await PermissionsAndroid.request(permission, {
    title: 'Kamera untuk coaching postur',
    message:
      'PocketTrainer menganalisis postur di perangkat. Frame kamera tidak diunggah.',
    buttonPositive: 'Izinkan kamera',
    buttonNegative: 'Nanti',
  });

  return result === PermissionsAndroid.RESULTS.GRANTED;
}
