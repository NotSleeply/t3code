// Pass 6: wrap user-facing error fallbacks such as `error instanceof Error ? error.message : "..."`.
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
      !/\.d\.ts$/.test(entry.name) &&
      entry.name !== "routeTree.gen.ts"
    ) {
      result.push(full);
    }
  }
  return result;
}

const isMessageAccess = (node) =>
  ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name) && node.name.text === "message";

const isLiteral = (node) => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

function hasI18nImport(sourceFile) {
  return sourceFile.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) && /(^|\/)i18n$/.test(statement.moduleSpecifier.text),
  );
}

function importInsertPosition(sourceFile, source) {
  let position = 0;
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) position = statement.end;
  }
  if (position === 0) return 0;
  const nextNewline = source.indexOf("\n", position);
  return nextNewline === -1 ? source.length : nextNewline + 1;
}

let changedFiles = 0;
let wrapped = 0;
let checked = 0;
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
  const edits = [];
  const visit = (node) => {
    if (ts.isConditionalExpression(node)) {
      const whenTrueMessage = isMessageAccess(node.whenTrue) && isLiteral(node.whenFalse);
      const whenFalseMessage = isMessageAccess(node.whenFalse) && isLiteral(node.whenTrue);
      const literal = whenTrueMessage ? node.whenFalse : whenFalseMessage ? node.whenTrue : null;
      if (literal) {
        edits.push({
          start: literal.getStart(sourceFile),
          end: literal.getEnd(),
          replacement: `t(${JSON.stringify(literal.text)})`,
        });
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      if (isMessageAccess(node.left) && isLiteral(node.right)) {
        edits.push({
          start: node.right.getStart(sourceFile),
          end: node.right.getEnd(),
          replacement: `t(${JSON.stringify(node.right.text)})`,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  checked += 1;
  if (edits.length === 0) continue;
  let output = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, edit.start) + edit.replacement + output.slice(edit.end);
  }
  if (!hasI18nImport(sourceFile)) {
    const position = importInsertPosition(sourceFile, source);
    output = `${output.slice(0, position)}import { t } from "~/i18n";\n${output.slice(position)}`;
  }
  NodeFS.writeFileSync(file, output, "utf8");
  changedFiles += 1;
  wrapped += edits.length;
}
console.log(JSON.stringify({ checked, changedFiles, wrapped }));
