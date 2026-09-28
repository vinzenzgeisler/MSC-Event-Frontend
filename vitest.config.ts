import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Same `@` alias as vite.config.ts, so services that import via "@/..." can be tested.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // This file uses Node's built-in test runner and is executed explicitly by npm test.
    exclude: [...configDefaults.exclude, 'scripts/cleanup-vercel-preview-deployments.test.mjs'],
  },
});
