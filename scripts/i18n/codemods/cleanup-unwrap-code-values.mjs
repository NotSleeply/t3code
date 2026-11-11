// Unwrap t() around class/CSS/identifier values that pass 4 over-wrapped in non-display attributes.
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
function isTailwindLike(v) {
  const tokens = v.split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  const utility = /^[\w!&*:.[\]/()%#'"+~=<>-]+$/;
  return (
    tokens.every((token) => utility.test(token)) && tokens.some((token) => /[-:[\]!]/.test(token))
  );
}
function looksLikeCodeValue(v) {
  const value = v.trim();
  if (/^[#_][\w-]*$/.test(value)) return true;
  if (/^\d+(\.\d+)?(px|ms|s|rem|em|vh|vw|%)$/.test(value)) return true;
  if (value.startsWith("--")) return true;
  if (/^[\w-]+\(.*\)$/.test(value)) return true;
  if (/noopener|noreferrer|_blank/i.test(value)) return true;
  if (/^[a-z][\w.]*(\s+[a-z][\w.]*)+$/.test(value)) return true;
  if (isTailwindLike(value)) return true;
  return false;
}
let files = 0;
let unwrapped = 0;
for (const file of walk(SRC)) {
  const source = NodeFS.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sf);
      if (
        !DISPLAY.has(name) &&
        ts.isJsxExpression(node.initializer) &&
        node.initializer.expression
      ) {
        const scan = (n) => {
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
            n.expression.text === "t" &&
            n.arguments.length === 1
          ) {
            const argument = n.arguments[0];
            if (
              (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) &&
              looksLikeCodeValue(argument.text)
            ) {
              edits.push({
                start: n.getStart(sf),
                end: n.getEnd(),
                replacement: JSON.stringify(argument.text),
              });
            }
            return;
          }
          ts.forEachChild(n, scan);
        };
        scan(node.initializer.expression);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!edits.length) continue;
  let output = source;
  for (const edit of edits.sort((a, b) => b.start - a.start))
    output = output.slice(0, edit.start) + edit.replacement + output.slice(edit.end);
  NodeFS.writeFileSync(file, output, "utf8");
  files += 1;
  unwrapped += edits.length;
}
console.log(JSON.stringify({ files, unwrapped }));
