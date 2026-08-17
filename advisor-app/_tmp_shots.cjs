const { chromium } = require('playwright');
const path = require('path');
const seed = require('./_tmp_seed.cjs');

const SCRATCH = path.dirname(__filename);

(async () => {
  const browser = await chromium.launch();
  const args = process.argv.slice(2);
  const dark = args.includes('--dark');
  const width = args.includes('--mobile') ? 390 : 1280;
  const height = args.includes('--mobile') ? 844 : 900;
  const label = (dark ? 'dark' : 'light') + (args.includes('--mobile') ? '-mobile' : '-desktop');

  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();

  await page.addInitScript((seedData) => {
    for (const [k, v] of Object.entries(seedData)) localStorage.setItem(k, v);
    localStorage.setItem('auth_skipped', '1');
    localStorage.setItem('budget_onboarded', '1');
  }, seed);

  await page.goto('http://localhost:8642/index.html');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => { try { authSkip(); } catch(e){} });
  await page.waitForSelector('#authScreen', { state: 'hidden', timeout: 15000 }).catch(()=>{});

  if (dark) {
    await page.evaluate(() => { document.body.classList.add('dark'); localStorage.setItem('budget_theme','dark'); });
    await page.waitForTimeout(300);
  }

  const tabs = [
    { name: 'ראשי', sel: null },
  ];

  // Discover nav buttons
  const navInfo = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[data-tab], .nav-item, nav button, nav a'));
    return items.map(el => ({ text: el.textContent.trim(), tab: el.dataset ? el.dataset.tab : null }));
  });
  console.log('NAV:', JSON.stringify(navInfo));

  await page.screenshot({ path: `C:/Users/david/AppData/Local/Temp/claude/c--Users-david-projects-ai-budget/ba505acc-4a86-40db-bcd5-b2516cb7229e/scratchpad/shot-${label}-dashboard.png`, fullPage: true });

  const tabNames = ['הוצאות', 'תקציב', 'ניתוח', 'הגדרות'];
  for (const t of tabNames) {
    try {
      const el = await page.locator(`text="${t}"`).first();
      await el.click({ timeout: 5000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `C:/Users/david/AppData/Local/Temp/claude/c--Users-david-projects-ai-budget/ba505acc-4a86-40db-bcd5-b2516cb7229e/scratchpad/shot-${label}-${t}.png`, fullPage: true });
    } catch (e) {
      console.log('FAILED tab', t, e.message);
    }
  }

  await browser.close();
})();
