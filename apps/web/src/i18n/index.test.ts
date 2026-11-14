import { describe, expect, it, vi } from "vite-plus/test";

import { resolveAppLocale, synchronizeLegacyLocale, translate } from "./index";
import { zhHans } from "./zh-Hans";

describe("resolveAppLocale", () => {
  it("follows a Chinese system language", () => {
    expect(resolveAppLocale("system", "zh-CN")).toBe("zh-Hans");
    expect(resolveAppLocale("system", "zh-Hans-CN")).toBe("zh-Hans");
    expect(resolveAppLocale("system", "zh_TW")).toBe("zh-Hans");
  });

  it("uses English for other system languages", () => {
    expect(resolveAppLocale("system", "en-US")).toBe("en");
    expect(resolveAppLocale("system", "de-DE")).toBe("en");
    expect(resolveAppLocale("system", "")).toBe("en");
  });

  it("honors an explicit choice over the system language", () => {
    expect(resolveAppLocale("en", "zh-CN")).toBe("en");
    expect(resolveAppLocale("zh-Hans", "en-US")).toBe("zh-Hans");
  });
});

it("reloads legacy translations only when the active catalog language changes", () => {
  const setItem = vi.fn();
  const reload = vi.fn();
  vi.stubGlobal("window", { localStorage: { setItem }, location: { reload } });
  try {
    expect(synchronizeLegacyLocale("en-US")).toBe(false);
    expect(synchronizeLegacyLocale("de")).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(synchronizeLegacyLocale("zh")).toBe(true);
    expect(setItem).toHaveBeenCalledWith("t3code:display-language", "zh-Hans");
    expect(reload).toHaveBeenCalledOnce();
    setItem.mockImplementationOnce(() => {
      throw new Error("Storage blocked");
    });
    expect(synchronizeLegacyLocale("zh")).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
  }
});

describe("translate", () => {
  it("returns the source string when a locale has no entry", () => {
    expect(translate("zh-Hans", "A string that is not translated")).toBe(
      "A string that is not translated",
    );
    expect(translate("en", "Settings")).toBe("Settings");
  });

  it("fills positional and named placeholders", () => {
    expect(translate("en", "Sent {0} messages", [3])).toBe("Sent 3 messages");
    expect(translate("en", "Owned by {owner}", { owner: "Ada" })).toBe("Owned by Ada");
  });

  it("leaves unknown placeholders intact", () => {
    expect(translate("en", "Sent {0} messages", [])).toBe("Sent {0} messages");
  });

  it("uses the Chinese catalog for translated UI copy", () => {
    const first = Object.entries(zhHans)[0];
    expect(first).toBeDefined();
    const [source, translated] = first!;
    expect(translate("zh-Hans", source, undefined, zhHans)).toBe(translated);
  });

  it("keeps every catalog value usable and every placeholder intact", () => {
    for (const [source, translated] of Object.entries(zhHans)) {
      expect(translated.trim(), source).not.toBe("");
      const sourcePlaceholders = new Set(source.match(/\{\w+\}/g) ?? []);
      const translatedPlaceholders = new Set(translated.match(/\{\w+\}/g) ?? []);
      for (const placeholder of translatedPlaceholders) {
        expect(sourcePlaceholders.has(placeholder), `${source} -> ${translated}`).toBe(true);
      }
    }
  });
});
