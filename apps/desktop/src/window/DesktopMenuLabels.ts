// Native application-menu and dialog copy runs in the Electron main process, which cannot read
// the renderer's language setting, so it follows the OS locale like the renderer default does.
export type MenuLocale = "en" | "zh-Hans";

export const menuLocaleFor = (systemLocale: string): MenuLocale =>
  /^zh(-|_|$)/i.test(systemLocale.trim()) ? "zh-Hans" : "en";

const ZH_HANS: Readonly<Record<string, string>> = {
  "About {0}": "关于 {0}",
  "Check for Updates...": "检查更新…",
  "Settings...": "设置…",
  "Hide {0}": "隐藏 {0}",
  "Quit {0}": "退出 {0}",
  File: "文件",
  Edit: "编辑",
  View: "视图",
  "Close Developer Tools": "关闭开发者工具",
  "Close Window": "关闭窗口",
  "Paste as Text": "以纯文本粘贴",
  Speech: "语音",
  Reload: "重新加载",
  "Force Reload": "强制重新加载",
  "Toggle Developer Tools": "切换开发者工具",
  "Actual Size": "实际大小",
  "Zoom In": "放大",
  "Zoom Out": "缩小",
  "You're up to date!": "已是最新版本！",
  "T3 Code {0} is currently the newest version available.": "T3 Code {0} 已是当前可用的最新版本。",
  OK: "确定",
  "Update check failed": "检查更新失败",
  "Could not check for updates.": "无法检查更新。",
  "An unknown error occurred. Please try again later.": "发生未知错误，请稍后重试。",
  "Updates unavailable": "更新不可用",
  "Automatic updates are not available right now.": "目前无法自动更新。",
};

export function menuLabel(
  locale: MenuLocale,
  template: string,
  values: ReadonlyArray<string> = [],
): string {
  const translated = locale === "zh-Hans" ? (ZH_HANS[template] ?? template) : template;
  if (values.length === 0) return translated;
  return translated.replace(/\{(\d+)\}/g, (match, index: string) => {
    const value = values[Number(index)];
    return value === undefined ? match : value;
  });
}
