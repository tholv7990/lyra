import { Provider } from '@lyra/shared';
import { compatBaseUrl, nineRouterEnabled } from './openai-compat.client';

describe('compatBaseUrl', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.LITELLM_BASE;
    delete process.env.NINEROUTER_ENABLED;
    delete process.env.NINEROUTER_BASE_URL;
  });
  afterAll(() => {
    process.env = saved;
  });

  it('defaults to the official APIs', () => {
    expect(compatBaseUrl(Provider.OpenAI)).toBe('https://api.openai.com/v1');
    expect(compatBaseUrl(Provider.DeepSeek)).toBe('https://api.deepseek.com/v1');
  });

  it('routes OpenAI + DeepSeek through LITELLM_BASE when set', () => {
    process.env.LITELLM_BASE = 'http://localhost:4000/v1';
    expect(compatBaseUrl(Provider.OpenAI)).toBe('http://localhost:4000/v1');
    expect(compatBaseUrl(Provider.DeepSeek)).toBe('http://localhost:4000/v1');
  });

  it('the NINEROUTER switch is OFF by default and when not "true"', () => {
    expect(nineRouterEnabled()).toBe(false);
    process.env.NINEROUTER_ENABLED = 'false';
    expect(nineRouterEnabled()).toBe(false);
    expect(compatBaseUrl(Provider.OpenAI)).toBe('https://api.openai.com/v1');
  });

  it('routes through 9router when the switch is ON, taking precedence over LITELLM_BASE', () => {
    process.env.LITELLM_BASE = 'http://localhost:4000/v1';
    process.env.NINEROUTER_ENABLED = 'true';
    expect(nineRouterEnabled()).toBe(true);
    expect(compatBaseUrl(Provider.OpenAI)).toBe('http://localhost:20128/v1'); // default 9router base
    process.env.NINEROUTER_BASE_URL = 'http://gw.local:9999/v1';
    expect(compatBaseUrl(Provider.DeepSeek)).toBe('http://gw.local:9999/v1');
  });

  it('never reroutes non-OpenAI-compatible providers', () => {
    process.env.NINEROUTER_ENABLED = 'true';
    expect(compatBaseUrl(Provider.Anthropic)).toBeUndefined(); // not in the compat map
  });
});
