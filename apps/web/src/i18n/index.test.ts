import { describe, expect, it } from "vite-plus/test";

import { resolveAppLocale, translate } from "./index";
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
    expect(translate("zh-Hans", source)).toBe(translated);
  });
});
