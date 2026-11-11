// Compares the keys used in the app with the translation memory and lists untranslated strings.
//
//   node scripts/i18n/report-missing.mjs
//
// Exits non-zero when a source string has no Simplified Chinese translation, so it can gate CI.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const ROOT = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "../..");
const WORK = NodePath.join(ROOT, "scripts/i18n/.work");
const extractedPath = NodePath.join(WORK, "extracted-keys.json");
const translationsPath = NodePath.join(ROOT, "scripts/i18n/translations.zh-Hans.json");

if (!NodeFS.existsSync(extractedPath)) {
  console.error(
    "Missing scripts/i18n/.work/extracted-keys.json; run `node scripts/i18n/extract-keys.mjs` first.",
  );
  process.exit(2);
}

const extracted = JSON.parse(NodeFS.readFileSync(extractedPath, "utf8"));
const translations = JSON.parse(NodeFS.readFileSync(translationsPath, "utf8"));

const missing = extracted.filter((entry) => !(entry.key in translations));
const unused = Object.keys(translations).filter(
  (key) => !extracted.some((entry) => entry.key === key),
);

NodeFS.writeFileSync(
  NodePath.join(WORK, "missing-keys.json"),
  JSON.stringify(missing, null, 1),
  "utf8",
);
console.log(
  JSON.stringify(
    {
      sourceKeys: extracted.length,
      translated: extracted.length - missing.length,
      missing: missing.length,
      unusedTranslations: unused.length,
    },
    null,
    2,
  ),
);
if (missing.length > 0) {
  console.log("Untranslated keys:");
  for (const entry of missing.slice(0, 50)) console.log(" ", JSON.stringify(entry.key));
  if (missing.length > 50) console.log(`  ...and ${missing.length - 50} more`);
  process.exit(1);
}
