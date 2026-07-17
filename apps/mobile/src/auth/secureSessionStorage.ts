import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYCHAIN_SERVICE_PREFIX = 'com.pockettrainer.supabase';

type StorageErrorCode =
  | 'invalid_key'
  | 'secure_storage_unavailable'
  | 'secure_read_failed'
  | 'secure_write_failed'
  | 'secure_delete_failed'
  | 'secure_credential_mismatch'
  | 'legacy_read_failed'
  | 'legacy_cleanup_failed';

interface StringStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

interface KeychainCredential {
  username: string;
  password: string;
}

interface KeychainBridge {
  SECURITY_LEVEL: {
    SECURE_SOFTWARE: unknown;
  };
  STORAGE_TYPE: {
    AES_GCM_NO_AUTH: unknown;
  };
  getGenericPassword(options: {
    service: string;
  }): Promise<false | KeychainCredential>;
  setGenericPassword(
    username: string,
    password: string,
    options: {
      securityLevel: unknown;
      service: string;
      storage: unknown;
    },
  ): Promise<false | object>;
  resetGenericPassword(options: { service: string }): Promise<boolean>;
}

interface SecureSessionStorageDependencies {
  keychain: KeychainBridge;
  legacyStorage: StringStorage;
}

declare const require: (moduleName: string) => unknown;

export class SecureSessionStorageError extends Error {
  constructor(readonly code: StorageErrorCode) {
    super('Secure session storage is unavailable.');
    this.name = 'SecureSessionStorageError';
  }
}

function loadKeychain(): KeychainBridge {
  try {
    return require('react-native-keychain') as KeychainBridge;
  } catch {
    throw new SecureSessionStorageError('secure_storage_unavailable');
  }
}

function serviceFor(key: string): string {
  if (!key) throw new SecureSessionStorageError('invalid_key');
  return `${KEYCHAIN_SERVICE_PREFIX}.${encodeURIComponent(key)}`;
}

function secureWriteOptions(keychain: KeychainBridge, service: string) {
  return {
    securityLevel: keychain.SECURITY_LEVEL.SECURE_SOFTWARE,
    service,
    storage: keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
  };
}

export function createSecureSessionStorage({
  keychain,
  legacyStorage,
}: SecureSessionStorageDependencies): StringStorage {
  let operationTail: Promise<void> = Promise.resolve();

  function runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = operationTail.then(operation, operation);
    operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function removeLegacy(key: string): Promise<void> {
    try {
      await legacyStorage.removeItem(key);
    } catch {
      throw new SecureSessionStorageError('legacy_cleanup_failed');
    }
  }

  async function writeSecure(key: string, value: string): Promise<void> {
    const service = serviceFor(key);
    let result: false | object;
    try {
      result = await keychain.setGenericPassword(
        key,
        value,
        secureWriteOptions(keychain, service),
      );
    } catch {
      throw new SecureSessionStorageError('secure_write_failed');
    }
    if (!result) {
      throw new SecureSessionStorageError('secure_write_failed');
    }
  }

  return {
    getItem: key =>
      runExclusive(async () => {
        const service = serviceFor(key);
        let credential: false | KeychainCredential;
        try {
          credential = await keychain.getGenericPassword({ service });
        } catch {
          throw new SecureSessionStorageError('secure_read_failed');
        }

        if (credential) {
          if (credential.username !== key) {
            throw new SecureSessionStorageError('secure_credential_mismatch');
          }
          await removeLegacy(key);
          return credential.password;
        }

        let legacyValue: string | null;
        try {
          legacyValue = await legacyStorage.getItem(key);
        } catch {
          throw new SecureSessionStorageError('legacy_read_failed');
        }
        if (legacyValue === null) return null;

        await writeSecure(key, legacyValue);
        await removeLegacy(key);
        return legacyValue;
      }),

    setItem: (key, value) =>
      runExclusive(async () => {
        await writeSecure(key, value);
        await removeLegacy(key);
      }),

    removeItem: key =>
      runExclusive(async () => {
        const service = serviceFor(key);
        let credential: false | KeychainCredential;
        try {
          credential = await keychain.getGenericPassword({ service });
        } catch {
          throw new SecureSessionStorageError('secure_read_failed');
        }

        if (credential) {
          let removed: boolean;
          try {
            removed = await keychain.resetGenericPassword({ service });
          } catch {
            throw new SecureSessionStorageError('secure_delete_failed');
          }
          if (!removed) {
            throw new SecureSessionStorageError('secure_delete_failed');
          }
        }

        await removeLegacy(key);
      }),
  };
}

let defaultStorage: StringStorage | undefined;

function getDefaultStorage(): StringStorage {
  defaultStorage ??= createSecureSessionStorage({
    keychain: loadKeychain(),
    legacyStorage: AsyncStorage,
  });
  return defaultStorage;
}

export const secureSessionStorage: StringStorage = {
  getItem: key => getDefaultStorage().getItem(key),
  setItem: (key, value) => getDefaultStorage().setItem(key, value),
  removeItem: key => getDefaultStorage().removeItem(key),
};
