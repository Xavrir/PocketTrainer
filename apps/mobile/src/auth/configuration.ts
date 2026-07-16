export function isSupabasePublicKey(value: string): boolean {
  const key = value.trim();
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;

  const jwtParts = key.split('.');
  if (
    jwtParts.length !== 3 ||
    !jwtParts.every(part => /^[A-Za-z0-9_-]+$/.test(part))
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(jwtParts[1]!)) as {
      role?: unknown;
    };
    return payload.role === 'anon';
  } catch {
    return false;
  }
}

function decodeBase64Url(value: string): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  let buffer = 0;
  let bitCount = 0;
  let output = '';

  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Invalid base64url input.');
    buffer = buffer * 64 + index;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      output += String.fromCharCode(Math.floor(buffer / 2 ** bitCount) % 256);
      buffer %= 2 ** bitCount;
    }
  }
  return output;
}

export function isSupabaseUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
