import { defineConfig } from 'tsup';

// Dual-format build: the Vite web app consumes the ESM output (`import`),
// while the CommonJS NestJS api consumes the CJS output (`require`).
// This is why @lyra/shared can be imported by both apps without an
// ESM/CJS interop break.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  outDir: 'dist',
});
