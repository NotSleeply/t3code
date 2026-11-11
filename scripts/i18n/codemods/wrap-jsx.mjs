// Wraps JSX text, visible attributes, and UI object strings in t().
// Usage: node wrap-jsx.mjs [--write|--check|--file <path>]

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

const TRANSLATABLE_ATTRIBUTES = new Set([
  "title",
  "placeholder",
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "alt",
  "label",
  "description",
  "heading",
  "tooltip",
  "text",
  "emptyMessage",
  "emptyState",
]);

// Object literal keys that hold user-facing copy (toasts, dialogs, option lists).
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

function isTranslatablePropertyKey(name) {
  if (TRANSLATABLE_PROPERTY_KEYS.has(name)) return true;
  return /^[a-z][A-Za-z]*(Label|Title|Description|Placeholder|Message|Text|Heading)$/.test(name);
}

const SKIP_ELEMENTS = new Set([
  "code",
  "pre",
  "kbd",
  "samp",
  "script",
  "style",
  "textarea",
  "svg",
  "path",
  "circle",
  "rect",
]);

const SAFE_EXPRESSION = [
  /^\d+(\.\d+)?$/,
  /^["'`][^"'`]*["'`]$/,
  /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/,
  /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\.length$/,
  /^[A-Za-z_$][\w$.()]*\s*[-+*/]\s*[A-Za-z_$][\w$.()\d]*$/,
  /^(?:[A-Za-z_$][\w$.()]*|\d+)\s*(?:\?\?|\|\|)\s*(?:"[^"]*"|'[^']*'|\d+)$/,
  /^[A-Za-z_$][\w$.()]*\s*\?\s*(?:"[^"]*"|'[^']*'|\d+)\s*:\s*(?:"[^"]*"|'[^']*'|\d+)$/,
  /^[A-Za-z_$][\w$.()]*$/,
];

const ELEMENT_LIKE_SUFFIX = /(Link|Button|Icon|Element|Node|Component|Fragment|Wrapper|Children)$/;

function isSafeExpression(source) {
  const text = source.trim();
  if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(text)) {
    const parts = text.split(".");
    if (ELEMENT_LIKE_SUFFIX.test(parts[parts.length - 1])) return false;
    // PascalCase is likely a component or element; ALL_CAPS constants are usually strings.
    if (/^[A-Z]/.test(parts[0]) && !/^[A-Z][A-Z0-9_]*$/.test(parts[0])) return false;
    return true;
  }
  return SAFE_EXPRESSION.slice(1).some((pattern) => pattern.test(text));
}

const decodeEntities = (text) =>
  text
    .replace(/&apos;|&#39;|&#x27;/gi, "'")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));

const collapse = (text) => text.replace(/\s+/g, " ");

function isTranslatable(text) {
  const value = collapse(text).trim();
  if (value.length < 2) return false;
  if (!/[A-Za-z]/.test(value)) return false;
  if (/[\u4e00-\u9fff]/.test(value)) return false;
  if (/^(https?:\/\/|mailto:|www\.)/i.test(value)) return false;
  if (value.includes("://")) return false;
  if (value.startsWith("/") || value.startsWith("\\") || value.startsWith("./")) return false;
  if (
    /^[\w.-]+\.(tsx?|jsx?|json|md|mdx|png|jpe?g|svg|gif|webp|css|html|sh|ya?ml|toml)$/i.test(value)
  )
    return false;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return false;
  if (/^[A-Z0-9&+.-]{1,8}$/.test(value)) return false;
  if (/^[{[(@#$%^&*_+=|~<>]+/.test(value)) return false;
  if (!/[A-Za-z]{2}/.test(value)) return false;
  if (value.split(" ").length === 1 && value.length < 3) return false;
  return !looksTechnical(value);
}

// Style tokens and identifiers pass the letter test but are not copy.
function looksTechnical(value) {
  if (value.startsWith("--")) return true;
  const withoutPlaceholders = value.replace(/\{\w+\}/g, "");
  if (/[()[\]{}#;@=<>\\|]|\/\/|::|->/.test(withoutPlaceholders)) return true;
  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(value)) return true;
  if (/^[a-z][A-Za-z0-9]*$/.test(value)) return true;
  if (/^[a-z0-9-]+(?:\/[a-z0-9-]+)?$/.test(value) && /[-/]/.test(value)) return true;
  if (/^(?:[a-z0-9]+(?:[-:/][a-z0-9]+)*\s+)+[a-z0-9]+(?:[-:/][a-z0-9]+)*$/.test(value)) return true;
  return false;
}

function walkFiles(dir, extensions) {
  const result = [];
  for (const entry of NodeFS.readdirSync(dir, { withFileTypes: true })) {
    const full = NodePath.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "i18n") continue;
      result.push(...walkFiles(full, extensions));
    } else if (
      extensions.test(entry.name) &&
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

  const wrapLiteralEdit = (node, text, kind) => {
    const value = collapse(text).trim();
    edits.push({
      start: node.getStart(sourceFile),
      end: node.getEnd(),
      replacement: `t(${JSON.stringify(value)})`,
      kind,
    });
    record(value);
  };

  const addTextEdit = (node) => {
    const original = source.slice(node.pos, node.end);
    const value = collapse(decodeEntities(original)).trim();
    const leadingOriginal = original.length - original.trimStart().length;
    const trimmedOriginal = original.trim();
    const start = node.pos + leadingOriginal;
    const end = start + trimmedOriginal.length;
    edits.push({ start, end, replacement: `{t(${JSON.stringify(value)})}`, kind: "text" });
    record(value);
  };

  const visit = (node) => {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(sourceFile).toLowerCase();
      if (SKIP_ELEMENTS.has(tag)) return;
    }
    if (
      ts.isJsxSelfClosingElement(node) &&
      SKIP_ELEMENTS.has(node.tagName.getText(sourceFile).toLowerCase())
    ) {
      return;
    }

    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sourceFile);
      if (TRANSLATABLE_ATTRIBUTES.has(name)) {
        let text = null;
        if (ts.isStringLiteral(node.initializer)) {
          text = node.initializer.text;
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          const expression = node.initializer.expression;
          if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
            text = expression.text;
          }
        }
        if (text !== null && isTranslatable(text)) {
          const value = collapse(text).trim();
          edits.push({
            start: node.initializer.getStart(sourceFile),
            end: node.initializer.getEnd(),
            replacement: `{t(${JSON.stringify(value)})}`,
            kind: "attribute",
          });
          record(value);
        }
      }
    }

    if (ts.isPropertyAssignment(node) && node.initializer) {
      const name = ts.isIdentifier(node.name)
        ? node.name.text
        : ts.isStringLiteral(node.name)
          ? node.name.text
          : null;
      if (
        name &&
        isTranslatablePropertyKey(name) &&
        (ts.isStringLiteral(node.initializer) ||
          ts.isNoSubstitutionTemplateLiteral(node.initializer)) &&
        isTranslatable(node.initializer.text)
      ) {
        wrapLiteralEdit(node.initializer, node.initializer.text, "property");
      }
    }

    if ((ts.isJsxElement(node) || ts.isJsxFragment(node)) && node.children) {
      const children = node.children.filter(
        (child) => !(ts.isJsxExpression(child) && !child.expression),
      );
      const meaningful = children.filter(
        (child) => !(ts.isJsxText(child) && child.getText(sourceFile).trim() === ""),
      );
      const kinds = meaningful.map((child) => {
        if (ts.isJsxText(child)) return "text";
        if (ts.isJsxExpression(child)) return child.expression ? "expr" : "comment";
        return "element";
      });

      if (
        meaningful.length > 1 &&
        kinds.every((kind) => kind === "text" || kind === "expr") &&
        kinds.includes("expr") &&
        kinds.includes("text")
      ) {
        const expressions = [];
        const parts = [];
        let safe = true;
        let previousEnd = null;
        for (const child of children) {
          const start = child.pos;
          const end = child.end;
          if (previousEnd !== null && start > previousEnd) {
            parts.push(source.slice(previousEnd, start));
          }
          previousEnd = end;
          if (ts.isJsxText(child)) {
            parts.push(source.slice(start, end));
            continue;
          }
          if (!ts.isJsxExpression(child) || !child.expression) continue;
          const expression = child.expression;
          if (!isSafeExpression(expression.getText(sourceFile))) {
            safe = false;
            break;
          }
          parts.push(`{${expressions.length}}`);
          expressions.push(expression.getText(sourceFile));
        }
        const cleaned = collapse(decodeEntities(parts.join(""))).trim();
        if (safe && isTranslatable(cleaned)) {
          const start = meaningful[0].getStart(sourceFile);
          const end = meaningful[meaningful.length - 1].getEnd();
          const values = expressions.length ? `, [${expressions.join(", ")}]` : "";
          edits.push({
            start,
            end,
            replacement: `{t(${JSON.stringify(cleaned)}${values})}`,
            kind: "template",
          });
          record(cleaned);
          return;
        }
      }

      for (const child of meaningful) {
        if (ts.isJsxText(child)) {
          const trimmed = collapse(child.getText(sourceFile)).trim();
          if (!isTranslatable(trimmed)) continue;
          if (kinds.includes("element")) {
            if (trimmed.length < 3) continue;
            if (!/\s/.test(trimmed) && trimmed.length < 4) continue;
          } else if (kinds.includes("expr") && kinds.includes("text") && meaningful.length > 1) {
            continue;
          }
          addTextEdit(child);
        } else if (
          ts.isJsxExpression(child) &&
          child.expression &&
          (ts.isStringLiteral(child.expression) ||
            ts.isNoSubstitutionTemplateLiteral(child.expression))
        ) {
          const text = collapse(child.expression.text).trim();
          if (!isTranslatable(text)) continue;
          const start = child.expression.getStart(sourceFile);
          const end = child.expression.getEnd();
          edits.push({ start, end, replacement: `t(${JSON.stringify(text)})`, kind: "expression" });
          record(text);
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  if (edits.length === 0) return null;

  edits.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged = [];
  let lastEnd = -1;
  for (const edit of edits) {
    if (edit.start < lastEnd) continue;
    merged.push(edit);
    lastEnd = edit.end;
  }

  let output = source;
  for (let index = merged.length - 1; index >= 0; index -= 1) {
    const edit = merged[index];
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
    console.error("SKIP (parse error):", NodePath.relative(ROOT, file));
    for (const diagnostic of reparsed.parseDiagnostics.slice(0, 3)) {
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
  fileFlagIndex === -1
    ? walkFiles(SRC, /\.(tsx?|mts)$/)
    : [NodePath.resolve(ROOT, process.argv[fileFlagIndex + 1])];

const allKeys = new Map();
let changed = 0;
let editCount = 0;

for (const file of files) {
  if (mode !== "preview") {
    const preview = processFile(file);
    if (!preview) continue;
    if (mode === "check") {
      console.log(NodePath.relative(ROOT, file).replaceAll("\\", "/"));
      continue;
    }
    NodeFS.writeFileSync(file, preview.output, "utf8");
    changed += 1;
    editCount += preview.keys.size;
    for (const entry of preview.keys.values()) {
      const existing = allKeys.get(entry.key);
      if (existing) {
        for (const name of entry.files) existing.files.add(name);
      } else {
        allKeys.set(entry.key, { key: entry.key, files: new Set(entry.files) });
      }
    }
  } else {
    const preview = processFile(file);
    if (!preview) {
      console.log(`=== ${NodePath.relative(ROOT, file)} (no changes)`);
      continue;
    }
    console.log(`=== ${NodePath.relative(ROOT, file)}`);
    console.log(preview.output);
  }
}

if (mode === "write") {
  NodeFS.mkdirSync(OUT, { recursive: true });
  const payload = [...allKeys.values()]
    .map((entry) => ({ key: entry.key, files: [...entry.files].slice(0, 3) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  NodeFS.writeFileSync(
    NodePath.join(OUT, "extracted.json"),
    JSON.stringify(payload, null, 1),
    "utf8",
  );
  console.log(
    JSON.stringify(
      { files: files.length, changed, uniqueKeys: payload.length, editCount },
      null,
      2,
    ),
  );
}
