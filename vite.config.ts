import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Framework-agnostic lib build — NO Vue plugin, NO Vue/Pinia externals. Emits
// ES + CJS so the package is consumable from web bundlers and Node/CJS alike.
export default defineConfig({
  build: {
    // Keep CSS un-inlined; the shipped CSS is produced by scripts/build-css.mjs,
    // not by Vite (this entry has no CSS imports).
    assetsInlineLimit: 0,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PhlixTokens',
      formats: ['es', 'cjs'],
      fileName: (format) => `phlix-tokens.${format === 'es' ? 'js' : 'umd.cjs'}`,
    },
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/index.ts', 'src/tokens.generated.ts'],
    },
  },
});
