import { lucideIconNames } from "./lib/lucideIconByName";
import { t } from "~/i18n";
export { PROJECT_ICON_COLORS, projectIconColorClassName } from "./projectIconColors";

const POPULAR_PROJECT_ICONS: ReadonlyArray<string> = [
  "folder-code",
  "code-2",
  "terminal",
  "globe-2",
  "server",
  "database",
  "bot",
  "sparkles",
  "smartphone",
  "monitor",
  "cloud-cog",
  "package",
  "book-open",
  "flask-conical",
  "shield-check",
  "rocket",
  "gamepad-2",
  "music",
  "image",
  "shopping-bag",
  "git-branch",
  "workflow",
  "wrench",
  "layers-3",
];

export const PROJECT_EMOJIS: ReadonlyArray<{ readonly emoji: string; readonly label: string }> = [
  { emoji: "💻", label: t("Computer") },
  { emoji: "🛠️", label: t("Tools") },
  { emoji: "🚀", label: t("Rocket") },
  { emoji: "🤖", label: t("Robot") },
  { emoji: "✨", label: t("Sparkles") },
  { emoji: "⚡", label: t("Lightning") },
  { emoji: "🌐", label: t("Web") },
  { emoji: "📱", label: t("Mobile") },
  { emoji: "🖥️", label: t("Desktop") },
  { emoji: "⌨️", label: t("Keyboard") },
  { emoji: "⚙️", label: t("Gear") },
  { emoji: "🗄️", label: t("Database") },
  { emoji: "☁️", label: t("Cloud") },
  { emoji: "📦", label: t("Package") },
  { emoji: "📚", label: t("Books") },
  { emoji: "🧪", label: t("Test tube") },
  { emoji: "🔒", label: t("Lock") },
  { emoji: "🎮", label: t("Game") },
  { emoji: "🎵", label: t("Music") },
  { emoji: "🎬", label: t("Movie") },
  { emoji: "🖼️", label: t("Picture") },
  { emoji: "🛍️", label: t("Shopping") },
  { emoji: "🔥", label: t("Fire") },
  { emoji: "💡", label: t("Idea") },
  { emoji: "🧩", label: t("Puzzle") },
  { emoji: "📊", label: t("Chart") },
  { emoji: "🧠", label: t("Brain") },
  { emoji: "🦄", label: t("Unicorn") },
  { emoji: "🐙", label: t("Octopus") },
  { emoji: "🌱", label: t("Seedling") },
];

export function filterProjectIconNames(query: string): ReadonlyArray<string> {
  const normalized = query.trim().toLowerCase().replaceAll(/\s+/g, "-");
  if (!normalized) return POPULAR_PROJECT_ICONS;
  return lucideIconNames.filter((name) => name.includes(normalized)).slice(0, 60);
}

export function firstEmoji(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const segments = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(trimmed);
  const segment = segments[Symbol.iterator]().next().value?.segment;
  const isFlag = /^\p{Regional_Indicator}{2}$/u.test(segment ?? "");
  const isKeycap = /^[#*0-9]\uFE0F?\u20E3$/u.test(segment ?? "");
  if (!segment || (!/\p{Extended_Pictographic}/u.test(segment) && !isFlag && !isKeycap)) {
    return null;
  }
  return segment;
}
