import { Share } from 'react-native';
import type { PrivacyExport } from '../api';

type SharePayload = { message: string; title: string };
type ShareOptions = { dialogTitle: string };
type ShareAction = (
  payload: SharePayload,
  options: ShareOptions,
) => Promise<unknown>;

export async function sharePrivacyExport(
  data: PrivacyExport,
  share: ShareAction = Share.share,
): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  await share(
    {
      message: json,
      title: 'PocketTrainer data export.json',
    },
    { dialogTitle: 'Bagikan ekspor data PocketTrainer' },
  );
}
