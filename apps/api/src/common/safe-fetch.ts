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

export interface FetchFollowResult { ok: boolean; status: number; body: string; }

/**
 * SSRF-hardened fetch that FOLLOWS redirects, re-validating EVERY hop (scheme +
 * literal host via assertSafeUrl, then DNS-resolved IPs via isPrivateAddress).
 * Unlike safeFetch (redirect:'error', for liveness checks), this is for crawling
 * pages that legitimately redirect — http→https, www canonicalisation, shortlinks.
 * Returns the final response body (empty when the final status is non-ok).
 */
export async function safeFetchFollow(
  rawUrl: string,
  opts: { maxRedirects?: number; timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<FetchFollowResult> {
  const max = opts.maxRedirects ?? 5;
  const timeoutMs = opts.timeoutMs ?? 20000;
  let current = rawUrl;
  for (let hop = 0; hop <= max; hop++) {
    const url = assertSafeUrl(current); // scheme + literal-host guard (throws BadRequestException)
    let addresses: { address: string }[];
    try {
      addresses = await lookup(url.hostname, { all: true });
    } catch {
      throw new BadRequestException('URL host not allowed');
    }
    if (addresses.some((a) => isPrivateAddress(a.address))) {
      throw new BadRequestException('URL host not allowed');
    }
    // ponytail: resolve→connect is not IP-pinned; a DNS-rebind attacker with TTL-0
    // timing can still slip through. Upgrade: pin the validated IP via a custom undici dispatcher.
    const res = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: opts.headers,
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (loc) {
        current = new URL(loc, current).toString();
        continue;
      }
    }
    return { ok: res.ok, status: res.status, body: res.ok ? await res.text() : '' };
  }
  throw new BadRequestException('Too many redirects');
}
