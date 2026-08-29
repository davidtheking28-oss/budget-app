const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = 'C:\\Users\\david\\AppData\\Local\\Temp\\claude\\c--Users-david-projects-ai-budget\\ba505acc-4a86-40db-bcd5-b2516cb7229e\\scratchpad\\shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const BASE = 'http://localhost:5199';
const CLIENT_A = '11111111-1111-1111-1111-111111111111';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } });
  await page.goto(`${BASE}/?client=${CLIENT_A}&nav=expenses`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SHOT_DIR, 'exp_light.png') });
  await page.evaluate(() => localStorage.setItem('advisor_theme', 'dark'));
  await page.reload();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOT_DIR, 'exp_dark.png') });
  await browser.close();
})();
