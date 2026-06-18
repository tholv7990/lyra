import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DownloadBody } from './dto';

const VALID_URL = 'https://example.com/video';

describe('DownloadBody DTO', () => {
  it('accepts a valid url with integer indices', async () => {
    const body = plainToInstance(DownloadBody, { url: VALID_URL, indices: [0, 2] });
    const errors = await validate(body);
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid url with no indices (optional)', async () => {
    const body = plainToInstance(DownloadBody, { url: VALID_URL });
    const errors = await validate(body);
    expect(errors).toHaveLength(0);
  });

  it('rejects indices containing a non-integer string', async () => {
    const body = plainToInstance(DownloadBody, { url: VALID_URL, indices: ['a'] });
    const errors = await validate(body);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'indices')).toBe(true);
  });

  it('rejects indices containing a negative integer', async () => {
    const body = plainToInstance(DownloadBody, { url: VALID_URL, indices: [-1] });
    const errors = await validate(body);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'indices')).toBe(true);
  });

  it('rejects missing url', async () => {
    const body = plainToInstance(DownloadBody, { indices: [0] });
    const errors = await validate(body);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'url')).toBe(true);
  });

  it('rejects empty url', async () => {
    const body = plainToInstance(DownloadBody, { url: '' });
    const errors = await validate(body);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'url')).toBe(true);
  });
});
