// Wraps template-literal attributes and children in t().
// Usage: node wrap-templates.mjs [--write|--check|--file <path>]

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
  "message",
]);

const ELEMENT_LIKE_SUFFIX =
  /(Link|Button|Icon|Element|Node|Component|Fragment|Wrapper|Children|Content|Slot|Avatar|Badge|Logo|Image|Img|Spinner|Loader)$/;
const ELEMENT_LIKE_NAME =
  /^(icon|icons|children|content|node|element|link|button|avatar|badge|logo|image|img|figure|spinner|loader|slot|mark|marks)$/;

function isSafeIdentifierName(name) {
  if (ELEMENT_LIKE_NAME.test(name)) return false;
  if (ELEMENT_LIKE_SUFFIX.test(name)) return false;
  if (/^[A-Z]/.test(name) && !/^[A-Z][A-Z0-9_]*$/.test(name)) return false;
  return true;
}

function isSafeExpressionNode(expr) {
  if (!expr) return false;
  if (
    ts.isNumericLiteral(expr) ||
    ts.isStringLiteral(expr) ||
    ts.isNoSubstitutionTemplateLiteral(expr)
  ) {
    return true;
  }
  if (ts.isParenthesizedExpression(expr)) return isSafeExpressionNode(expr.expression);
  if (ts.isIdentifier(expr)) return isSafeIdentifierName(expr.text);
  if (ts.isPropertyAccessExpression(expr)) {
    const base = expr.expression;
    const baseSafe = ts.isIdentifier(base)
      ? !/^[A-Z]/.test(base.text) || /^[A-Z][A-Z0-9_]*$/.test(base.text)
      : isSafeExpressionNode(base);
    return (
      baseSafe &&
      !ELEMENT_LIKE_NAME.test(expr.name.text) &&
      !ELEMENT_LIKE_SUFFIX.test(expr.name.text)
    );
  }
  if (ts.isTemplateExpression(expr)) {
    return expr.templateSpans.every((span) => isSafeExpressionNode(span.expression));
  }
  if (ts.isConditionalExpression(expr)) {
    return isSafeExpressionNode(expr.whenTrue) && isSafeExpressionNode(expr.whenFalse);
  }
  if (ts.isBinaryExpression(expr)) {
    return isSafeExpressionNode(expr.left) && isSafeExpressionNode(expr.right);
  }
  if (ts.isPrefixUnaryExpression(expr)) return isSafeExpressionNode(expr.operand);
  if (ts.isCallExpression(expr)) {
    if (ts.isPropertyAccessExpression(expr.expression)) {
      const method = expr.expression.name.text;
      const stringMethod = [
        "get",
        "length",
        "toString",
        "toLocaleString",
        "toFixed",
        "join",
        "slice",
        "substring",
        "substr",
        "toUpperCase",
        "toLowerCase",
        "trim",
        "trimStart",
        "trimEnd",
        "padStart",
        "padEnd",
        "repeat",
        "replace",
        "replaceAll",
        "concat",
      ].includes(method);
      const baseSafe =
        ts.isIdentifier(expr.expression.expression) ||
        ts.isPropertyAccessExpression(expr.expression.expression) ||
        ts.isCallExpression(expr.expression.expression);
      return stringMethod && baseSafe;
    }
    if (ts.isIdentifier(expr.expression)) {
      const name = expr.expression.text;
      if (["String", "Number", "Boolean"].includes(name)) return true;
      // Formatting/label helpers whose return value is display text. Typecheck still guards
      // against a React element reaching t().
      return /^(capitalize|format|plural|describe|pluralize)|(Label|Name|Title|Term|Snippet|Text|Status)$/.test(
        name,
      );
    }
    return false;
  }
  if (ts.isElementAccessExpression(expr)) return isSafeExpressionNode(expr.expression);
  return false;
}

const collapse = (text) => text.replace(/\s+/g, " ");

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

