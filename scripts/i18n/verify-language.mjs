// Integrated verification of the language setting in a real Chromium client.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const playwrightPath = (() => {
  const dir = NodeFS.readdirSync(NodePath.join(process.cwd(), "node_modules/.pnpm"));
  const entry = dir.find((name) => /^playwright@1\./.test(name));
  if (!entry) throw new Error("playwright not found");
  return NodePath.join(
    NodePath.join(process.cwd(), "node_modules/.pnpm"),
    entry,
    "node_modules/playwright",
  );
})();
const { chromium } = await import(
  NodeURL.pathToFileURL(NodePath.join(playwrightPath, "index.mjs")).href
);

const pairingUrl = process.argv[2];
const outDir = process.argv[3] ?? "scripts/i18n/.work/screens";
NodeFS.mkdirSync(outDir, { recursive: true });

const results = {};
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

async function waitForApp(timeout = 60_000) {
  await page.waitForFunction(() => document.body.innerText.length > 200, undefined, { timeout });
  await page.waitForTimeout(1200);
}

async function bodyText() {
  return page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 2500));
}

try {
  await page.goto(pairingUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await waitForApp();
  results.initial = { lang: await page.evaluate(() => document.documentElement.lang) };
  await page.screenshot({ path: NodePath.join(outDir, "0-main-system.png") });

  await page.evaluate(() => localStorage.setItem("t3code:display-language", "zh-Hans"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp();
  results.zh = {
    lang: await page.evaluate(() => document.documentElement.lang),
    sample: (await bodyText()).slice(0, 300),
  };
  await page.screenshot({ path: NodePath.join(outDir, "1-main-zh.png") });

  const origin = new URL(pairingUrl).origin;
  await page.goto(`${origin}/settings/appearance`, { waitUntil: "domcontentloaded" });
  await waitForApp();
  results.settingsZh = { url: page.url(), sample: (await bodyText()).slice(0, 500) };
  await page.screenshot({ path: NodePath.join(outDir, "2-settings-appearance-zh.png") });

  const trigger = page.getByRole("combobox", { name: /语言|Language/ }).first();
  await trigger.waitFor({ state: "visible", timeout: 20_000 });
  await trigger.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: NodePath.join(outDir, "3-language-menu-zh.png") });
  results.menuOptions = await page.getByRole("option").allInnerTexts();

  const english = page.getByRole("option", { name: "English" }).first();
  await english.click();
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(1500);
  await waitForApp();
  results.afterEnglish = {
    lang: await page.evaluate(() => document.documentElement.lang),
    preference: await page.evaluate(() => localStorage.getItem("t3code:display-language")),
    sample: (await bodyText()).slice(0, 300),
  };
  await page.screenshot({ path: NodePath.join(outDir, "4-settings-en.png") });

  // Switch back to Chinese from the now-English settings page.
  const triggerEn = page.getByRole("combobox", { name: /Language/ }).first();
  await triggerEn.waitFor({ state: "visible", timeout: 20_000 });
  await triggerEn.click();
  await page.waitForTimeout(600);
  await page.getByRole("option", { name: "简体中文" }).first().click();
  await page.waitForTimeout(1500);
  await waitForApp();
  results.restoredZh = {
    lang: await page.evaluate(() => document.documentElement.lang),
    preference: await page.evaluate(() => localStorage.getItem("t3code:display-language")),
    sample: (await bodyText()).slice(0, 300),
  };
  await page.screenshot({ path: NodePath.join(outDir, "5-main-zh-restored.png") });
} catch (error) {
  results.error = String(error?.stack ?? error);
  try {
    await page.screenshot({ path: NodePath.join(outDir, "error.png") });
  } catch {}
} finally {
  NodeFS.writeFileSync(
    NodePath.join(outDir, "results.json"),
    JSON.stringify(results, null, 2),
    "utf8",
  );
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}
