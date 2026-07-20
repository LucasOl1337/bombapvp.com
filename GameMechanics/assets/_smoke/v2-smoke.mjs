/* Throwaway visual smoke for the GameMechanics prototype (aba 4). */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.SMOKE_URL ?? "http://localhost:5199/GameMechanics/?p2=bot";
const OUT = fileURLToPath(new URL("./", import.meta.url));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (err) => console.error("PAGEERROR:", err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.error("CONSOLE:", msg.text());
});

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.get_game_mechanics_snapshot === "function");
// Skip round-start countdown into live play.
await page.evaluate(() => window.advance_game_mechanics(4000));
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/v2-1-start.png` });

// Fuse arc + final-fuse warning ring: place bomb, wait into last 450ms.
await page.keyboard.press("KeyQ");
await page.waitForTimeout(1650);
await page.screenshot({ path: `${OUT}/v2-2-final-fuse.png` });

// Explosion: flames + bloom + shake + (likely) crate break.
await page.waitForTimeout(420);
await page.screenshot({ path: `${OUT}/v2-3-explosion.png` });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/v2-4-flame-tail.png` });

// Drive simulation until someone dies; capture the held death pose.
let captured = false;
for (let i = 0; i < 240 && !captured; i += 1) {
  const snap = await page.evaluate(() => window.advance_game_mechanics(500));
  const dead = snap.competitors.find((c) => !c.alive);
  if (dead && snap.phase !== "round-start" && snap.phase !== "match-over") {
    await page.waitForTimeout(120);
    await page.screenshot({ path: `${OUT}/v2-5-death.png` });
    captured = true;
  }
  if (snap.phase === "match-over") break;
}
console.log("death captured:", captured);

// Round-over overlay with portrait.
const snap = await page.evaluate(() => window.get_game_mechanics_snapshot());
if (snap.phase === "round-over" || snap.phase === "match-over") {
  await page.screenshot({ path: `${OUT}/v2-6-overlay.png` });
} else {
  await page.evaluate(() => window.advance_game_mechanics(3000));
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/v2-6-overlay.png` });
}

await browser.close();
console.log("smoke done");
