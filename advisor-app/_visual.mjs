import { chromium } from 'playwright';
const OUT = 'C:/Users/david/AppData/Local/Temp/claude/c--Users-david-projects-ai-budget/19e33a93-7d7d-4c0d-b5c4-94bbdb95a1a8/scratchpad/agentvis/';
const NAVS = ['dashboard','crm','mapping','budget','analysis','goals','subs','credit','assets','mortgage'];
const VPS = { d: { width: 1400, height: 900 }, m: { width: 390, height: 844 } };
const browser = await chromium.launch();
const results = [];
for (const theme of ['light','dark']) for (const [vk, vp] of Object.entries(VPS)) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  await ctx.addInitScript(t => localStorage.setItem('advisor_theme', t), theme);
  const page = await ctx.newPage();
  for (const nav of NAVS) {
    const errs = [];
    page.removeAllListeners('console'); page.removeAllListeners('pageerror');
    page.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errs.push(m.type()+': '+m.text().slice(0,200)); });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await page.goto(`http://localhost:5199/?client=11111111-1111-1111-1111-111111111111&nav=${nav}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const info = await page.evaluate(() => {
      const de = document.documentElement;
      const hero = document.querySelector('section[class*="hero"]');
      const h = hero ? { text: hero.innerText.replace(/\n+/g,' | '), rect: hero.getBoundingClientRect().toJSON(),
        next: (() => { const n = hero.nextElementSibling; if (!n) return null; const r = n.getBoundingClientRect(); return { gap: Math.round(r.top - hero.getBoundingClientRect().bottom), cls: n.className.toString().slice(0,60) }; })(),
        prevGap: (() => { const p = hero.previousElementSibling; if (!p) return null; return { gap: Math.round(hero.getBoundingClientRect().top - p.getBoundingClientRect().bottom), cls: p.className.toString().slice(0,60)}; })(),
        parentCls: hero.parentElement.className.toString().slice(0,80),
        overflowKids: [...hero.querySelectorAll('*')].filter(e => e.scrollWidth > e.clientWidth + 1 && e.children.length===0).map(e => e.className + ':' + e.innerText).slice(0,5)
      } : null;
      const wide = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width>0 && (r.right > innerWidth + 1 || r.left < -1); }).filter(e => { let p=e.parentElement; while(p){ const s=getComputedStyle(p); if (/(auto|scroll|hidden)/.test(s.overflowX)) return false; p=p.parentElement;} return true; }).map(e => e.tagName + '.' + e.className.toString().slice(0,40)).slice(0,6);
      return { theme: de.getAttribute('data-theme'), sw: de.scrollWidth, cw: de.clientWidth, heroCount: document.querySelectorAll('section[class*="hero"]').length, hero: h, wide };
    });
    const f = `${nav}-${vk}-${theme}.png`;
    await page.screenshot({ path: OUT + f, fullPage: vk === 'm' });
    if (hero = await page.$('section[class*="hero"]')) await hero.screenshot({ path: OUT + 'hero-' + f });
    results.push({ f, errs, ...info });
  }
  await ctx.close();
}
var hero;
// month nav on dashboard
const ctx = await browser.newContext({ viewport: VPS.d });
const page = await ctx.newPage();
await page.goto('http://localhost:5199/?client=11111111-1111-1111-1111-111111111111&nav=dashboard', { waitUntil: 'networkidle' });
for (const [lbl, n] of [['prev', 3], ['next', 6]]) {
  for (let i = 0; i < n; i++) { await page.click(`button[aria-label="${lbl === 'prev' ? 'חודש קודם' : 'חודש הבא'}"]`); await page.waitForTimeout(250); }
  const t = await page.evaluate(() => document.querySelector('section[class*="hero"]')?.innerText.replace(/\n+/g,' | '));
  await page.screenshot({ path: OUT + `dashboard-month-${lbl}.png` });
  results.push({ f: `dashboard-month-${lbl}.png`, heroText: t });
}
console.log(JSON.stringify(results, null, 1));
await browser.close();
