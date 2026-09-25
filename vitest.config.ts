import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // This file uses Node's built-in test runner and is executed explicitly by npm test.
    exclude: [...configDefaults.exclude, 'scripts/cleanup-vercel-preview-deployments.test.mjs'],
  },
});
