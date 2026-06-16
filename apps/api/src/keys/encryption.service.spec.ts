import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

const KEY = 'a'.repeat(64); // 32 bytes hex

function make(key = KEY) {
  const config = { get: () => key } as unknown as ConfigService;
  return new EncryptionService(config);
}

describe('EncryptionService', () => {
  it('round-trips plaintext (AES-256-GCM)', () => {
    const enc = make();
    const secret = 'sk-live-super-secret-key-1234';
    expect(enc.decrypt(enc.encrypt(secret))).toBe(secret);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const enc = make();
    const a = enc.encrypt('same');
    const b = enc.encrypt('same');
    expect(a).not.toBe(b);
    expect(enc.decrypt(a)).toBe('same');
    expect(enc.decrypt(b)).toBe('same');
  });

  it('rejects tampered ciphertext (auth tag)', () => {
    const enc = make();
    const stored = enc.encrypt('secret');
    const [iv, tag, data] = stored.split(':');
    const flipped = data.slice(0, -1) + (data.endsWith('0') ? '1' : '0');
    expect(() => enc.decrypt([iv, tag, flipped].join(':'))).toThrow();
  });

  it('requires a 64-hex-char key', () => {
    expect(() => make('tooshort')).toThrow();
  });
});
