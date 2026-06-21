// Minimal structural subset of the Puppeteer Page / ElementHandle surface the upload
// scripts use. Lets the scripts stay typed even though `puppeteer-core` is an optional,
// dynamically-imported dep (so there are no real Puppeteer types at build time).
export interface ElementHandle {
  uploadFile(...filePaths: string[]): Promise<void>;
  click(): Promise<void>;
  type(text: string, opts?: { delay?: number }): Promise<void>;
}

export interface PuppetPage {
  goto(url: string, opts?: { waitUntil?: 'domcontentloaded' | 'load' | 'networkidle0' | 'networkidle2' }): Promise<unknown>;
  waitForSelector(selector: string, opts?: { timeout?: number; visible?: boolean }): Promise<ElementHandle | null>;
  $(selector: string): Promise<ElementHandle | null>;
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
