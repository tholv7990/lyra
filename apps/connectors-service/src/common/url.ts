import { BadRequestException } from '@nestjs/common';

const PRIVATE = [
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^0\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

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
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host === '::1' || host.endsWith('.localhost')) {
    throw new BadRequestException('URL host not allowed');
  }
  if (PRIVATE.some((re) => re.test(host))) {
    throw new BadRequestException('URL host not allowed');
  }
  return url;
}
