export type ApiBaseUrlResolution = {
  error?: string;
  value: string;
};

const RELEASE_ERROR =
  'Release builds require POCKETTRAINER_API_BASE_URL to use a stable public HTTPS origin. Localhost, private-network addresses, and TryCloudflare Quick Tunnels are not release endpoints.';

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  return (
    octets[0] === 0 ||
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function isLocalOrPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '10.0.2.2' ||
    host === '::' ||
    host === '::1' ||
    /^f[cd][0-9a-f:]+$/i.test(host) ||
    /^fe[89ab][0-9a-f:]+$/i.test(host) ||
    isPrivateIpv4(host)
  );
}

export function resolveApiBaseUrl(
  rawValue: string | undefined,
  release: boolean,
): ApiBaseUrlResolution {
  const value = rawValue?.trim() ?? '';
  if (!value) {
    return {
      error: 'POCKETTRAINER_API_BASE_URL is not configured.',
      value: '',
    };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return {
      error: 'POCKETTRAINER_API_BASE_URL must be a valid HTTP(S) URL.',
      value: '',
    };
  }

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    return {
      error:
        'POCKETTRAINER_API_BASE_URL must be an HTTP(S) URL without credentials, a query, or a fragment.',
      value: '',
    };
  }

  const quickTunnel =
    url.hostname === 'trycloudflare.com' ||
    url.hostname.endsWith('.trycloudflare.com');
  if (
    release &&
    (url.protocol !== 'https:' ||
      isLocalOrPrivateHost(url.hostname) ||
      quickTunnel)
  ) {
    return { error: RELEASE_ERROR, value: '' };
  }

  return { value: value.replace(/\/+$/, '') };
}
