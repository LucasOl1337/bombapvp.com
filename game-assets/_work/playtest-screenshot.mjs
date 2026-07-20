import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const out = "game-assets/arenas/themes/tournament-clean/_playtest-training.png";
mkdirSync(dirname(out), { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text());
});

const url =
  "http://127.0.0.1:4173/arena/?mode=training&arenaTheme=tournament-clean";
console.log("goto", url);
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
// Wait for match canvas (round intro may overlay briefly).
await page.waitForSelector("canvas", { timeout: 30000 });
await page.waitForTimeout(5500);
const canvas = await page.$("canvas");
console.log("canvas", Boolean(canvas));
await page.screenshot({ path: out, fullPage: false });
console.log("wrote", out);
await browser.close();
