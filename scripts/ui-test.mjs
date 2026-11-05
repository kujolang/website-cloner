import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("artifacts/ui", { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || "chrome",
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4310");
  await page.screenshot({ path: "artifacts/ui/submit.png", fullPage: true });
  await page.getByLabel("Your website address").fill("http://127.0.0.1:9412/");
  await page.getByRole("button", { name: "Rebuild my website" }).click();
  await page.locator("#progress").waitFor({ state: "visible" });
  await page.screenshot({ path: "artifacts/ui/progress.png" });
  await page.reload();
  await page.locator("#result").waitFor({ state: "visible", timeout: 240000 });
  await page.screenshot({ path: "artifacts/ui/result.png", fullPage: true });
  await page.getByRole("button", { name: "Mobile", exact: true }).click();
  assert.equal(
    await page.locator("#preview").evaluate((e) => e.style.width),
    "390px",
  );
  const frame = page.frameLocator("#preview");
  await frame.locator("main").waitFor();
  assert((await frame.locator("main").innerText()).length > 20);
  const download = await page.locator("#download").getAttribute("href");
  const response = await page.request.get("http://127.0.0.1:4310" + download);
  assert.equal(response.status(), 200);
  assert.equal((await response.body()).subarray(0, 2).toString(), "PK");
  await page.getByRole("button", { name: "GitHub Pages" }).click();
  assert.match(await page.locator("#deployment").innerText(), /not connected/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/ui/mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/ui/results.json",
    JSON.stringify(
      {
        passed: true,
        jobURL: page.url(),
        checks: [
          "submit",
          "real progress",
          "refresh recovery",
          "completed preview",
          "mobile preview",
          "ZIP download signature",
          "deployment limitation",
          "no app JS errors",
          "mobile overflow",
        ],
      },
      null,
      2,
    ),
  );
  console.log("UI workflow passed", page.url());
} finally {
  await browser.close();
}
