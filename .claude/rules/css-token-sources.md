---
description: Editing the CSS token sources in src/css, the generated artifacts they feed, and the value casing that must survive
paths:
  - src/css/**/*.css
  - src/tokens.generated.ts
  - src/tokens.generated.json
  - test/tokens.test.ts
---

# CSS token sources

- `src/css/*.css` is the authoritative web artifact; `src/tokens.generated.{ts,json}` is generated from it. After editing any file under `src/css/`, run `npm run generate` and commit the artifact — CI's `git diff --exit-code -- src/tokens.generated.ts src/tokens.generated.json` gate fails on a stale one.
- Never change the case of a value in `src/css/typography.css`. `Fraunces`, `Georgia`, `Times New Roman`, `Hanken Grotesk`, `Segoe UI`, `JetBrains Mono`, `SFMono-Regular` and `Menlo` are family names, not value keywords. A `value-keyword-case` "fix" (Codacy runs stylelint server-side; `npm run lint` is eslint and never sees CSS) lower-cased `Georgia` and it rode into `src/tokens.generated.json` and `dist/`, which the non-CSS clients (React Native / Roku) match exactly.
- Keep the `/* stylelint-disable value-keyword-case */` … `/* stylelint-enable value-keyword-case */` fence around the `--font-*` declarations in `src/css/typography.css`.
- The `font family tokens` suite in `test/tokens.test.ts` pins those stacks against the CSS source, the exported `tokens`/`resolveTheme` values and the committed `src/tokens.generated.json`. When a stack legitimately changes, update the CSS, regenerate, and update the expectations together.
- A value change under `src/css/**` is a published-token change: record it in `CHANGELOG.md` rather than folding it into an unrelated commit.
