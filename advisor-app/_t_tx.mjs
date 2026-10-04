import { chromium } from 'playwright';
const OUT = 'C:/Users/david/AppData/Local/Temp/claude/c--Users-david-projects-ai-budget/19e33a93-7d7d-4c0d-b5c4-94bbdb95a1a8/scratchpad/t/';
import fs from 'fs'; fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:5232/?client=11111111-1111-1111-1111-111111111111&nav=budget';
const b = await chromium.launch();
const errs = [];
for (const [w, h] of [[1440, 900], [390, 844]]) for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(t => localStorage.setItem('advisor_theme', t), theme);
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(w + theme + ' ' + e.message));
  await p.goto(URL); await p.getByText('עסקאות החודש').waitFor();
  const card = p.locator('section', { hasText: 'עסקאות החודש' });
  const count = async () => card.locator('button[aria-label="מחק עסקה"]').count();
  const n0 = await count();
  const hero = async () => (await p.locator('body').innerText()).match(/פנוי החודש[\s\S]{0,30}|חריגה[\s\S]{0,30}/)?.[0].replace(/\n/g, ' ');
  const h0 = await hero();
  await card.scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}${w}-${theme}-list.png`, fullPage: true });
  const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (w === 1440 && theme === 'light') {
    await card.getByRole('button', { name: 'הוצאות' }).click();
    console.log('expense filter rows', await count(), 'income sign present', (await card.innerText()).includes('+'));
    await card.getByRole('button', { name: 'הכנסות' }).click();
    console.log('income filter rows', await count(), 'plus', (await card.innerText()).includes('+'));
    await card.getByRole('button', { name: 'הכול' }).click();
    await card.locator('button[aria-label="מחק עסקה"]').first().click();
    await p.waitForTimeout(500);
    console.log('after delete', n0, '->', await count(), 'hero', h0, '->', await hero());
    await p.screenshot({ path: `${OUT}toast.png` });
    await p.getByRole('button', { name: 'בטל', exact: true }).click();
    await p.waitForTimeout(500);
    console.log('after undo', await count(), await hero());
    await card.locator('button[aria-label="ערוך עסקה"]').first().click();
    await p.screenshot({ path: `${OUT}${w}-edit.png`, fullPage: true });
    await card.getByLabel('סכום').fill('777');
    await card.getByLabel('תיאור').fill('נערך בבדיקה');
    await card.getByRole('button', { name: 'שמור' }).click();
    await p.waitForTimeout(500);
    console.log('edited visible', (await card.innerText()).includes('נערך בבדיקה'), await hero());
    await card.locator('button[aria-label="מחק עסקה"]').last().click();
    await p.waitForTimeout(500);
    console.log('deleted last; count', await count());
    await p.getByRole('link', { name: /דשבורד|סקירה/ }).first().click().catch(() => {});
    console.log('waiting stale'); await p.waitForTimeout(31000);
    await p.goto(URL); await p.getByText('עסקאות החודש').waitFor();
    console.log('after reload-ish count', await card.locator('button[aria-label="מחק עסקה"]').count());
    console.log('edited persisted', (await card.innerText()).includes('נערך בבדיקה'));
  }
  if (w === 390) {
    await card.locator('button[aria-label="ערוך עסקה"]').first().click();
    await p.screenshot({ path: `${OUT}390-${theme}-edit.png`, fullPage: true });
  }
  console.log(w, theme, 'rows', n0, 'overflow', ov);
  await ctx.close();
}
console.log('errors', errs);
await b.close();