function looksTechnical(value) {
  if (value.startsWith("--")) return true;
  if (value.includes("://") || value.includes("var(") || value.includes("calc(")) return true;
  if (/\/\/|::|->/.test(value)) return true;
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
      /\.tsx$/.test(entry.name) &&
      !/\.(test|browser\.test|bench)\./.test(entry.name) &&
      !entry.name.endsWith(".d.ts")
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

function templateFromExpression(expression, sourceFile) {
  if (ts.isNoSubstitutionTemplateLiteral(expression)) {
    return { template: expression.text, values: [] };
  }
  if (!ts.isTemplateExpression(expression)) return null;
  let template = expression.head.text;
  const values = [];
  for (const span of expression.templateSpans) {
    template += `{${values.length}}${span.literal.text}`;
    values.push(span.expression.getText(sourceFile));
  }
  return { template, values };
}

function wrapTemplateEdit(targetNode, expression, sourceFile, edits, record, withBraces = false) {
  const built = templateFromExpression(expression, sourceFile);
  if (!built) return false;
  const wrap = (inner) => (withBraces ? `{${inner}}` : inner);
  if (!built.values.length) {
    if (!isTranslatable(built.template)) return false;
    edits.push({
      start: targetNode.getStart(sourceFile),
      end: targetNode.getEnd(),
      replacement: wrap(`t(${JSON.stringify(collapse(decodeEntities(built.template)).trim())})`),
      kind: "template-literal",
    });
    record(collapse(built.template).trim());
    return true;
  }
  const allSafe = expression.templateSpans.every((span) => isSafeExpressionNode(span.expression));
  const template = collapse(decodeEntities(built.template)).trim();
  if (!allSafe || !isTranslatable(template)) {
    if (!allSafe) return false;
    // The template is interpolation-only; translate the literal words inside its spans.
    let wrapped = false;
    for (const span of expression.templateSpans) {
      const scan = (node) => {
        if (
          (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
          isTranslatable(node.text) &&
          !(
            ts.isCallExpression(node.parent) &&
            ts.isIdentifier(node.parent.expression) &&
            node.parent.expression.text === "t"
          )
        ) {
          const value = collapse(decodeEntities(node.text)).trim();
          edits.push({
            start: node.getStart(sourceFile),
            end: node.getEnd(),
            replacement: `t(${JSON.stringify(value)})`,
            kind: "template-inner",
          });
          record(value);
          wrapped = true;
        }
        ts.forEachChild(node, scan);
      };
      scan(span.expression);
    }
    return wrapped;
  }
  edits.push({
    start: targetNode.getStart(sourceFile),
    end: targetNode.getEnd(),
    replacement: wrap(`t(${JSON.stringify(template)}, [${built.values.join(", ")}])`),
    kind: "template-literal",
  });
  record(template);
  return true;
}

function processFile(file) {
  const source = NodeFS.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const edits = [];
  const keys = new Map();
  const rel = NodePath.relative(SRC, file).replaceAll("\\", "/");
  const record = (key) => {
    const entry = keys.get(key) ?? { key, files: new Set() };
    entry.files.add(rel);
    keys.set(key, entry);
  };

  const addTextEdit = (node) => {
    const original = source.slice(node.pos, node.end);
    const value = collapse(decodeEntities(original)).trim();
    const leadingOriginal = original.length - original.trimStart().length;
    const start = node.pos + leadingOriginal;
    edits.push({
      start,
      end: start + original.trim().length,
      replacement: `{t(${JSON.stringify(value)})}`,
      kind: "text",
    });
    record(value);
  };

  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sourceFile);
      if (TRANSLATABLE_ATTRIBUTES.has(name)) {
        if (ts.isStringLiteral(node.initializer) && isTranslatable(node.initializer.text)) {
          const value = collapse(decodeEntities(node.initializer.text)).trim();
          edits.push({
            start: node.initializer.getStart(sourceFile),
            end: node.initializer.getEnd(),
            replacement: `{t(${JSON.stringify(value)})}`,
            kind: "attribute",
          });
          record(value);
        } else if (
          ts.isJsxExpression(node.initializer) &&
          node.initializer.expression &&
          ts.isTemplateExpression(node.initializer.expression)
        ) {
          wrapTemplateEdit(
            node.initializer,
            node.initializer.expression,
            sourceFile,
            edits,
            record,
            true,
          );
        }
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
        let safe = true;
        for (const child of meaningful) {
          if (!ts.isJsxExpression(child) || !child.expression) continue;
          if (!isSafeExpressionNode(child.expression)) {
            safe = false;
            break;
          }
          expressions.push(child.expression.getText(sourceFile));
        }
        if (safe) {
          const parts = [];
          let previousEnd = null;
          let index = 0;
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
            parts.push(`{${index}}`);
            index += 1;
          }
          const cleaned = collapse(decodeEntities(parts.join(""))).trim();
          if (isTranslatable(cleaned) && index === expressions.length) {
            edits.push({
              start: meaningful[0].getStart(sourceFile),
              end: meaningful[meaningful.length - 1].getEnd(),
              replacement: `{t(${JSON.stringify(cleaned)}, [${expressions.join(", ")}])}`,
              kind: "template",
            });
            record(cleaned);
            return;
          }
        }
      }

      // Fallback: wrap each remaining text node on its own, even when markup splits the sentence.
      if (process.env.DEBUG_FILE && file.includes(process.env.DEBUG_FILE)) {
        console.error(
          "DEBUG element children",
          JSON.stringify(kinds),
          meaningful.map((c) => c.getText(sourceFile).slice(0, 30)),
        );
      }
      for (const child of meaningful) {
        if (ts.isJsxText(child)) {
          const original = source.slice(child.pos, child.end);
          const trimmed = collapse(decodeEntities(original)).trim();
          if (process.env.DEBUG_FILE && file.includes(process.env.DEBUG_FILE)) {
            console.error("DEBUG text", JSON.stringify(trimmed), isTranslatable(trimmed));
          }
          if (!isTranslatable(trimmed)) continue;
          addTextEdit(child);
        } else if (
          ts.isJsxExpression(child) &&
          child.expression &&
          (ts.isStringLiteral(child.expression) ||
            ts.isNoSubstitutionTemplateLiteral(child.expression))
        ) {
          const text = collapse(decodeEntities(child.expression.text)).trim();
          if (!isTranslatable(text)) continue;
          edits.push({
            start: child.expression.getStart(sourceFile),
            end: child.expression.getEnd(),
            replacement: `t(${JSON.stringify(text)})`,
            kind: "expression",
          });
          record(text);
        } else if (
          ts.isJsxExpression(child) &&
          child.expression &&
          ts.isTemplateExpression(child.expression)
        ) {
          wrapTemplateEdit(child.expression, child.expression, sourceFile, edits, record);
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  if (process.env.DEBUG_FILE && file.includes(process.env.DEBUG_FILE)) {
    const found = [];
    const scan = (n) => {
      if (ts.isJsxText(n) && !n.getText(sourceFile).trim().startsWith("{"))
        found.push(JSON.stringify(n.getText(sourceFile)));
      ts.forEachChild(n, scan);
    };
    scan(sourceFile);
    console.error("DEBUG text nodes:", found);
    console.error("DEBUG edits:", edits.length);
  }
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
    ts.ScriptKind.TSX,
  );
  if (reparsed.parseDiagnostics.length > 0) {
    console.error("SKIP (parse error):", NodePath.relative(ROOT, file));
    for (const diagnostic of reparsed.parseDiagnostics.slice(0, 3)) {
      console.error("  ", diagnostic.messageText, "at", diagnostic.start);
    }
    const at = reparsed.parseDiagnostics[0].start ?? 0;
    console.error("CONTEXT:", JSON.stringify(output.slice(Math.max(0, at - 160), at + 120)));
    console.error(
      "EDITS:",
      JSON.stringify(
        merged.map((e) => ({ ...e, text: source.slice(e.start, e.end).slice(0, 60) })),
      ),
    );
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
    NodePath.join(OUT, "extracted-v2.json"),
    JSON.stringify(payload, null, 1),
    "utf8",
  );
  console.log(JSON.stringify({ files: files.length, changed, newKeys: payload.length }, null, 2));
}
