import { chromium } from 'playwright';
const SHOT = 'C:/Users/david/AppData/Local/Temp/claude/c--Users-david-projects-ai-budget/19e33a93-7d7d-4c0d-b5c4-94bbdb95a1a8/scratchpad/';
const now = new Date();
const y = now.getFullYear(), m = now.getMonth();
const pad = n => String(n).padStart(2, '0');
const cur = `${y}-${pad(m + 1)}`;
const pd = new Date(y, m - 1, 1);
const prev = `${pd.getFullYear()}-${pad(pd.getMonth() + 1)}`;
const cats = ['מזון לבית', 'אוכל בחוץ ובילויים', 'פארם', 'דלק וחניה', 'ביגוד והנעלה', 'תחביבים', 'בריאות', 'תספורת וקוסמטיקה'];
const tx = [];
let id = 1;
cats.forEach((c, i) => { for (let k = 0; k < 3; k++) tx.push({ id: id++, type: 'expense', cat: c, desc: c + ' ' + k, amount: 100 + i * 10 + k, date: `${cur}-01`, recurring: false }); });
tx.push({ id: id++, type: 'expense', cat: 'מזון לבית', desc: 'סופר חודש קודם', amount: 500, date: `${prev}-15`, recurring: false });
const limits = {}; cats.forEach(c => limits[c] = 1000);
const fixed = [{ id: 'דיור', amount: 4000 }, { id: 'חשמל', amount: 400 }, { id: 'הוראת קבע לחסכון', amount: 1000 }, { id: 'ארנונה', amount: 600 }, { id: 'מים וביוב', amount: 150 }, { id: 'גז', amount: 80 }];
const loans = [
  { id: 11, name: 'הלוואת רכב', lender: 'לאומי', monthly: 1200, remaining: 30000, original: 60000, rate: 5, previousMonthly: 1800 },
  { id: 12, name: 'הלוואה ישנה', lender: 'פועלים', monthly: 900, remaining: 20000, original: 40000, rate: 6, closed: true, previousMonthly: 900 },
  { id: 13, name: 'הלוואת משכנתא', lender: 'מזרחי', monthly: 3000, remaining: 500000, original: 700000, rate: 4 },
  { id: 14, name: 'הלוואה לימודים', lender: 'דיסקונט', monthly: 500, remaining: 8000, original: 15000, rate: 3 },
];
const payments = [{ id: 21, name: 'מקרר', total: 12, amount: 300, start: `${cur}-01` }, { id: 22, name: 'ספה סגורה', total: 10, amount: 400, start: `${cur}-01`, closed: true }];
const settings = { name: 'בדיקה', partnerName: '', currency: '₪', savingsGoal: 0, incomeSources: [{ name: 'משכורת', amount: '10000', day: '10' }] };
const seed = { budget_settings: JSON.stringify(settings), budget_tx: JSON.stringify(tx), budget_fixed: JSON.stringify(fixed), budget_limits: JSON.stringify(limits), budget_loans: JSON.stringify(loans), budget_payments: JSON.stringify(payments) };

