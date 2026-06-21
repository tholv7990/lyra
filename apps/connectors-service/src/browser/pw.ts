// Minimal structural subset of the Playwright `Page`/`Locator` surface the upload
// scripts use. Lets the scripts stay typed even though `playwright` is an optional,
// dynamically-imported dep (so there are no real Playwright types at build time).
export interface UiLocator {
  first(): UiLocator;
  click(opts?: { timeout?: number }): Promise<void>;
  fill(value: string): Promise<void>;
  setInputFiles(paths: string[]): Promise<void>;
  waitFor(opts?: { state?: 'visible' | 'attached'; timeout?: number }): Promise<void>;
}

export interface UiPage {
  goto(url: string, opts?: { waitUntil?: 'domcontentloaded' | 'load' | 'networkidle' }): Promise<unknown>;
  locator(selector: string): UiLocator;
  getByRole(role: string, opts?: { name?: string | RegExp }): UiLocator;
  waitForTimeout(ms: number): Promise<void>;
}
