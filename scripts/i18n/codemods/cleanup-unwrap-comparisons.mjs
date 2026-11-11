// Cleanup: undo over-eager t() wrapping of literals that are used as discriminants, enum values,
// comparison operands or object keys (pass 4 only). Keeps display-position calls.
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

function walkFiles(directory) {
  const result = [];
  for (const e of NodeFS.readdirSync(directory, { withFileTypes: true })) {
    const full = NodePath.join(directory, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "i18n") continue;
      result.push(...walkFiles(full));
    } else if (
      /\.tsx?$/.test(e.name) &&
      !/\.(test|browser\.test|bench)\./.test(e.name) &&
      !e.name.endsWith(".d.ts")
    ) {
      result.push(full);
    }
  }
  return result;
}

const COMPARISON = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
]);

const TECHNICAL_PROPERTY =
  /^(_tag|type|kind|status|mode|role|variant|id|value|key|source|provider|state|scope|reason|level|tone)$/;

function isTranslationCall(node) {
  if (!ts.isCallExpression(node)) return null;
  if (!ts.isIdentifier(node.expression) || node.expression.text !== "t") return null;
  if (node.arguments.length !== 1) return null;
  const argument = node.arguments[0];
  if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
    return argument.text;
  }
  return null;
}

function shouldUnwrap(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isBinaryExpression(parent) && COMPARISON.has(parent.operatorToken.kind)) return true;
  if (ts.isCaseClause(parent) || ts.isDefaultClause(parent)) return true;
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node) return true;
  if (ts.isElementAccessExpression(parent) && parent.expression === node) return true;
  if (ts.isCallExpression(parent) && parent.arguments.includes(node)) {
    if (ts.isIdentifier(parent.expression) && parent.expression.text === "t") return false;
    return true;
  }
  if (ts.isArrayLiteralExpression(parent)) return true;
  if (ts.isNewExpression(parent) && (parent.arguments ?? []).includes(node)) return true;
  if (ts.isPropertyAssignment(parent) && parent.initializer === node) {
    const name = ts.isIdentifier(parent.name)
      ? parent.name.text
      : ts.isStringLiteral(parent.name)
        ? parent.name.text
        : "";
    if (TECHNICAL_PROPERTY.test(name)) return true;
  }
  return false;
}

let changedFiles = 0;
let replaced = 0;
for (const file of walkFiles(SRC)) {
  const source = NodeFS.readFileSync(file, "utf8");
  const isTsx = file.endsWith(".tsx");
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const edits = [];
  const visit = (node) => {
    const text = isTranslationCall(node);
    if (text !== null && shouldUnwrap(node)) {
      edits.push({
        start: node.getStart(sf),
        end: node.getEnd(),
        replacement: JSON.stringify(text),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (edits.length === 0) continue;
  let output = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, edit.start) + edit.replacement + output.slice(edit.end);
  }
  NodeFS.writeFileSync(file, output, "utf8");
  changedFiles += 1;
  replaced += edits.length;
}
console.log(JSON.stringify({ changedFiles, replaced }));
