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
    } else if (/\.tsx$/.test(e.name) && !/\.(test|browser\.test|bench)\./.test(e.name)) out.push(p);
  }
  return out;
}
const DISPLAY = new Set([
  "title",
  "label",
  "description",
  "placeholder",
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "alt",
  "text",
  "heading",
  "tooltip",
  "ariaLabel",
  "ariaDescription",
  "emptyMessage",
  "emptyState",
  "subtitle",
  "caption",
  "summary",
  "helperText",
  "confirmLabel",
  "cancelLabel",
  "actionLabel",
  "buttonLabel",
  "submitLabel",
  "emptyLabel",
  "statusLabel",
]);
const hits = [];
for (const file of walk(SRC)) {
  const source = NodeFS.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const rel = NodePath.relative(SRC, file).replaceAll("\\", "/");
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sf);
      if (
        !DISPLAY.has(name) &&
        ts.isJsxExpression(node.initializer) &&
        node.initializer.expression
      ) {
        const scanValue = (n) => {
          if (
            ts.isJsxElement(n) ||
            ts.isJsxSelfClosingElement(n) ||
            ts.isJsxFragment(n) ||
            ts.isArrowFunction(n) ||
            ts.isFunctionExpression(n)
          )
            return;
          if (
            ts.isCallExpression(n) &&
            ts.isIdentifier(n.expression) &&
            n.expression.text === "t"
          ) {
            hits.push({ file: rel, attr: name, text: n.getText(sf).slice(0, 90) });
            return;
          }
          ts.forEachChild(n, scanValue);
        };
        scanValue(node.initializer.expression);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
console.log("total", hits.length);
for (const h of hits) console.log(h.file, h.attr, "|", h.text);
