import type { ConfigService } from '@nestjs/config';
import { browserConfig } from './browser.config';

const cfg = (env: Record<string, string>) =>
  browserConfig({ get: (k: string) => env[k] } as unknown as ConfigService);

describe('browserConfig (the fence)', () => {
  it('is off by default', () => {
    expect(cfg({}).enabled).toBe(false);
  });

  it('arms only on the exact string "true" (fail-closed)', () => {
    expect(cfg({ BROWSER_CONNECTOR_ENABLED: 'true' }).enabled).toBe(true);
    for (const v of ['1', 'yes', 'TRUE', 'on', '']) {
      expect(cfg({ BROWSER_CONNECTOR_ENABLED: v }).enabled).toBe(false);
    }
  });

  it('defaults the GoLogin API base', () => {
    expect(cfg({}).gologinBase).toBe('https://api.gologin.com');
    expect(cfg({ GOLOGIN_API_BASE: 'https://x' }).gologinBase).toBe('https://x');
  });
});
