const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 320, height: 700 } });
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('pageerror: ' + err.message));

  const longCat = 'קטגוריהמותאמתאישיתעםשםארוךמאודללארווחיםלבדיקתגלישה';
  await page.addInitScript(({longCat}) => {
    localStorage.setItem('budget_tx', JSON.stringify([
      {id:1, type:'expense', cat:longCat, desc:'test', amount:120, date:new Date().toISOString().slice(0,7)+'-15', fx:false}
    ]));
    localStorage.setItem('budget_goals','[]');
    localStorage.setItem('budget_subs','[]');
    localStorage.setItem('budget_limits','{}');
    localStorage.setItem('budget_fixed','[]');
    localStorage.setItem('budget_settings', JSON.stringify({name:'',partnerName:'',currency:'₪',savingsGoal:0,incomeSources:[],customCats:[longCat]}));
    localStorage.setItem('auth_skipped','1');
    localStorage.setItem('budget_onboarded','1');
  }, {longCat});

  await page.goto('http://localhost:8644/index.html');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => { try { authSkip(); } catch(e){} });
  await page.waitForFunction(() => {
    const el = document.getElementById('authScreen');
    return el && getComputedStyle(el).visibility === 'hidden';
  }, { timeout: 15000 });

  await page.evaluate(() => showPage('transactions'));
  await page.waitForTimeout(600);

  const clipping = await page.evaluate(() => {
    const icons = Array.from(document.querySelectorAll('.exp-icon-sm'));
    return icons.map(el => {
      const r = el.getBoundingClientRect();
      return { x: r.x, width: r.width, right: r.x + r.width, offscreen: (r.x < 0 || r.x + r.width > 320) };
    });
  });
  console.log('exp-icon-sm rects:', JSON.stringify(clipping, null, 2));

  await page.screenshot({ path: 'C:/Users/david/AppData/Local/Temp/claude/c--Users-david-projects-ai-budget/ba505acc-4a86-40db-bcd5-b2516cb7229e/scratchpad/fix-budget/clip-320.png', fullPage: true });

  console.log('console errors:', consoleErrors.filter(e=>!e.includes('vibrate')));
  await browser.close();
})();
