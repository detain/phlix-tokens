---
description: CLI/pure-library split for the build scripts, and the coverage reporters CI depends on
paths:
  - scripts/**/*.mjs
  - test/**/*.mjs
  - vite.config.ts
---

# Build scripts: pure lib + thin CLI

- Pure logic lives in `scripts/lib/*.mjs` (`scripts/lib/tokens.mjs`, `scripts/lib/copyright.mjs`): strings in, values out — it reads no files, writes no files, lists no directories. Types go in the sibling `.d.mts` (`scripts/lib/tokens.d.mts`).
- `scripts/generate-tokens.mjs` and `scripts/add-copyright.mjs` are the CLI halves only — listing, reading, writing, verifying, reporting.
- Never add an `import.meta.url === pathToFileURL(process.argv[1]).href` main-guard. It is false through any symlink (`pathToFileURL` does not resolve symlinks, `import.meta.url` is the realpath), which turns the run into a zero-output exit-0 no-op and makes CI's `git diff --exit-code` gate compare the committed artifact against itself. Importing a `scripts/lib/` module can never write a file, so no guard is needed.
- `scripts/generate-tokens.mjs` must prove it did work: `assertNonVacuous()` on the token model, then read both artifacts back and byte-compare before reporting success.
- Unit-test the pure modules directly (`test/lib-tokens.test.mjs`, `test/lib-copyright.test.mjs`); exercise the CLI halves through a subprocess (`test/build-css.test.mjs`).
- `vite.config.ts` coverage must keep the `lcov` reporter and `reportOnFailure: true` — `coverage/lcov.info` is the file `.github/workflows/ci.yml` uploads to Codacy, and a failing test must still produce it.
