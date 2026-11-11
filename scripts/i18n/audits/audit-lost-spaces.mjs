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
const flagged = [];
for (const file of walk(SRC)) {
  const rel = NodePath.relative(SRC, file).replaceAll("\\", "/");
  let mainSource;
  try {
    mainSource = execSync(`git show main:apps/web/src/${rel}`, {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch {
    continue;
  }
  const current = NodeFS.readFileSync(file, "utf8");
  if (!current.includes("t(")) continue;
  const sf = ts.createSourceFile(file, current, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "t" &&
      node.arguments.length === 1
    ) {
      const arg = node.arguments[0];
      if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
        const key = arg.text;
        if (key.length > 2 && /[A-Za-z]/.test(key)) {
          const padded = [`"${key} "`, `" ${key}"`];
          if (padded.some((p) => mainSource.includes(p))) {
            flagged.push({ file: rel, key, padded: padded.filter((p) => mainSource.includes(p)) });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
console.log("flagged", flagged.length);
for (const f of flagged)
  console.log(
    f.file,
    "|",
    JSON.stringify(f.key).slice(0, 80),
    "|",
    f.padded.join(" / ").slice(0, 80),
  );
