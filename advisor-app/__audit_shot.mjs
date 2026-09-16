import { chromium } from 'playwright';

const CLIENT_A = '11111111-1111-1111-1111-111111111111';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
page.on('console', m => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()); });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

await page.goto(`http://localhost:5199/?client=${CLIENT_A}&nav=budget`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);

// click through to step "סיכום" (index 3) in the stepper
const dots = page.locator('[class*="stepDot"]');
const count = await dots.count();
console.log('stepDot count', count);
if (count >= 4) {
  await dots.nth(3).click();
  await page.waitForTimeout(600);
}

await page.screenshot({ path: 'C:/Users/david/AppData/Local/Temp/claude/c--Users-david-projects-ai-budget/1ec01880-8bc4-4b83-bc00-f8773e9fcc9d/scratchpad/step3.png', fullPage: true });
console.log('done');
await browser.close();
