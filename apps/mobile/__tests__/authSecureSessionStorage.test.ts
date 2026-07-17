/** @format */

import {
  createSecureSessionStorage,
  SecureSessionStorageError,
} from '../src/auth/secureSessionStorage';

const SESSION_KEY = 'sb-project-ref-auth-token';
const SERVICE = `com.pockettrainer.supabase.${encodeURIComponent(SESSION_KEY)}`;

function createDependencies() {
  return {
    keychain: {
      SECURITY_LEVEL: {
        SECURE_SOFTWARE: 'secure-software',
      },
      STORAGE_TYPE: {
        AES_GCM_NO_AUTH: 'aes-gcm',
      },
      getGenericPassword: jest.fn(),
      setGenericPassword: jest.fn(),
      resetGenericPassword: jest.fn(),
    },
    legacyStorage: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    },
  };
}

describe('secure Supabase session storage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('restores a secure session and removes any remaining legacy copy', async () => {
    const dependencies = createDependencies();
    dependencies.keychain.getGenericPassword.mockResolvedValue({
      username: SESSION_KEY,
      password: 'secure-session-json',
    });
    dependencies.legacyStorage.removeItem.mockResolvedValue(undefined);
    const storage = createSecureSessionStorage(dependencies);

    await expect(storage.getItem(SESSION_KEY)).resolves.toBe(
      'secure-session-json',
    );

    expect(dependencies.keychain.getGenericPassword).toHaveBeenCalledWith({
      service: SERVICE,
    });
    expect(dependencies.legacyStorage.getItem).not.toHaveBeenCalled();
    expect(dependencies.legacyStorage.removeItem).toHaveBeenCalledWith(
      SESSION_KEY,
    );
  });

  it('migrates legacy data only after a confirmed secure write', async () => {
    const dependencies = createDependencies();
    dependencies.keychain.getGenericPassword.mockResolvedValue(false);
    dependencies.keychain.setGenericPassword.mockResolvedValue({
      service: SERVICE,
    });
    dependencies.legacyStorage.getItem.mockResolvedValue('legacy-session-json');
    dependencies.legacyStorage.removeItem.mockResolvedValue(undefined);
    const storage = createSecureSessionStorage(dependencies);

    await expect(storage.getItem(SESSION_KEY)).resolves.toBe(
      'legacy-session-json',
    );

    expect(dependencies.keychain.setGenericPassword).toHaveBeenCalledWith(
      SESSION_KEY,
      'legacy-session-json',
      {
        securityLevel: 'secure-software',
        service: SERVICE,
        storage: 'aes-gcm',
      },
    );
    expect(
      dependencies.keychain.setGenericPassword.mock.invocationCallOrder[0],
    ).toBeLessThan(
      dependencies.legacyStorage.removeItem.mock.invocationCallOrder[0],
    );
  });

  it('fails closed and retains legacy data when the secure write fails', async () => {
    const dependencies = createDependencies();
    dependencies.keychain.getGenericPassword.mockResolvedValue(false);
    dependencies.keychain.setGenericPassword.mockResolvedValue(false);
    dependencies.legacyStorage.getItem.mockResolvedValue('legacy-session-json');
    const storage = createSecureSessionStorage(dependencies);

    await expect(storage.getItem(SESSION_KEY)).rejects.toMatchObject({
      code: 'secure_write_failed',
    });
    expect(dependencies.legacyStorage.removeItem).not.toHaveBeenCalled();
  });

  it('does not downgrade to legacy storage after a secure read error', async () => {
    const dependencies = createDependencies();
    dependencies.keychain.getGenericPassword.mockRejectedValue(
      new Error('keystore unavailable'),
    );
    dependencies.legacyStorage.getItem.mockResolvedValue('legacy-session-json');
    const storage = createSecureSessionStorage(dependencies);

    await expect(storage.getItem(SESSION_KEY)).rejects.toMatchObject({
      code: 'secure_read_failed',
    });
    expect(dependencies.legacyStorage.getItem).not.toHaveBeenCalled();
  });

  it('removes both secure and legacy data during logout', async () => {
    const dependencies = createDependencies();
    dependencies.keychain.getGenericPassword.mockResolvedValue({
      username: SESSION_KEY,
      password: 'secure-session-json',
    });
    dependencies.keychain.resetGenericPassword.mockResolvedValue(true);
    dependencies.legacyStorage.removeItem.mockResolvedValue(undefined);
    const storage = createSecureSessionStorage(dependencies);

    await expect(storage.removeItem(SESSION_KEY)).resolves.toBeUndefined();

    expect(dependencies.keychain.resetGenericPassword).toHaveBeenCalledWith({
      service: SERVICE,
    });
    expect(
      dependencies.keychain.resetGenericPassword.mock.invocationCallOrder[0],
    ).toBeLessThan(
      dependencies.legacyStorage.removeItem.mock.invocationCallOrder[0],
    );
  });

  it('does not expose or log tokens when secure storage rejects a write', async () => {
    const dependencies = createDependencies();
    const accessToken = 'access-token-that-must-never-be-logged';
    const refreshToken = 'refresh-token-that-must-never-be-logged';
    const sessionJson = JSON.stringify({ accessToken, refreshToken });
    dependencies.keychain.setGenericPassword.mockRejectedValue(
      new Error(`native failure: ${sessionJson}`),
    );
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const consoleWarn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const consoleLog = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    const consoleInfo = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const consoleDebug = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);
    const storage = createSecureSessionStorage(dependencies);

    let thrown: unknown;
    try {
      await storage.setItem(SESSION_KEY, sessionJson);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(SecureSessionStorageError);
    expect(String(thrown)).not.toContain(accessToken);
    expect(String(thrown)).not.toContain(refreshToken);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleInfo).not.toHaveBeenCalled();
    expect(consoleDebug).not.toHaveBeenCalled();
    expect(dependencies.legacyStorage.removeItem).not.toHaveBeenCalled();
  });
});
