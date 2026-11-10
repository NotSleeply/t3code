import { t } from "~/i18n";
export const CODE_BLOCK_LANGUAGES = [
  { id: "", label: t("Plain text") },
  { id: "asm", label: t("Assembly") },
  { id: "bash", label: t("Bash") },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "css", label: "CSS" },
  { id: "dart", label: t("Dart") },
  { id: "diff", label: t("Diff") },
  { id: "dockerfile", label: t("Dockerfile") },
  { id: "elixir", label: t("Elixir") },
  { id: "go", label: "Go" },
  { id: "graphql", label: t("GraphQL") },
  { id: "haskell", label: t("Haskell") },
  { id: "html", label: "HTML" },
  { id: "java", label: t("Java") },
  { id: "javascript", label: t("JavaScript") },
  { id: "json", label: "JSON" },
  { id: "jsx", label: "JSX" },
  { id: "kotlin", label: t("Kotlin") },
  { id: "lua", label: t("Lua") },
  { id: "markdown", label: t("Markdown") },
  { id: "php", label: "PHP" },
  { id: "powershell", label: t("PowerShell") },
  { id: "python", label: t("Python") },
  { id: "r", label: "R" },
  { id: "ruby", label: t("Ruby") },
  { id: "rust", label: t("Rust") },
  { id: "scala", label: t("Scala") },
  { id: "scss", label: "SCSS" },
  { id: "sql", label: "SQL" },
  { id: "svelte", label: t("Svelte") },
  { id: "swift", label: t("Swift") },
  { id: "toml", label: "TOML" },
  { id: "tsx", label: "TSX" },
  { id: "typescript", label: t("TypeScript") },
  { id: "vue", label: t("Vue") },
  { id: "xml", label: "XML" },
  { id: "yaml", label: "YAML" },
  { id: "zig", label: t("Zig") },
] as const;

export type CodeBlockLanguage = { readonly id: string; readonly label: string };

const LANGUAGE_ALIASES: Record<string, string> = {
  assembly: "asm",
  cs: "csharp",
  "c++": "cpp",
  js: "javascript",
  md: "markdown",
  plaintext: "",
  py: "python",
  rb: "ruby",
  rs: "rust",
  s: "asm",
  sh: "bash",
  shell: "bash",
  text: "",
  ts: "typescript",
  txt: "",
  yml: "yaml",
};

export function languageOfInfoString(info: string): string {
  return info.trim().split(/\s+/, 1)[0] ?? "";
}

/** Plain text clears the language unless trailing metadata would be parsed as one. */
export function withInfoStringLanguage(info: string, language: string): string {
  const leading = /^\s*/.exec(info)![0];
  const rest = info.slice(leading.length + languageOfInfoString(info).length);
  if (language) return `${leading}${language}${rest}`;
  return rest.trim() ? `${leading}text${rest}` : "";
}

export function codeLanguageEntry(language: string): CodeBlockLanguage | null {
  const id = LANGUAGE_ALIASES[language.toLowerCase()] ?? language;
  return CODE_BLOCK_LANGUAGES.find((entry) => entry.id === id.toLowerCase()) ?? null;
}

export function codeLanguageLabel(language: string): string {
  return codeLanguageEntry(language)?.label ?? language;
}
