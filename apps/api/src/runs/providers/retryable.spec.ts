import { HttpException } from '@nestjs/common';
import { isRetryableProviderError } from './retryable';

describe('isRetryableProviderError', () => {
  it('retryable: 429, 5xx, 529, timeouts, quota markers', () => {
    expect(isRetryableProviderError({ status: 429 })).toBe(true);
    expect(isRetryableProviderError({ statusCode: 500 })).toBe(true);
    expect(isRetryableProviderError({ status: 503 })).toBe(true);
    expect(isRetryableProviderError(new HttpException('overloaded', 529))).toBe(true);
    expect(isRetryableProviderError(new Error('Request timed out'))).toBe(true);
    expect(isRetryableProviderError(new Error('429 Too Many Requests'))).toBe(true);
    expect(isRetryableProviderError(new Error('insufficient_quota'))).toBe(true);
    expect(isRetryableProviderError(new Error('socket hang up'))).toBe(true);
  });
  it('not retryable: 400/401/403/404, plain client errors, unknown', () => {
    expect(isRetryableProviderError({ status: 400 })).toBe(false);
    expect(isRetryableProviderError({ status: 401 })).toBe(false);
    expect(isRetryableProviderError(new HttpException('bad request', 400))).toBe(false);
    expect(isRetryableProviderError(new Error('invalid prompt'))).toBe(false);
    expect(isRetryableProviderError(undefined)).toBe(false);
    expect(isRetryableProviderError(null)).toBe(false);
  });
});
