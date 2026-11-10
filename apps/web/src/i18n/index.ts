/** Stored preference. "system" follows the OS/browser language. */
export type LanguagePreference = "system" | "en" | "zh-Hans";

/** Resolved locale used by the message catalog. */
export type AppLocale = "en" | "zh-Hans";

const LANGUAGE_STORAGE_KEY = "t3code:display-language";

const EMPTY_CATALOG: Readonly<Record<string, string>> = {};

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === "system" || value === "en" || value === "zh-Hans";
}

export function resolveAppLocale(
  preference: LanguagePreference,
  systemLanguage: string,
): AppLocale {
  if (preference !== "system") return preference;
  return /^zh(-|_|$)/i.test(systemLanguage.trim()) ? "zh-Hans" : "en";
}

export function readLanguagePreference(): LanguagePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguagePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

/** Persists the choice. The locale is read once at boot, so callers reload the page. */
export function writeLanguagePreference(preference: LanguagePreference): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, preference);
  } catch {
    // A blocked storage must not stop the language switch from applying after a reload.
  }
}

const TEST_MODE = import.meta.env.MODE === "test";
const systemLanguage = typeof navigator === "undefined" ? "en" : navigator.language;
const initialPreference = TEST_MODE ? "system" : readLanguagePreference();
// Tests stay in English so existing text assertions remain stable; the app follows the system.
const currentLocale: AppLocale = TEST_MODE
  ? "en"
  : resolveAppLocale(initialPreference, systemLanguage);

// Only Chinese builds ship the catalog, as its own chunk. The top-level await makes every module
// that imports `t` evaluate after it resolves, so module-level t() calls are already translated.
const catalog: Readonly<Record<string, string>> =
  !TEST_MODE && currentLocale === "zh-Hans" ? (await import("./zh-Hans")).zhHans : EMPTY_CATALOG;

export function getLanguagePreference(): LanguagePreference {
  return initialPreference;
}

export function applyDocumentLanguage(): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = currentLocale === "zh-Hans" ? "zh-CN" : "en";
}

type TranslationValues = ReadonlyArray<string | number> | Readonly<Record<string, string | number>>;

/** Pure translation used by `t` and by tests. Missing entries fall back to the source string. */
export function translate(
  locale: AppLocale,
  source: string,
  values?: TranslationValues,
  messages: Readonly<Record<string, string>> = locale === "zh-Hans" ? catalog : EMPTY_CATALOG,
): string {
  const translated = messages[source] ?? source;
  if (!values) return translated;
  return translated.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = Array.isArray(values)
      ? values[Number(key) as keyof typeof values]
      : (values as Readonly<Record<string, string | number>>)[key];
    return value === undefined ? match : String(value);
  });
}

/**
 * Translates an English source string. `{0}`-style placeholders (or named ones) are filled
 * from `values`. Missing entries fall back to the source string, so new UI never breaks.
 */
export function t(source: string, values?: TranslationValues): string {
  return translate(currentLocale, source, values);
}
