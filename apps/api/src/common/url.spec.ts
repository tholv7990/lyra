import { BadRequestException } from '@nestjs/common';
import { isPrivateAddress, assertSafeUrl } from './url';

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1', '10.0.0.1', '172.16.5.4', '192.168.1.1', '169.254.169.254', '0.0.0.0',
    '100.64.0.1', '100.127.255.255',           // CGNAT 100.64/10
    'localhost', 'sub.localhost',
    '::1', '::',                                // loopback + unspecified
    'fe80::1', 'fc00::1', 'fd12::1',            // link-local + ULA
    '::ffff:127.0.0.1', '::ffff:169.254.169.254', // v4-mapped DOTTED (what dns.lookup returns)
    '::ffff:7f00:1',                            // v4-mapped HEX (what new URL normalises a literal to)
  ])('blocks private/reserved %s', (h) => expect(isPrivateAddress(h)).toBe(true));

  it.each([
    '8.8.8.8', '1.1.1.1', '93.184.216.34',
    '100.63.0.1', '100.128.0.1',               // just outside 100.64/10
    '2606:4700:4700::1111',
    '::ffff:8.8.8.8',                           // v4-mapped public is allowed
  ])('allows public %s', (h) => expect(isPrivateAddress(h)).toBe(false));
});

describe('assertSafeUrl', () => {
  it.each(['file:///etc/passwd', 'http://localhost/', 'http://127.0.0.1/', 'http://[::1]/', 'http://[::]/', 'http://100.64.0.1/'])(
    'rejects %s', (u) => expect(() => assertSafeUrl(u)).toThrow(BadRequestException),
  );
  it('accepts a public http(s) URL', () => {
    expect(assertSafeUrl('https://example.com/p').hostname).toBe('example.com');
  });
});
