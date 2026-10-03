import { chromium } from 'playwright';
export const C = '11111111-1111-1111-1111-111111111111';
export const SHOTS = 'C:/Users/david/AppData/Local/Temp/claude/c--Users-david-projects-ai-budget/19e33a93-7d7d-4c0d-b5c4-94bbdb95a1a8/scratchpad/func2/';
export async function suite(name, nav, widths, fn) {
  const b = await chromium.launch();
  for (const w of widths) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, acceptDownloads: true });
    const pg = await ctx.newPage();
    const errs = [];
    pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 200)); });
    pg.on('pageerror', e => errs.push('PAGEERR ' + e.message));
    await pg.goto(`http://localhost:5212/?client=${C}&nav=${nav}`);
    await pg.waitForTimeout(1000);
    pg.setDefaultTimeout(3000);
    const t = async (label, f) => {
      try {
        const r = await f();
        console.log(`[${name}@${w}] ${r === false ? 'FAIL' : 'PASS'} ${label}` + (r && r !== true ? ' => ' + JSON.stringify(r) : ''));
      } catch (e) {
        console.log(`[${name}@${w}] FAIL ${label} :: ${e.message.split('\n')[0].slice(0, 220)}`);
        await pg.screenshot({ path: SHOTS + `${name}_${w}_${label.replace(/[^\w]+/g, '_').slice(0, 30)}.png` }).catch(() => {});
      }
    };
    await fn(pg, t, w);
    await pg.screenshot({ path: SHOTS + `${name}_${w}.png`, fullPage: true }).catch(() => {});
    console.log(`[${name}@${w}] console errors:`, JSON.stringify(errs));
    await ctx.close();
  }
  await b.close();
}
export const body = pg => pg.locator('body').innerText();
export const focused = pg => pg.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName);
