import { BadRequestException } from '@nestjs/common';

const PRIVATE_IPV4 = [
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^0\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

function isPrivateIPv4(dotted: string): boolean {
  return PRIVATE_IPV4.some((re) => re.test(dotted));
}

/**
 * Convert the hex-group tail of an IPv4-mapped IPv6 address to dotted-decimal.
 * The URL constructor normalises dotted-quad inputs to two 16-bit hex groups,
 * e.g. [::ffff:127.0.0.1] → hostname "[::ffff:7f00:1]" → stripped "::ffff:7f00:1".
 * Input:  the part after "::ffff:" — two colon-separated hex groups "XXXX:XXXX".
 * Returns dotted-decimal string, or null if the format is unrecognised.
 */
function mappedHexToDotted(hex: string): string | null {
  const m = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(hex);
  if (!m) return null;
  const hi = parseInt(m[1], 16);
  const lo = parseInt(m[2], 16);
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

/** Strip surrounding brackets from an IPv6 literal hostname. */
function stripBrackets(h: string): string {
  // Use explicit slice so we avoid the confusing /^\[|\]$/g pattern entirely.
  // url.hostname for IPv6 addresses is always "[...]"; for others it is plain.
  if (h.startsWith('[') && h.endsWith(']')) {
    return h.slice(1, -1);
  }
  return h;
}

export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('Only http(s) URLs are allowed');
  }

  const host = stripBrackets(url.hostname).toLowerCase();

  // --- localhost / loopback ---
  if (host === 'localhost' || host === '::1' || host.endsWith('.localhost')) {
    throw new BadRequestException('URL host not allowed');
  }

  // --- plain IPv4 private ranges ---
  // Note: the URL constructor normalises integer and hex-encoded IPv4 to
  // dotted-decimal (e.g. 2130706433 → 127.0.0.1, 0x7f000001 → 127.0.0.1),
  // so these checks already cover those encodings.
  if (isPrivateIPv4(host)) {
    throw new BadRequestException('URL host not allowed');
  }

  // --- IPv4-mapped IPv6: ::ffff:XXXX:XXXX ---
  // The URL constructor normalises [::ffff:a.b.c.d] to two hex groups, e.g.
  // [::ffff:127.0.0.1] → stripped "::ffff:7f00:1".
  const mappedMatch = /^::ffff:([0-9a-f:]+)$/.exec(host);
  if (mappedMatch) {
    const dotted = mappedHexToDotted(mappedMatch[1]);
    if (dotted === null || isPrivateIPv4(dotted) || dotted.startsWith('0.')) {
      throw new BadRequestException('URL host not allowed');
    }
  }

  // --- IPv6 ULA (fc00::/7): addresses starting fc__ or fd__ ---
  if (/^f[cd][0-9a-f]{2}:/.test(host)) {
    throw new BadRequestException('URL host not allowed');
  }

  // --- IPv6 link-local (fe80::/10): fe80 – febf ---
  if (/^fe[89ab][0-9a-f]:/.test(host)) {
    throw new BadRequestException('URL host not allowed');
  }

  return url;
}
