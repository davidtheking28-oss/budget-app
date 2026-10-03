import { suite, body, focused } from './_f_lib.mjs';
await suite('credit3', 'credit', [1440, 390], async (pg, t, w) => {
  const sec = txt => pg.locator('h2', { hasText: txt }).locator('xpath=..');
  await t('spitzer -> add as loan: form visible & prefilled?', async () => {
    const s = sec('מחשבון שפיצר');
    await s.getByLabel('סכום הלוואה', { exact: true }).fill('100000');
    await s.getByLabel('ריבית שנתית', { exact: true }).fill('5');
    await s.getByLabel('תקופה בחודשים').fill('120');
    await s.getByRole('button', { name: 'חשב', exact: true }).click(); await pg.waitForTimeout(300);
    await s.getByRole('button', { name: /הוסף כהלוואה/ }).click(); await pg.waitForTimeout(600);
    const formVisible = await pg.getByLabel('שם ההלוואה', { exact: true }).isVisible().catch(() => false);
    const addBtnVisible = await pg.getByRole('button', { name: /הוסף הלוואה/ }).first().isVisible();
    const scrollY = await pg.evaluate(() => scrollY);
    return { formVisible, dashedBtnStillShown: addBtnVisible, scrollY, val: formVisible ? await pg.getByLabel('שם ההלוואה', { exact: true }).inputValue() : null };
  });
  await t('spitzer: manual open of add form shows prefilled values (hidden state leak)', async () => {
    await pg.getByRole('button', { name: /הוסף הלוואה/ }).first().click().catch(() => {});
    return await pg.getByLabel('שם ההלוואה', { exact: true }).inputValue().catch(() => null);
  });
  await t('refinance: select items + calc + savings rows', async () => {
    const s = sec('סימולציית מחזור');
    await s.getByLabel('שם ההלוואה החדשה').fill('מאוחדת QA');
    await s.getByLabel('ריבית מוצעת').fill('4');
    await s.getByLabel('תקופה מוצעת').fill('60');
    await s.locator('input[type=checkbox]').first().check();
    await s.locator('input[type=checkbox]').nth(1).check();
    await s.getByRole('button', { name: 'חשב חיסכון' }).click(); await pg.waitForTimeout(500);
    return (await s.locator('tfoot').innerText().catch(() => 'no tfoot')).replace(/\s+/g, ' ');
  });
  await t('refinance: commit', async () => {
    const s = sec('סימולציית מחזור');
    const loansBefore = (await sec('הלוואות').first().locator('h2').innerText()).replace(/\n/g, ' ');
    await s.getByRole('button', { name: 'בצע מחזור' }).click(); await pg.waitForTimeout(1500);
    return { loansBefore, loansAfter: (await sec('הלוואות').first().locator('h2').innerText()).replace(/\n/g, ' '), history: (await body(pg)).includes('היסטוריית מחזורים'), newLoan: (await body(pg)).includes('מאוחדת QA') };
  });
  await t('toast duplicates in DOM?', async () => pg.evaluate(() => [...document.querySelectorAll('[class*=oast]')].map(e => e.className.slice(0, 40) + '|' + e.innerText.slice(0, 30))));
});
