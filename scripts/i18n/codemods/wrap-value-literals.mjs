// Pass 4b: wrap display string literals in JSX value positions (ternary branches and
// logical fallbacks). Deliberately shallow: never descends into calls, JSX, arrays, or objects,
// so class names and config values are left alone.
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

const DISPLAY_PROPS = new Set([
  "title",
  "label",
  "description",
  "message",
  "placeholder",
  "tooltip",
  "alt",
  "text",
  "heading",
  "ariaLabel",
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

const DISPLAY_ATTRIBUTES = new Set([
  "title",
  "label",
  "description",
  "placeholder",
  "aria-label",
  "aria-description",
  "alt",
  "text",
  "heading",
  "tooltip",
  "ariaLabel",
  "ariaDescription",
  "emptyMessage",
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

const collapse = (text) => text.replace(/\s+/g, " ");
const decodeEntities = (text) =>
  text
    .replace(/&apos;|&#39;|&#x27;/gi, "'")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");

function looksTechnical(value) {
  if (value.startsWith("--")) return true;
  if (value.includes("://") || value.includes("var(") || value.includes("calc(")) return true;
  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(value)) return true;
  if (/^[a-z][A-Za-z0-9]*$/.test(value)) return true;
  if (/^[a-z0-9-]+(\/[a-z0-9-]+)?$/.test(value) && /[-/]/.test(value)) return true;
  if (
    /^(?:[a-z0-9]+(?:[-:/][a-z0-9]+)*\s+)+[a-z0-9]+(?:[-:/][a-z0-9]+)*$/.test(value) &&
    /[-:/]/.test(value)
  ) {
    return true;
  }
  return false;
}

function isTranslatable(text) {
  const value = collapse(decodeEntities(text)).trim();
  if (value.length < 2) return false;
  if (!/[A-Za-z]/.test(value)) return false;
  if (/[\u4e00-\u9fff]/.test(value)) return false;
  if (/^(https?:\/\/|mailto:|www\.)/i.test(value)) return false;
  if (value.startsWith("/") || value.startsWith("\\") || value.startsWith("./")) return false;
  if (
    /^[\w.-]+\.(tsx?|jsx?|json|md|mdx|png|jpe?g|svg|gif|webp|css|html|sh|ya?ml|toml)$/i.test(value)
  )
    return false;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return false;
  if (/^[A-Z0-9&+.-]{1,8}$/.test(value)) return false;
  if (!/[A-Za-z]{2}/.test(value)) return false;
  if (value.split(" ").length === 1 && value.length < 3) return false;
  return !looksTechnical(value);
}

function walkFiles(directory) {
  const result = [];
  for (const entry of NodeFS.readdirSync(directory, { withFileTypes: true })) {
    const full = NodePath.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "i18n") continue;
      result.push(...walkFiles(full));
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

function processFile(file) {
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
  const keys = new Map();
  const rel = NodePath.relative(SRC, file).replaceAll("\\", "/");
  const record = (key) => {
    const entry = keys.get(key) ?? { key, files: new Set() };
    entry.files.add(rel);
    keys.set(key, entry);
  };

  const wrapLiteral = (literal) => {
    const value = collapse(decodeEntities(literal.text)).trim();
    if (!isTranslatable(value)) return;
    edits.push({
      start: literal.getStart(sourceFile),
      end: literal.getEnd(),
      replacement: `t(${JSON.stringify(value)})`,
    });
    record(value);
  };

  const wrapValue = (node) => {
    if (!node) return;
    if (ts.isParenthesizedExpression(node)) {
      wrapValue(node.expression);
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      wrapLiteral(node);
      return;
    }
    if (ts.isConditionalExpression(node)) {
      wrapValue(node.whenTrue);
      wrapValue(node.whenFalse);
      return;
    }
    if (ts.isBinaryExpression(node)) {
      const operator = node.operatorToken.kind;
      if (
        operator === ts.SyntaxKind.AmpersandAmpersandToken ||
        operator === ts.SyntaxKind.BarBarToken ||
        operator === ts.SyntaxKind.QuestionQuestionToken
      ) {
        wrapValue(node.left);
        wrapValue(node.right);
      }
    }
  };

  const visit = (node) => {
    if (
      ts.isJsxAttribute(node) &&
      node.initializer &&
      DISPLAY_ATTRIBUTES.has(node.name.getText(sourceFile))
    ) {
      if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        wrapValue(node.initializer.expression);
      }
    }
    if (ts.isPropertyAssignment(node) && node.initializer) {
      const name =
        ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null;
      if (
        name &&
        (DISPLAY_PROPS.has(name) ||
          /^[a-z][A-Za-z]*(Label|Title|Description|Placeholder|Message|Text|Heading)$/.test(name))
      ) {
        wrapValue(node.initializer);
      }
    }
    if (ts.isJsxExpression(node) && node.expression) {
      const parent = node.parent;
      if (parent && (ts.isJsxElement(parent) || ts.isJsxFragment(parent))) {
        wrapValue(node.expression);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (edits.length === 0) return null;
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
    const at = reparsed.parseDiagnostics[0].start ?? 0;
    console.error("CONTEXT:", JSON.stringify(output.slice(Math.max(0, at - 120), at + 120)));
    return null;
  }
  return { keys, output };
}

const mode = process.argv.includes("--check")
  ? "check"
  : process.argv.includes("--write")
    ? "write"
    : "preview";
const fileFlagIndex = process.argv.indexOf("--file");
const files =
  fileFlagIndex === -1 ? walkFiles(SRC) : [NodePath.resolve(ROOT, process.argv[fileFlagIndex + 1])];

const allKeys = new Map();
let changed = 0;
for (const file of files) {
  const result = processFile(file);
  if (!result) continue;
  if (mode === "preview") {
    console.log(`=== ${NodePath.relative(ROOT, file)}`);
    console.log(result.output);
    continue;
  }
  if (mode === "check") {
    console.log(NodePath.relative(ROOT, file).replaceAll("\\", "/"));
    continue;
  }
  NodeFS.writeFileSync(file, result.output, "utf8");
  changed += 1;
  for (const entry of result.keys.values()) {
    const existing = allKeys.get(entry.key);
    if (existing) {
      for (const name of entry.files) existing.files.add(name);
    } else {
      allKeys.set(entry.key, { key: entry.key, files: new Set(entry.files) });
    }
  }
}

if (mode === "write") {
  const payload = [...allKeys.values()]
    .map((entry) => ({ key: entry.key, files: [...entry.files].slice(0, 3) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  NodeFS.writeFileSync(
    NodePath.join("scripts/i18n/.work", "extracted-v4b.json"),
    JSON.stringify(payload, null, 1),
    "utf8",
  );
  console.log(JSON.stringify({ changed, newKeys: payload.length }, null, 2));
}
