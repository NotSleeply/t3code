// Wraps display props and `*_LABELS` maps in t().
// Usage: node wrap-label-maps.mjs [--write|--check|--file <path>]

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const ROOT = process.cwd();
const SRC = NodePath.join(ROOT, "apps/web/src");
const OUT = "scripts/i18n/.work";

const tsPath = (() => {
  const dir = NodeFS.readdirSync(NodePath.join(ROOT, "node_modules/.pnpm"));
  const entry = dir.find((name) => /^typescript@6\./.test(name));
  if (!entry) throw new Error("typescript not found in virtual store");
  return NodePath.join(
    ROOT,
    "node_modules/.pnpm",
    entry,
    "node_modules/typescript/lib/typescript.js",
  );
})();
const ts = (await import(NodeURL.pathToFileURL(tsPath).href)).default;

const TRANSLATABLE_PROPERTY_KEYS = new Set([
  "title",
  "label",
  "description",
  "heading",
  "message",
  "placeholder",
  "tooltip",
  "alt",
  "text",
  "ariaLabel",
  "dialogTitle",
  "dialogDescription",
  "emptyLabel",
  "emptyMessage",
  "emptyText",
  "successMessage",
  "errorMessage",
  "statusLabel",
  "actionLabel",
  "confirmLabel",
  "cancelLabel",
  "submitLabel",
  "buttonLabel",
  "loadingLabel",
  "ctaLabel",
  "displayLabel",
  "helperText",
  "bodyText",
]);

const LABEL_MAP_NAME = /(LABELS|Label|LABELS_BY_|_OPTION_LABELS)$/;

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
  ) {
    return false;
  }
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return false;
  if (/^[A-Z0-9&+.-]{1,8}$/.test(value)) return false;
  if (!/[A-Za-z]{2}/.test(value)) return false;
  if (value.split(" ").length === 1 && value.length < 3) return false;
  return !looksTechnical(value);
}

function walkFiles(dir) {
  const result = [];
  for (const entry of NodeFS.readdirSync(dir, { withFileTypes: true })) {
    const full = NodePath.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "i18n") continue;
      result.push(...walkFiles(full));
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !/\.(test|browser\.test|bench)\./.test(entry.name) &&
      !/\.d\.ts$/.test(entry.name) &&
      entry.name !== "routeTree.gen.ts" &&
      !entry.name.endsWith(".generated.ts")
    ) {
      result.push(full);
    }
  }
  return result;
}

function hasI18nImport(sourceFile) {
  return sourceFile.statements.some((statement) => {
    if (!ts.isImportDeclaration(statement)) return false;
    return /(^|\/)i18n$/.test(statement.moduleSpecifier.text);
  });
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

function unwrapExpression(expression) {
  let current = expression;
  for (;;) {
    if (ts.isParenthesizedExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isAsExpression(current) || ts.isSatisfiesExpression(current)) {
      current = current.expression;
      continue;
    }
    return current;
  }
}

function propertyName(node) {
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) return node.name.text;
  return null;
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
    const start = literal.getStart(sourceFile);
    if (edits.some((edit) => edit.start === start)) return;
    edits.push({
      start,
      end: literal.getEnd(),
      replacement: `t(${JSON.stringify(value)})`,
      kind: "literal",
    });
    record(value);
  };

  const visit = (node) => {
    if (ts.isPropertyAssignment(node) && node.initializer) {
      const name = propertyName(node);
      if (
        name &&
        (TRANSLATABLE_PROPERTY_KEYS.has(name) ||
          /^[a-z][A-Za-z]*(Label|Title|Description|Placeholder|Message|Text|Heading)$/.test(name))
      ) {
        const initializer = unwrapExpression(node.initializer);
        if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
          wrapLiteral(initializer);
        }
      }
    }

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (LABEL_MAP_NAME.test(node.name.text)) {
        const initializer = unwrapExpression(node.initializer);
        if (ts.isObjectLiteralExpression(initializer)) {
          for (const property of initializer.properties) {
            if (!ts.isPropertyAssignment(property)) continue;
            const value = unwrapExpression(property.initializer);
            if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
              wrapLiteral(value);
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  if (edits.length === 0) return null;

  let output = source;
  const sorted = edits.sort((a, b) => b.start - a.start);
  for (const edit of sorted) {
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
    for (const diagnostic of reparsed.parseDiagnostics.slice(0, 2)) {
      console.error("  ", diagnostic.messageText, "at", diagnostic.start);
    }
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
    NodePath.join(OUT, "extracted-v3.json"),
    JSON.stringify(payload, null, 1),
    "utf8",
  );
  console.log(JSON.stringify({ files: files.length, changed, newKeys: payload.length }, null, 2));
}
