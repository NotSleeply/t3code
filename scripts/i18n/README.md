# Localization tooling

The app ships English source strings wrapped in `t()` and a Simplified Chinese catalog at
[`apps/web/src/i18n/zh-Hans.ts`](../../apps/web/src/i18n/zh-Hans.ts). The runtime is
[`apps/web/src/i18n/index.ts`](../../apps/web/src/i18n/index.ts): it resolves the language once at
boot (system locale by default), fills `{0}` placeholders, falls back to English for missing keys,
and lazy-loads the catalog chunk only for Chinese builds.

This folder holds the translation memory and the maintenance tooling used to produce the catalog.

## Layout

| Path                        | Purpose                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `translations.zh-Hans.json` | **Canonical translation memory**: English source string → Simplified Chinese. Edit this, not the generated catalog. |
| `extract-keys.mjs`          | Scans `apps/web/src` for `t("...")` keys into `.work/extracted-keys.json`.                                          |
| `report-missing.mjs`        | Lists source strings with no translation (exit code 1 when any are missing).                                        |
| `merge-catalog.mjs`         | Regenerates `zh-Hans.ts` from the memory, pruned to keys still used.                                                |
| `TRANSLATION_GUIDE.md`      | Terminology and style guide used for translations.                                                                  |
| `verify-language.mjs`       | Playwright check: opens a running app, switches languages, and captures screenshots.                                |
| `codemods/`                 | One-off passes that wrapped UI strings in `t()` (kept for merging upstream changes).                                |
| `audits/`                   | Read-only reports that find untranslated display strings or lost whitespace.                                        |

`.work/` is generated scratch space and is gitignored.

## Workflow

```sh
vp i                                    # once; the scripts read TypeScript from node_modules/.pnpm
node scripts/i18n/extract-keys.mjs      # collect current source strings
node scripts/i18n/report-missing.mjs    # list untranslated strings (CI gate; exit 1 when missing)
node scripts/i18n/merge-catalog.mjs     # regenerate apps/web/src/i18n/zh-Hans.ts
vp fmt apps/web/src/i18n                # format the generated catalog
vp run --filter @t3tools/web typecheck  # catalog must typecheck
```

Adding a translated string: add `"English source": "中文"` to `translations.zh-Hans.json`, then run
`merge-catalog.mjs` (it errors if a used source string has no entry).

## Wrapping new upstream UI

When merging upstream, run the codemods in order and review their diffs — they are AST-based and
skip files they cannot rewrite safely. Each prints how many strings it wrapped:

```sh
node scripts/i18n/codemods/wrap-jsx.mjs --write            # JSX text/attributes + display props
node scripts/i18n/codemods/wrap-templates.mjs --write      # template-literal attributes and children
node scripts/i18n/codemods/wrap-label-maps.mjs --write     # *_LABELS maps and option lists
node scripts/i18n/codemods/wrap-value-literals.mjs --write # ternary branches and logical fallbacks
node scripts/i18n/codemods/wrap-error-fallbacks.mjs        # error.message fallbacks
node scripts/i18n/codemods/wrap-helper-returns.mjs         # display strings returned by helpers
node scripts/i18n/codemods/cleanup-unwrap-comparisons.mjs  # undo wraps used as discriminants
node scripts/i18n/codemods/cleanup-unwrap-code-values.mjs  # undo wraps around class/CSS values
node scripts/i18n/codemods/cleanup-classnames.mjs          # undo wraps inside className
node scripts/i18n/codemods/remove-unused-imports.mjs       # drop t imports with no remaining usage
```

Each accepts `--file <path>` to preview one file and `--check` to list files only. Then use the
audits to find what was skipped:

```sh
node scripts/i18n/audits/audit-attribute-templates.mjs   # untranslated aria-label/title templates
node scripts/i18n/audits/audit-helper-returns.mjs        # display strings returned from helpers
node scripts/i18n/audits/audit-error-fallbacks.mjs       # error.message fallbacks
node scripts/i18n/audits/audit-lost-spaces.mjs           # wrapped strings that lost edge whitespace
node scripts/i18n/audits/audit-unwrapped-ts-strings.mjs  # candidate user-facing strings in .ts files
```

## Rules the runtime depends on

- Module-level `t()` calls work because `i18n/index.ts` resolves the catalog with a top-level await:
  every importer evaluates after the catalog is available. Do not replace it with a synchronous
  static import (it slows tests and ships Chinese to English builds) or move catalog loading after
  module initialization.
- Tests resolve to English (`import.meta.env.MODE === "test"`), so text assertions stay stable. Do
  not remove that branch without updating the browser/unit test expectations.
- Keep `{0}`/`{name}` placeholders intact and do not translate product or provider names. Plural
  suffixes passed as `{1}` may be dropped in Chinese, since Chinese has no plural marker.
- Native menu and update dialog copy lives in the Electron main process and follows the OS locale
  (`apps/desktop/src/window/DesktopMenuLabels.ts`), not the in-app language setting.
- Deliberately untranslated: `apps/web/src/lib/bootError.ts` (the bundled-dev bootstrap test builds
  that file without the app's path aliases, so it must stay dependency-free).
