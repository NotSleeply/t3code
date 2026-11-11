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
      /\.tsx?$/.test(e.name) &&
      !/\.(test|browser\.test|bench)\./.test(e.name) &&
      !e.name.endsWith(".d.ts")
    )
      out.push(p);
  }
  return out;
}
const NAME =
  /(describe|label|title|message|hint|text|summary|status|reason|empty|placeholder|tooltip|banner)/i;
const looksSentence = (v) =>
  v.length >= 12 &&
  /^[A-Z]/.test(v) &&
  /[a-z]{2}/.test(v) &&
  !/[{}<>]|=>|::|\/\//.test(v) &&
  !/^[A-Z_]+$/.test(v) &&
  (/[.!?…]\s*$/.test(v) || v.split(" ").length >= 4);
const candidates = [];
for (const file of walk(SRC)) {
  const source = NodeFS.readFileSync(file, "utf8");
  if (!source.includes('return "')) continue;
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const rel = NodePath.relative(SRC, file).replaceAll("\\", "/");
  const visit = (node) => {
    let fnName = null;
    if (ts.isFunctionDeclaration(node) && node.name) fnName = node.name.text;
    else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    )
      fnName = node.name.text;
    if (fnName && NAME.test(fnName)) {
      const scan = (n) => {
        if (
          ts.isReturnStatement(n) &&
          n.expression &&
          (ts.isStringLiteral(n.expression) || ts.isNoSubstitutionTemplateLiteral(n.expression)) &&
          looksSentence(n.expression.text)
        ) {
          candidates.push({ file: rel, fn: fnName, text: n.expression.text });
        }
        ts.forEachChild(n, scan);
      };
      scan(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
const uniq = new Map();
for (const c of candidates) uniq.set(c.text, c);
console.log("candidates", candidates.length, "unique", uniq.size);
for (const [t, c] of uniq) console.log(c.file, "|", c.fn, "|", t.slice(0, 90));
