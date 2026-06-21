import type { ConfigService } from '@nestjs/config';

export interface BrowserConfig {
  /** Master fence — the connector is inert unless this is exactly "true". */
  enabled: boolean;
  gologinToken: string;
  gologinBase: string;
}

// Read the browser-connector config. Off unless BROWSER_CONNECTOR_ENABLED === 'true'
// (any other value, incl. "1"/"yes"/unset, stays off — fail-closed on purpose).
export function browserConfig(config: ConfigService): BrowserConfig {
  return {
    enabled: (config.get<string>('BROWSER_CONNECTOR_ENABLED') ?? 'false') === 'true',
    gologinToken: config.get<string>('GOLOGIN_API_TOKEN') ?? '',
    gologinBase: config.get<string>('GOLOGIN_API_BASE') ?? 'https://api.gologin.com',
  };
}
