// Regenerates apps/web/src/i18n/zh-Hans.ts from the translation memory, keeping only keys
// that are still used in the app. Run extract-keys first when source strings changed.
//
//   node scripts/i18n/merge-catalog.mjs
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const ROOT = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "../..");
const WORK = NodePath.join(ROOT, "scripts/i18n/.work");
const extractedPath = NodePath.join(WORK, "extracted-keys.json");
const translationsPath = NodePath.join(ROOT, "scripts/i18n/translations.zh-Hans.json");
const catalogPath = NodePath.join(ROOT, "apps/web/src/i18n/zh-Hans.ts");

if (!NodeFS.existsSync(extractedPath)) {
  console.error(
    "Missing scripts/i18n/.work/extracted-keys.json; run `node scripts/i18n/extract-keys.mjs` first.",
  );
  process.exit(2);
}

const extracted = JSON.parse(NodeFS.readFileSync(extractedPath, "utf8"));
const translations = JSON.parse(NodeFS.readFileSync(translationsPath, "utf8"));
const used = new Set(extracted.map((entry) => entry.key));

const missing = [...used].filter((key) => !(key in translations));
if (missing.length > 0) {
  console.error(
    `${missing.length} source strings have no translation; see \`node scripts/i18n/report-missing.mjs\`.`,
  );
  process.exit(1);
}

const entries = [...used].sort((a, b) => a.localeCompare(b)).map((key) => [key, translations[key]]);
const body = entries
  .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
  .join("\n");
const content = `// Simplified Chinese catalog. Keys are the English source strings passed to \`t()\`.
// Keep {0}/{name} placeholders intact and do not translate product or provider names.
// Generated from scripts/i18n/translations.zh-Hans.json by scripts/i18n/merge-catalog.mjs.
export const zhHans: Readonly<Record<string, string>> = {
${body}
};
`;
NodeFS.writeFileSync(catalogPath, content, "utf8");
console.log(
  `Wrote ${entries.length} translations to apps/web/src/i18n/zh-Hans.ts (${Object.keys(translations).length - entries.length} unused memory entries ignored)`,
);