const errors = [];
const out = {};
async function run(theme) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', msg => { if (msg.type() === 'error') errors.push(`[${theme}] console: ${msg.text()}`); });
  page.on('pageerror', e => errors.push(`[${theme}] pageerror: ${e.message}`));
  await page.addInitScript(([seed, theme]) => {
    if (sessionStorage.getItem('_qaSeeded')) return;
    sessionStorage.setItem('_qaSeeded', '1');
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    localStorage.setItem('auth_skipped', '1');
    localStorage.setItem('budget_onboarded', '1');
    localStorage.setItem('budget_install_dismiss', '1');
    if (theme === 'dark') localStorage.setItem('budget_theme', 'dark');
  }, [seed, theme]);
  await page.goto('http://localhost:8655/index.html');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => authSkip()).catch(() => {});
  await page.waitForFunction(() => getComputedStyle(document.getElementById('authScreen')).visibility === 'hidden');
  await page.waitForTimeout(800);
  const r = out[theme] = {};
  r.isDark = await page.evaluate(() => document.body.classList.contains('dark'));
  const geom = async () => page.evaluate(() => {
    const b = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), vis: getComputedStyle(e).display + '/' + getComputedStyle(e).visibility }; };
    return { nav: b('.bottom-nav'), fab: b('.fab'), toast: b('#toast'), install: b('#installBanner') };
  });
  await page.screenshot({ path: SHOT + `qa_${theme}_dashboard.png` });
  r.dashGeom = await geom();
  r.dashIncome = await page.evaluate(() => document.getElementById('totalIncome')?.textContent);

  await page.evaluate(() => showPage('transactions'));
  await page.waitForTimeout(600);
  r.sections = await page.evaluate(() => [...document.querySelectorAll('#allTxList .section-title')].map(e => e.textContent.trim()));
  r.incomeRows = await page.evaluate(() => [...document.querySelectorAll('#allTxList .exp-row')].map(e => e.querySelector('.exp-name')?.textContent + '|' + e.querySelector('.exp-amt')?.textContent + '|icons:' + e.querySelectorAll('.exp-icon-sm').length).filter(s => s.startsWith('משכורת') || s.includes('בונוס') || s.includes('פרילנס')));
  await page.screenshot({ path: SHOT + `qa_${theme}_tx_top.png` });
  await page.evaluate(() => (()=>{const mm=document.querySelector('main');mm.scrollTop=mm.scrollHeight;})());
  await page.waitForTimeout(400);
  await page.screenshot({ path: SHOT + `qa_${theme}_tx_bottom.png` });
  r.txBottom = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#page-transactions button.exp-add-row, #page-transactions .exp-row')];
    const last = items[items.length - 1]; const lr = last.getBoundingClientRect();
    const nav = document.querySelector('.bottom-nav').getBoundingClientRect();
    const fab = document.querySelector('.fab').getBoundingClientRect();
    return { lastText: last.textContent.trim().slice(0, 30), lastBottom: Math.round(lr.bottom), navTop: Math.round(nav.top), fabTop: Math.round(fab.top), fabVisible: getComputedStyle(document.querySelector('.fab')).display, scrollY: scrollY, docH: document.documentElement.scrollHeight };
  });
  await page.evaluate(() => document.documentElement.style.setProperty('--safe-bottom', '34px'));
  await page.evaluate(() => (()=>{const mm=document.querySelector('main');mm.scrollTop=mm.scrollHeight;})());
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOT + `qa_${theme}_tx_bottom_safe34.png` });
  r.txBottomSafe = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#page-transactions button.exp-add-row, #page-transactions .exp-row')];
    const lr = items[items.length - 1].getBoundingClientRect();
    const nav = document.querySelector('.bottom-nav').getBoundingClientRect();
    const fab = document.querySelector('.fab').getBoundingClientRect();
    return { lastBottom: Math.round(lr.bottom), navTop: Math.round(nav.top), navBottom: Math.round(nav.bottom), fabTop: Math.round(fab.top), fabBottom: Math.round(fab.bottom) };
  });
  await page.evaluate(() => showToast('✓ בדיקת טוסט ארוכה'));
  await page.evaluate(() => document.getElementById('installBanner').classList.add('show'));
  await page.waitForTimeout(400);
  r.geomSafe = await geom();
  await page.screenshot({ path: SHOT + `qa_${theme}_toast_install_safe34.png` });
  await page.evaluate(() => { document.getElementById('installBanner').classList.remove('show'); document.documentElement.style.removeProperty('--safe-bottom'); document.querySelector('main').scrollTop=0; });
  await page.waitForTimeout(2600);
  await page.evaluate(() => showToast('✓ טוסט'));
  await page.waitForTimeout(400);
  r.geom0 = await geom();
  await page.screenshot({ path: SHOT + `qa_${theme}_toast_safe0.png` });
  await page.waitForTimeout(2600);

  if (theme === 'light') {
    await page.evaluate(() => { addIncomeSource(); });
    await page.waitForTimeout(400);
    r.addFields = await page.locator('#promptFields input').count();
    await page.screenshot({ path: SHOT + `qa_light_income_add_popup.png` });
    const ins = page.locator('#promptFields input');
    await ins.nth(0).fill('בונוס'); await ins.nth(1).fill('2000'); await ins.nth(2).fill('15');
    await page.click('#promptOk');
    await page.waitForTimeout(500);
    r.afterAdd = await page.evaluate(() => [userSettings.incomeSources.map(s => s.name + ':' + s.amount), document.getElementById('txPageIncome').textContent, monthlyIncomeFor(currentYear, currentMonth)]);
    await page.evaluate(() => toggleExpGroup('inc:1'));
    await page.waitForTimeout(300);
    r.expandBody = await page.evaluate(() => document.querySelector('#allTxList .exp-row[aria-expanded="true"] + .exp-body')?.textContent);
    await page.screenshot({ path: SHOT + `qa_light_income_expanded.png` });
    await page.evaluate(() => toggleExpGroup('inc:1'));
    await page.evaluate(() => { _expDeleteIncome(1); });
    await page.waitForTimeout(500);
    r.afterDel = await page.evaluate(() => [userSettings.incomeSources.map(s => s.name + ':' + s.amount), monthlyIncomeFor(currentYear, currentMonth)]);
    await page.waitForTimeout(2600);
    r.prevBefore = await page.evaluate(() => { const d = new Date(currentYear, currentMonth - 1, 1); return monthlyIncomeFor(d.getFullYear(), d.getMonth()); });
    await page.evaluate(() => { _expEditIncome(0); });
    await page.waitForTimeout(400);
    r.editPrefill = await page.evaluate(() => [...document.querySelectorAll('#promptFields input')].map(i => i.value));
    await page.screenshot({ path: SHOT + `qa_light_income_edit_popup.png` });
    await page.locator('#promptFields input').nth(1).fill('12000');
    await page.click('#promptOk');
    await page.waitForTimeout(500);
    r.afterEdit = await page.evaluate(() => { const d = new Date(currentYear, currentMonth - 1, 1); return { cur: monthlyIncomeFor(currentYear, currentMonth), prev: monthlyIncomeFor(d.getFullYear(), d.getMonth()), txPageIncome: document.getElementById('txPageIncome').textContent, hist: userSettings.incomeHistory }; });
    await page.evaluate(() => shiftMonth(-1));
    await page.waitForTimeout(600);
    r.pastMonth = await page.evaluate(() => ({ label: document.getElementById('headerMonthLabel')?.textContent, sections: [...document.querySelectorAll('#allTxList .section-title')].map(e => e.textContent.trim()), incRows: [...document.querySelectorAll('#allTxList .exp-row')].filter(e => e.querySelector('.exp-name')?.textContent === 'משכורת').map(e => e.querySelector('.exp-amt').textContent + '|icons:' + e.querySelectorAll('.exp-icon-sm').length), addIncBtn: [...document.querySelectorAll('#allTxList .exp-add-row')].map(b => b.textContent.trim()), txPageIncome: document.getElementById('txPageIncome').textContent }));
    await page.screenshot({ path: SHOT + `qa_light_past_month_tx.png` });
    await page.evaluate(() => showPage('dashboard'));
    await page.waitForTimeout(800);
    r.pastDash = await page.evaluate(() => document.getElementById('totalIncome')?.textContent);
    await page.screenshot({ path: SHOT + `qa_light_past_month_dash.png` });
    await page.evaluate(() => shiftMonth(1));
    await page.waitForTimeout(800);
    r.curDash = await page.evaluate(() => document.getElementById('totalIncome')?.textContent);
    await page.evaluate(() => showPage('transactions'));
    await page.waitForTimeout(400);
    for (const f of ['fixed', 'variable', 'all']) {
      await page.click(`#txFilterChips [data-filter=${f}]`);
      await page.waitForTimeout(300);
      r['filter_' + f] = await page.evaluate(() => [...document.querySelectorAll('#allTxList .section-title')].map(e => e.textContent.trim()));
      if (f !== 'all') await page.screenshot({ path: SHOT + `qa_light_filter_${f}.png` });
    }
    await page.reload(); await page.waitForLoadState('networkidle');
    await page.evaluate(() => authSkip()).catch(() => {});
    await page.waitForTimeout(800);
    r.afterReload = await page.evaluate(() => { const d = new Date(currentYear, currentMonth - 1, 1); return { cur: monthlyIncomeFor(currentYear, currentMonth), prev: monthlyIncomeFor(d.getFullYear(), d.getMonth()) }; });
  }

  await page.evaluate(() => showPage('loans'));
  await page.waitForTimeout(600);
  r.loans = await page.evaluate(() => ({ total: document.getElementById('loansTotalDisplay')?.textContent, monthly: document.getElementById('loansMonthlyDisplay')?.textContent, cards: [...document.querySelectorAll('#loansList .loan-card .loan-name')].map(e => e.textContent), mahzor: [...document.querySelectorAll('#loansList .loan-card')].map(c => [...c.querySelectorAll('div')].find(d => d.textContent.startsWith('מחזור:'))?.textContent).filter(Boolean), history: document.getElementById('loansHistorySection')?.textContent }));
  await page.screenshot({ path: SHOT + `qa_${theme}_loans_top.png` });
  await page.evaluate(() => { _advisorOverdraft = { balance: 15000, rate: 9 }; renderLoans(); });
  await page.evaluate(() => { const d = document.querySelector('#loansHistorySection details'); if (d) d.open = true; });
  await page.waitForTimeout(300);
  r.overdraft = await page.evaluate(() => document.getElementById('overdraftCard')?.textContent);
  await page.screenshot({ path: SHOT + `qa_${theme}_loans_overdraft.png` });
  await page.evaluate(() => (()=>{const mm=document.querySelector('main');mm.scrollTop=mm.scrollHeight;})());
  await page.waitForTimeout(400);
  await page.screenshot({ path: SHOT + `qa_${theme}_loans_bottom.png` });
  r.loansBottom = await page.evaluate(() => {
    const pg = document.querySelector('.page.active');
    const els = [...pg.querySelectorAll('*')].filter(e => e.offsetParent && e.children.length === 0 && e.getBoundingClientRect().height > 0);
    const last = els.reduce((a, e) => e.getBoundingClientRect().bottom > a.getBoundingClientRect().bottom ? e : a);
    const nav = document.querySelector('.bottom-nav').getBoundingClientRect();
    const fab = document.querySelector('.fab').getBoundingClientRect();
    return { last: last.textContent.trim().slice(0, 40), lastBottom: Math.round(last.getBoundingClientRect().bottom), navTop: Math.round(nav.top), fabTop: Math.round(fab.top), fabDisp: getComputedStyle(document.querySelector('.fab')).display };
  });
  await browser.close();
}
await run('light');
await run('dark');
console.log(JSON.stringify(out, null, 1));
console.log('ERRORS', JSON.stringify(errors, null, 1));
