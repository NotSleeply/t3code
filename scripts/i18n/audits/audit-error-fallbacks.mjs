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
      !/\.d\.ts$/.test(e.name) &&
      e.name !== "routeTree.gen.ts"
    )
      out.push(p);
  }
  return out;
}
const isMessageAccess = (n) =>
  ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.name) && n.name.text === "message";
const candidates = [];
for (const file of walk(SRC)) {
  const source = NodeFS.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const rel = NodePath.relative(SRC, file).replaceAll("\\", "/");
  const visit = (n) => {
    if (ts.isConditionalExpression(n)) {
      let lit = null;
      if (
        isMessageAccess(n.whenTrue) &&
        (ts.isStringLiteral(n.whenFalse) || ts.isNoSubstitutionTemplateLiteral(n.whenFalse))
      )
        lit = n.whenFalse;
      else if (
        isMessageAccess(n.whenFalse) &&
        (ts.isStringLiteral(n.whenTrue) || ts.isNoSubstitutionTemplateLiteral(n.whenTrue))
      )
        lit = n.whenTrue;
      if (lit) candidates.push({ file: rel, text: lit.text, node: lit });
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
      if (
        isMessageAccess(n.left) &&
        (ts.isStringLiteral(n.right) || ts.isNoSubstitutionTemplateLiteral(n.right))
      )
        candidates.push({ file: rel, text: n.right.text, node: n.right });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
const uniq = new Map();
for (const c of candidates) uniq.set(c.text, c.file);
console.log("fallback literals", candidates.length, "unique", uniq.size);
for (const [t, f] of [...uniq].slice(0, 80)) console.log(f, "|", t.slice(0, 80));
