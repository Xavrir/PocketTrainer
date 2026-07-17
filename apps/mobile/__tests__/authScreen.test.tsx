import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { TextInput } from 'react-native';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { AuthScreen } from '../src/screens/AuthScreen';
import { useAuth, type AuthContextValue } from '../src/auth/AuthProvider';

jest.mock('../src/auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

const mockedUseAuth = jest.mocked(useAuth);

function createAuthValue(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    bypassAllowed: false,
    clearCallbackError: jest.fn(),
    configured: true,
    loading: false,
    sendEmailOtp: jest.fn(),
    session: null,
    signInWithGoogle: jest.fn(),
    signOut: jest.fn(),
    verifyEmailOtp: jest.fn(),
    ...overrides,
  };
}

function textInput(
  renderer: ReactTestRenderer.ReactTestRenderer,
  accessibilityLabel: string,
) {
  return renderer.root
    .findAllByType(TextInput)
    .find(input => input.props.accessibilityLabel === accessibilityLabel);
}

describe('AuthScreen email OTP flow', () => {
  it('requests a code, sanitizes six digits, and verifies the code', async () => {
    const sendEmailOtp = jest
      .fn()
      .mockResolvedValue({ emailOtpRequested: true });
    const verifyEmailOtp = jest.fn().mockResolvedValue({});
    mockedUseAuth.mockReturnValue(
      createAuthValue({ sendEmailOtp, verifyEmailOtp }),
    );
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<AuthScreen />);
    });

    const emailInput = textInput(renderer, 'Email');
    expect(emailInput).toBeDefined();
    await ReactTestRenderer.act(() => {
      emailInput?.props.onChangeText(' Ayu@Example.com ');
    });
    await ReactTestRenderer.act(async () => {
      renderer.root.findByType(PrimaryButton).props.onPress();
    });

    expect(sendEmailOtp).toHaveBeenCalledWith('ayu@example.com');
    expect(textInput(renderer, 'Kode OTP')).toBeDefined();

    const otpInput = textInput(renderer, 'Kode OTP');
    await ReactTestRenderer.act(() => {
      otpInput?.props.onChangeText('12a34567');
    });
    expect(otpInput?.props.value).toBe('123456');

    await ReactTestRenderer.act(async () => {
      renderer.root.findByType(PrimaryButton).props.onPress();
    });
    expect(verifyEmailOtp).toHaveBeenCalledWith('ayu@example.com', '123456');
  });

  it('does not verify until a complete six-digit code is entered', async () => {
    const sendEmailOtp = jest
      .fn()
      .mockResolvedValue({ emailOtpRequested: true });
    const verifyEmailOtp = jest.fn().mockResolvedValue({});
    mockedUseAuth.mockReturnValue(
      createAuthValue({ sendEmailOtp, verifyEmailOtp }),
    );
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<AuthScreen />);
    });
    await ReactTestRenderer.act(() => {
      textInput(renderer, 'Email')?.props.onChangeText('ayu@example.com');
    });
    await ReactTestRenderer.act(async () => {
      renderer.root.findByType(PrimaryButton).props.onPress();
    });
    await ReactTestRenderer.act(() => {
      textInput(renderer, 'Kode OTP')?.props.onChangeText('12345');
    });

    await ReactTestRenderer.act(async () => {
      renderer.root.findByType(PrimaryButton).props.onPress();
    });

    expect(verifyEmailOtp).not.toHaveBeenCalled();
    expect(JSON.stringify(renderer.toJSON())).toContain(
      'Masukkan kode OTP 6 digit.',
    );
  });
});
