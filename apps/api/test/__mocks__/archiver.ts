// Minimal stub of the archiver package so Jest (CJS) can load modules that
// import from 'archiver' without hitting the ESM-only real package.
// The zip-download endpoint is never exercised in e2e tests.
export class ZipArchive {
  on(_event: string, _handler: (...args: unknown[]) => void) {}
  pipe(_dest: unknown) {}
  append(_input: unknown, _opts: unknown) {}
  async finalize() {}
}
