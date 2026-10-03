import { chromium } from 'playwright';
import { C } from './_f_lib.mjs';
const b = await chromium.launch();
for (const nav of ['goals', 'subs', 'credit', 'assets', 'mortgage', 'analysis', 'budget']) {
  const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await pg.goto(`http://localhost:5212/?client=${C}&nav=${nav}`); await pg.waitForTimeout(1000);
  const n = await pg.locator('button:has-text("+")').count();
  console.log('=====', nav, 'add buttons', n);
  for (let i = 0; i < n; i++) {
    const btn = pg.locator('button:has-text("+")').nth(i);
    const label = (await btn.innerText()).replace(/\n/g, ' ');
    if (!(await btn.isVisible())) continue;
    await btn.click().catch(() => {});
    await pg.waitForTimeout(200);
    const info = await pg.evaluate(() => {
      const a = document.activeElement;
      return { focus: a ? (a.tagName + ':' + (a.getAttribute('aria-label') || a.getAttribute('placeholder') || a.type || '')) : null };
    });
    console.log('  click', label, JSON.stringify(info));
  }
  const fields = await pg.evaluate(() => [...document.querySelectorAll('input,select,textarea')].map(e => `${e.tagName.toLowerCase()}[${e.type || ''}] aria=${e.getAttribute('aria-label') || ''} ph=${e.getAttribute('placeholder') || ''}`));
  console.log(fields.join('\n'));
  const btns = await pg.evaluate(() => [...document.querySelectorAll('main button, [class*=content] button')].map(b => (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\n/g, ' ').slice(0, 30)));
  console.log('buttons:', btns.join(' | '));
}
await b.close();
