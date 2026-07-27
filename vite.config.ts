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
      // `scripts/**/*.mjs` is included, not just `src/**/*.ts`: the build scripts
      // are outside the TypeScript project but they are NOT outside the test
      // suite. scripts/lib/tokens.mjs and scripts/lib/copyright.mjs are the pure
      // modules test/tokens.test.ts and test/add-copyright.test.mjs import
      // directly, and with them excluded the report said nothing at all about the
      // code actually under test. The three CLI entry points
      // (generate-tokens.mjs, add-copyright.mjs, build-css.mjs) do show 0%: they
      // are covered only by tests that spawn them as CHILD PROCESSES
      // (test/generate-tokens.test.mjs), which the parent process's v8 counters
      // cannot see. That 0% is honest and deliberate — do not "fix" it by
      // excluding them again, and do not add a coverage threshold on the strength
      // of it. CI now runs `npm run test:run -- --coverage` and ships the report
      // to Codacy, but no threshold gates the build, so a 0% row here is
      // reported, never fatal.
      //
      // Reporter quirk, so nobody reads it as a regression: the `text` table omits
      // the `src/` rows (it printed an entirely EMPTY table when `include` was
      // `src/**/*.ts` alone). src/accent.ts and src/themes.ts are still measured
      // and still 100% — confirmed with `--coverage.reporter=json-summary`, which
      // lists all 7 files. Use json-summary, not the text table, when auditing
      // which files are included.
      // `lcov` is REQUIRED, not decorative: it is the only reporter here that
      // writes coverage/lcov.info, which is the file the Codacy upload step in
      // .github/workflows/ci.yml sends. Dropping it does not fail anything
      // locally — the upload just silently becomes a no-op.
      reporter: ['text-summary', 'text', 'html', 'lcov'],
      include: ['src/**/*.ts', 'scripts/**/*.mjs'],
      exclude: ['**/*.test.ts', 'src/index.ts', 'src/tokens.generated.ts'],
    },
  },
});
