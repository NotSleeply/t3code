// Remove `t` imports that are no longer referenced.
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
      if (e.name !== "node_modules") out.push(...walk(p));
    } else if (
      /\.tsx?$/.test(e.name) &&
      !/\.(test|browser\.test|bench)\./.test(e.name) &&
      !e.name.endsWith(".d.ts")
    )
      out.push(p);
  }
  return out;
}
let removed = 0;
for (const file of walk(SRC)) {
  const source = NodeFS.readFileSync(file, "utf8");
  if (!source.includes('from "~/i18n"')) continue;
  const isTsx = file.endsWith(".tsx");
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let importDecl = null;
  for (const statement of sf.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      statement.moduleSpecifier.text === "~/i18n" &&
      statement.importClause &&
      statement.importClause.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      if (
        statement.importClause.namedBindings.elements.some(
          (e) => e.name.text === "t" && !e.propertyName,
        )
      ) {
        importDecl = statement;
        break;
      }
    }
  }
  if (!importDecl) continue;
  let used = false;
  const scan = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "t"
    )
      used = true;
    if (
      ts.isIdentifier(node) &&
      node.text === "t" &&
      node !== importDecl &&
      !ts.isImportSpecifier(node.parent)
    )
      used = true;
    ts.forEachChild(node, scan);
  };
  scan(sf);
  if (used) continue;
  const bindings = importDecl.importClause.namedBindings.elements;
  const otherBindings = bindings.filter((e) => !(e.name.text === "t" && !e.propertyName));
  let output;
  if (otherBindings.length === 0) {
    const start = importDecl.getStart(sf);
    let end = importDecl.getEnd();
    if (source[end] === "\n") end += 1;
    output = source.slice(0, start) + source.slice(end);
  } else {
    const start = importDecl.getStart(sf);
    const end = importDecl.getEnd();
    const clauseText = importDecl.importClause.getText(sf);
    const namedStart = clauseText.indexOf("{");
    const namedEnd = clauseText.lastIndexOf("}");
    const inner = clauseText.slice(namedStart + 1, namedEnd);
    const kept = inner
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && s !== "t");
    const typePrefix = clauseText.startsWith("type ") ? "type " : "";
    const newClause = `${typePrefix}{ ${kept.join(", ")} }`;
    output = source.slice(0, start) + `import ${newClause} from "~/i18n";` + source.slice(end);
  }
  NodeFS.writeFileSync(file, output, "utf8");
  removed += 1;
}
console.log("removed unused t imports from", removed, "files");
