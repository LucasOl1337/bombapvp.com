/* Screenshot da arena GameMechanics com input real (dispensa o overlay "Vai!"). */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto('http://localhost:5173/GameMechanics/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  // dispensa overlay de rodada: simula inicio (RDY + tecla de movimento)
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyS');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: process.argv[2] });
  await browser.close();
})();
