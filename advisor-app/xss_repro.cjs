const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('dialog', async d => {
    console.log('DIALOG FIRED:', d.message());
    await d.dismiss();
  });

  const payload = '<img src=x onerror="window.__xss=1">';
  const seed = {
    budget_tx: JSON.stringify([{id:1,type:'expense',cat:payload,desc:'test',amount:50,date:'2026-08-05',recurring:false}]),
    budget_limits: JSON.stringify({[payload]: 200}),
    budget_settings: JSON.stringify({name:'',partnerName:'',currency:'₪',savingsGoal:0,incomeSources:[],customCats:[payload]})
  };

  await page.addInitScript(seed => {
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    localStorage.setItem('auth_skipped', '1');
    localStorage.setItem('budget_onboarded', '1');
  }, seed);

  await page.goto('http://localhost:8642/index.html');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => { if (typeof authSkip === 'function') authSkip(); }).catch(() => {});
  await page.waitForSelector('#authScreen', { state: 'hidden', timeout: 10000 }).catch(()=>{});

  await page.evaluate(() => { if (typeof showPage === 'function') showPage('budget', document.getElementById('nav-budget')); });
  await page.waitForTimeout(1000);

  const fired = await page.evaluate(() => window.__xss === 1);
  console.log('XSS FIRED:', fired);

  const html = await page.evaluate(() => document.getElementById('budgetCatDetail')?.innerHTML || 'NOT FOUND');
  console.log('budgetCatDetail HTML snippet:', html.slice(0, 400));

  await browser.close();
})();
