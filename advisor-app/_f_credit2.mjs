import { suite, body, focused } from './_f_lib.mjs';
await suite('credit2', 'credit', [1440], async (pg, t, w) => {
  const sec = txt => pg.locator('h2', { hasText: txt }).locator('xpath=..');
  await t('loan delete on seeded row', async () => {
    const s = sec('הלוואות').first();
    const before = await s.locator('h2').innerText();
    const row = s.locator('[role=button]', { hasText: 'הלוואת רכב' }).first();
    console.log('row count', await s.locator('[role=button]').count(), await row.count());
    await row.getByRole('button', { name: 'מחק' }).click(); await pg.waitForTimeout(800);
    return { before: before.replace(/\n/g, ' '), after: (await s.locator('h2').innerText()).replace(/\n/g, ' '), stillThere: (await body(pg)).includes('הלוואת רכב'), toast: await pg.locator('[role=status],[class*=toast]').allInnerTexts() };
  });
  await t('spitzer to loan', async () => {
    const s = sec('מחשבון שפיצר');
    await s.getByLabel('סכום הלוואה', { exact: true }).fill('100000');
    await s.getByLabel('ריבית שנתית', { exact: true }).fill('5');
    await s.getByLabel('תקופה בחודשים').fill('120');
    await s.getByRole('button', { name: 'חשב', exact: true }).click(); await pg.waitForTimeout(400);
    const h = () => sec('הלוואות').first().locator('h2').innerText();
    const before = await h();
    await s.getByRole('button', { name: /הוסף כהלוואה/ }).click(); await pg.waitForTimeout(900);
    return { before: before.replace(/\n/g, ' '), after: (await h()).replace(/\n/g, ' '), body: (await body(pg)).includes('שפיצר') };
  });
  await t('refinance calc toast', async () => {
    const s = sec('סימולציית מחזור');
    await s.getByLabel('ריבית מוצעת').fill('4');
    await s.getByLabel('תקופה מוצעת').fill('60');
    await s.getByRole('button', { name: 'חשב חיסכון' }).click(); await pg.waitForTimeout(300);
    const txt = await pg.evaluate(() => [...document.querySelectorAll('[class*=oast]')].map(e => e.innerText));
    return { toasts: txt, result: (await s.innerText()).replace(/\s+/g, ' ').slice(0, 600) };
  });
  await pg.screenshot({ path: 'C:/Users/david/AppData/Local/Temp/claude/c--Users-david-projects-ai-budget/19e33a93-7d7d-4c0d-b5c4-94bbdb95a1a8/scratchpad/func2/credit2.png', fullPage: true });
});
