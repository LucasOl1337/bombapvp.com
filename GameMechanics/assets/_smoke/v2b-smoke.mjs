/* Targeted visual checks: explosion close-up + death pose without overlay. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.SMOKE_URL ?? "http://localhost:5199/GameMechanics/?p2=bot";
const OUT = fileURLToPath(new URL("./", import.meta.url));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (err) => console.error("PAGEERROR:", err.message));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.advance_game_mechanics === "function");
await page.addStyleTag({ content: ".arena-overlay{display:none!important}" });
await page.evaluate(() => window.advance_game_mechanics(4000));

const canvas = page.locator(".arena-canvas");

// Explosion close-up: P1 plants at spawn, step until flames appear.
await page.keyboard.press("KeyQ");
let shot = false;
for (let i = 0; i < 30 && !shot; i += 1) {
  const snap = await page.evaluate(() => window.advance_game_mechanics(100));
  if (snap.flames.length > 0) {
    await canvas.screenshot({ path: `${OUT}/v2b-explosion.png` });
    shot = true;
  }
}
console.log("explosion captured:", shot);

// Death pose: step in small increments until someone is down (fresh anim frame).
let death = false;
for (let i = 0; i < 600 && !death; i += 1) {
  const snap = await page.evaluate(() => window.advance_game_mechanics(120));
  if (snap.competitors.some((c) => !c.alive)) {
    await canvas.screenshot({ path: `${OUT}/v2b-death.png` });
    death = true;
  }
  if (snap.phase === "match-over") break;
}
console.log("death captured:", death);

// Sudden-death pressure visuals: restart and fast-forward into SD.
await page.keyboard.press("KeyT");
await page.evaluate(() => window.advance_game_mechanics(4000));
let sd = false;
for (let i = 0; i < 400 && !sd; i += 1) {
  const snap = await page.evaluate(() => window.advance_game_mechanics(500));
  if (snap.phase === "sudden-death" && snap.pressure.closing) {
    await page.waitForTimeout(60);
    await canvas.screenshot({ path: `${OUT}/v2b-pressure.png` });
    sd = true;
  }
  if (snap.phase === "match-over") break;
}
console.log("pressure captured:", sd);

await browser.close();
console.log("smoke v2b done");
