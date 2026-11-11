// Pass 7: wrap user-facing strings returned from named display helpers such as
// `describeAuthGate`, `getCommandPaletteInputPlaceholder`, or `snapShotStatus`.
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
      !entry.name.endsWith(".d.ts")
    ) {
      result.push(full);
    }
  }
  return result;
}

const HELPER_NAME =
  /(describe|label|title|message|hint|text|summary|status|reason|empty|placeholder|tooltip|banner)/i;
const SKIP_FUNCTIONS = new Set(["buildCommandLabel"]);

const looksUserFacing = (value) => {
  const text = value.trim();
  if (text.length < 12) return false;
  if (!/^[A-Z]/.test(text)) return false;
  if (!/[a-z]{2}/.test(text)) return false;
  if (/[{}<>]|=>|::|\/\//.test(text)) return false;
  if (/^[A-Z_]+$/.test(text)) return false;
  return /[.!?…]\s*$/.test(text) || text.split(" ").length >= 4;
};

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

const allKeys = new Map();
let changedFiles = 0;
let wrapped = 0;
for (const file of walk(SRC)) {
  const source = NodeFS.readFileSync(file, "utf8");
  if (!source.includes('return "')) continue;
  const isTsx = file.endsWith(".tsx");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const rel = NodePath.relative(SRC, file).replaceAll("\\", "/");
  const edits = [];
  const record = (key) => {
    const entry = allKeys.get(key) ?? { key, files: new Set() };
    entry.files.add(rel);
    allKeys.set(key, entry);
  };

  const visit = (node) => {
    let fnName = null;
    if (ts.isFunctionDeclaration(node) && node.name) fnName = node.name.text;
    else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      fnName = node.name.text;
    }
    if (fnName && HELPER_NAME.test(fnName) && !SKIP_FUNCTIONS.has(fnName)) {
      const scan = (inner) => {
        if (
          ts.isReturnStatement(inner) &&
          inner.expression &&
          (ts.isStringLiteral(inner.expression) ||
            ts.isNoSubstitutionTemplateLiteral(inner.expression)) &&
          looksUserFacing(inner.expression.text)
        ) {
          const literal = inner.expression;
          const value = literal.text.replace(/\s+/g, " ").trim();
          edits.push({
            start: literal.getStart(sourceFile),
            end: literal.getEnd(),
            replacement: `t(${JSON.stringify(value)})`,
          });
          record(value);
        }
        ts.forEachChild(inner, scan);
      };
      scan(fnName ? node : node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (edits.length === 0) continue;
  const unique = new Map();
  for (const edit of edits) unique.set(edit.start, edit);
  let output = source;
  for (const edit of [...unique.values()].sort((a, b) => b.start - a.start)) {
    output = output.slice(0, edit.start) + edit.replacement + output.slice(edit.end);
  }
  if (!hasI18nImport(sourceFile)) {
    const position = importInsertPosition(sourceFile, source);
    output = `${output.slice(0, position)}import { t } from "~/i18n";\n${output.slice(position)}`;
  }
  const reparsed = ts.createSourceFile(
    file,
    output,
    ts.ScriptTarget.Latest,
    true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  if (reparsed.parseDiagnostics.length > 0) {
    console.error("SKIP (parse error):", rel);
    continue;
  }
  NodeFS.writeFileSync(file, output, "utf8");
  changedFiles += 1;
  wrapped += unique.size;
}

const payload = [...allKeys.values()]
  .map((entry) => ({ key: entry.key, files: [...entry.files].slice(0, 2) }))
  .sort((a, b) => a.key.localeCompare(b.key));
NodeFS.writeFileSync(
  "scripts/i18n/.work/extracted-v7.json",
  JSON.stringify(payload, null, 1),
  "utf8",
);
console.log(JSON.stringify({ changedFiles, wrapped, uniqueKeys: payload.length }, null, 2));
