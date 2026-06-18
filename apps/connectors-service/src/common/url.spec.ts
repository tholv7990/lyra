import { assertSafeUrl } from './url';

describe('assertSafeUrl', () => {
  it('accepts https/http public URLs', () => {
    expect(assertSafeUrl('https://www.tiktok.com/@x/video/1').hostname).toBe('www.tiktok.com');
    expect(() => assertSafeUrl('http://example.com/v')).not.toThrow();
  });
  it('rejects non-http(s) schemes', () => {
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow();
    expect(() => assertSafeUrl('ftp://x')).toThrow();
    expect(() => assertSafeUrl('not a url')).toThrow();
  });
  it('rejects localhost / private / link-local / metadata hosts', () => {
    for (const u of [
      'http://localhost/x', 'http://127.0.0.1/x', 'http://[::1]/x',
      'http://10.0.0.5/x', 'http://192.168.1.1/x', 'http://172.16.0.1/x',
      'http://169.254.169.254/latest/meta-data', 'http://0.0.0.0/x',
    ]) {
      expect(() => assertSafeUrl(u)).toThrow();
    }
  });

  // --- new bypass tests (all must throw) ---

  it('rejects IPv4-mapped IPv6 addresses (::ffff: prefix)', () => {
    // loopback mapped
    expect(() => assertSafeUrl('http://[::ffff:127.0.0.1]/x')).toThrow();
    // RFC-1918 10.x mapped
    expect(() => assertSafeUrl('http://[::ffff:10.0.0.1]/x')).toThrow();
    // RFC-1918 192.168.x mapped
    expect(() => assertSafeUrl('http://[::ffff:192.168.1.1]/x')).toThrow();
    // link-local mapped
    expect(() => assertSafeUrl('http://[::ffff:169.254.169.254]/x')).toThrow();
  });

  it('rejects integer-encoded IPv4 (decimal)', () => {
    // 2130706433 == 127.0.0.1
    expect(() => assertSafeUrl('http://2130706433/')).toThrow();
    // 167772161 == 10.0.0.1
    expect(() => assertSafeUrl('http://167772161/')).toThrow();
  });

  it('rejects hex-encoded IPv4', () => {
    // 0x7f000001 == 127.0.0.1
    expect(() => assertSafeUrl('http://0x7f000001/')).toThrow();
    // 0x0a000001 == 10.0.0.1
    expect(() => assertSafeUrl('http://0x0a000001/')).toThrow();
  });

  it('rejects IPv6 ULA addresses (fc00::/7)', () => {
    expect(() => assertSafeUrl('http://[fd00::1]/x')).toThrow();
    expect(() => assertSafeUrl('http://[fc00::1]/x')).toThrow();
    expect(() => assertSafeUrl('http://[fdff:ffff::1]/x')).toThrow();
  });

  it('rejects IPv6 link-local addresses (fe80::/10)', () => {
    expect(() => assertSafeUrl('http://[fe80::1]/x')).toThrow();
    expect(() => assertSafeUrl('http://[febf::1]/x')).toThrow();
    expect(() => assertSafeUrl('http://[fe80::1%25eth0]/x')).toThrow();
  });
});
