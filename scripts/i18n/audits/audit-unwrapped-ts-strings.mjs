import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
const ROOT = process.cwd();
const SRC = NodePath.join(ROOT, "apps/web/src");
const dir = NodeFS.readdirSync(NodePath.join(ROOT, "node_modules/.pnpm"));
const entry = dir.find((n) => /^typescript@6\./.test(n));
const ts = (
  await import(
    NodeURL.pathToFileURL(
      NodePath.join(ROOT, "node_modules/.pnpm", entry, "node_modules/typescript/lib/typescript.js"),
    ).href
  )
).default;
function walk(d) {
  const out = [];
  for (const e of NodeFS.readdirSync(d, { withFileTypes: true })) {
    const p = NodePath.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules" && e.name !== "i18n") out.push(...walk(p));
    } else if (
      /\.ts$/.test(e.name) &&
      !/\.(test|browser\.test|bench)\./.test(e.name) &&
      !/\.d\.ts$/.test(e.name) &&
      e.name !== "routeTree.gen.ts"
    )
      out.push(p);
  }
  return out;
}
const looksLikeSentence = (v) => {
  if (v.length < 12) return false;
  if (!/^[A-Z]/.test(v)) return false;
  if (!/[a-z]{2}/.test(v)) return false;
  if (!/[.!?…:]\s*$/.test(v) && v.split(" ").length < 4) return false;
  if (/[{}<>]|=>|::|\/\//.test(v)) return false;
  if (/^[A-Z_]+$/.test(v)) return false;
  return true;
};
const candidates = [];
for (const file of walk(SRC)) {
  const source = NodeFS.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const rel = NodePath.relative(SRC, file).replaceAll("\\", "/");
  const visit = (node) => {
    if (ts.isStringLiteral(node) && looksLikeSentence(node.text)) {
      const parent = node.parent;
      const already =
        ts.isCallExpression(parent) &&
        ts.isIdentifier(parent.expression) &&
        parent.expression.text === "t";
      const isPropertyName = ts.isPropertyAssignment(parent) && parent.name === node;
      const isImport =
        ts.isImportDeclaration(parent.parent ?? parent) || ts.isExternalModuleReference(parent);
      if (!already && !isPropertyName && !isImport) {
        candidates.push({ file: rel, text: node.text });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
const unique = new Map();
for (const c of candidates) unique.set(c.text, c.file);
console.log("candidates", candidates.length, "unique", unique.size);
for (const [text, file] of [...unique].slice(0, 60)) console.log(file, "|", text.slice(0, 90));
