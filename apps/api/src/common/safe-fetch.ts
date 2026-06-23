import { lookup } from 'node:dns/promises';
import { BadRequestException } from '@nestjs/common';
import { assertSafeUrl, isPrivateAddress } from './url';

/**
 * SSRF-hardened fetch.
 *
 * 1. Validates scheme + literal hostname via assertSafeUrl.
 * 2. Resolves the hostname via DNS and rejects if ANY address is private
 *    (stops DNS-rebind attacks).
 * 3. Fetches with redirect:'error' so a redirect to an internal host fails
 *    closed rather than being silently followed.
 */
export async function safeFetch(rawUrl: string): Promise<Response> {
  const url = assertSafeUrl(rawUrl); // throws BadRequestException on bad scheme/host

  // DNS pre-resolution: block rebind
  const hostname = url.hostname;
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new BadRequestException('URL host not allowed');
  }

  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new BadRequestException('URL host not allowed');
  }

  return fetch(rawUrl, { redirect: 'error' });
}
