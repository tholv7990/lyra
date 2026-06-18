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
});
