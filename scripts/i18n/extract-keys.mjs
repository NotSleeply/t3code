// Extracts every English source string passed to t("...") from the web app.
// Writes scripts/i18n/.work/extracted-keys.json for report-missing/merge-catalog.
//
//   node scripts/i18n/extract-keys.mjs
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const ROOT = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "../..");
const SRC = NodePath.join(ROOT, "apps/web/src");
const WORK = NodePath.join(ROOT, "scripts/i18n/.work");

const typescriptPath = (() => {
  const store = NodePath.join(ROOT, "node_modules/.pnpm");
  const entry = NodeFS.readdirSync(store).find((name) => /^typescript@6\./.test(name));
  if (!entry) throw new Error("typescript not found in node_modules/.pnpm; run `vp i` first");
  return NodePath.join(store, entry, "node_modules/typescript/lib/typescript.js");
})();
const ts = (await import(NodeURL.pathToFileURL(typescriptPath).href)).default;

function walk(directory) {
  const result = [];
  for (const entry of NodeFS.readdirSync(directory, { withFileTypes: true })) {
    const full = NodePath.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "i18n") continue;
      result.push(...walk(full));
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !/\.(test|browser\.test|bench)\./.test(entry.name) &&
      !entry.name.endsWith(".d.ts") &&
      entry.name !== "routeTree.gen.ts"
    ) {
      result.push(full);
    }
  }
  return result;
}

const keys = new Map();
for (const file of walk(SRC)) {
  const source = NodeFS.readFileSync(file, "utf8");
  const isTsx = file.endsWith(".tsx");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const rel = NodePath.relative(SRC, file).replaceAll("\\", "/");
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "t" &&
      node.arguments.length >= 1
    ) {
      const argument = node.arguments[0];
      if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
        const entry = keys.get(argument.text) ?? { key: argument.text, files: new Set() };
        entry.files.add(rel);
        keys.set(argument.text, entry);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

const payload = [...keys.values()]
  .map((entry) => ({ key: entry.key, files: [...entry.files].slice(0, 3) }))
  .sort((a, b) => a.key.localeCompare(b.key));
NodeFS.mkdirSync(WORK, { recursive: true });
NodeFS.writeFileSync(
  NodePath.join(WORK, "extracted-keys.json"),
  JSON.stringify(payload, null, 1),
  "utf8",
);
console.log(
  `Extracted ${payload.length} unique t() keys into scripts/i18n/.work/extracted-keys.json`,
);
