import { suite, body, focused } from './_f_lib.mjs';
import { chromium } from 'playwright';
for (const nav of ['dashboard', 'budget', 'analysis', 'mortgage']) {
  await suite('month-' + nav, nav, [1440, 390], async (pg, t, w) => {
    const lbl = async () => (await pg.locator('button:has-text("20")').filter({ hasText: /^\S+ 20\d\d$/ }).first().innerText());
    await t('month label initial', async () => lbl());
    await t('next -> +1 month, url m updated, disabled reset becomes enabled', async () => {
      const a = await lbl();
      await pg.getByRole('button', { name: 'חודש הבא' }).click(); await pg.waitForTimeout(500);
      const b = await lbl(); const url = pg.url();
      const resetEnabled = await pg.getByRole('button', { name: 'חזרה לחודש הנוכחי' }).isEnabled();
      return { a, b, m: /m=(\d+)/.exec(url)?.[1], resetEnabled };
    });
    await t('prev x2 -> -1 month', async () => {
      await pg.getByRole('button', { name: 'חודש קודם' }).click(); await pg.getByRole('button', { name: 'חודש קודם' }).click(); await pg.waitForTimeout(500);
      return await lbl();
    });
    await t('reset by clicking label', async () => {
      await pg.getByRole('button', { name: 'חזרה לחודש הנוכחי' }).click(); await pg.waitForTimeout(400);
      return { lbl: await lbl(), resetDisabled: await pg.locator('button:has-text("אוקטובר 2026")').first().isDisabled() };
    });
    await t('year rollover (prev x10 -> Dec 2025?)', async () => {
      for (let i = 0; i < 10; i++) await pg.getByRole('button', { name: 'חודש קודם' }).click();
      await pg.waitForTimeout(500);
      return await lbl();
    });
    await t('content changes with month (page not blank)', async () => (await body(pg)).length > 200);
  });
}
await suite('mort2', 'mortgage', [1440], async (pg, t) => {
  await t('placeholder buttons', async () => {
    await pg.getByRole('button', { name: 'עריכה' }).first().click(); await pg.waitForTimeout(300);
    const b = pg.locator('button[aria-disabled=true]');
    const n = await b.count();
    if (!n) return 'none';
    await b.first().click(); await pg.waitForTimeout(300);
    return { n, toast: (await body(pg)).includes('יתווסף בהמשך') };
  });
});
