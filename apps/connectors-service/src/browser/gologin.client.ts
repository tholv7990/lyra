// Thin wrapper over the GoLogin SDK. `gologin` is NOT a declared dependency — it is
// imported dynamically (the specifier is typed `string` so TS/build don't resolve it)
// so the connectors-service builds and runs without it. Installing it is part of
// arming the connector:  pnpm --filter @lyra/connectors-service add gologin puppeteer-core
export interface GologinSession {
  /** CDP websocket endpoint to attach Playwright to. */
  wsUrl: string;
  stop: () => Promise<void>;
}

interface GoLoginInstance {
  start(): Promise<{ wsUrl: string }>;
  stop(): Promise<void>;
}
type GoLoginCtor = new (opts: { token: string; profile_id: string }) => GoLoginInstance;

export async function startProfile(token: string, profileId: string): Promise<GologinSession> {
  if (!token) throw new Error('browser connector: GOLOGIN_API_TOKEN is not set');
  const spec: string = 'gologin'; // typed string → not resolved at build time
  let GoLogin: GoLoginCtor;
  try {
    const mod = (await import(spec)) as { GoLogin?: GoLoginCtor; default?: GoLoginCtor };
    const ctor = mod.GoLogin ?? mod.default;
    if (!ctor) throw new Error('no GoLogin export');
    GoLogin = ctor;
  } catch {
    throw new Error(
      'browser connector: `gologin` not installed — run `pnpm --filter @lyra/connectors-service add gologin puppeteer-core`',
    );
  }
  const gl = new GoLogin({ token, profile_id: profileId });
  const { wsUrl } = await gl.start(); // launches the profile session (Orbita); returns its CDP url
  return { wsUrl, stop: () => gl.stop().catch(() => undefined) };
}
