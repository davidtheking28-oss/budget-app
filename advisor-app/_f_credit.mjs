import { suite, body, focused } from './_f_lib.mjs';
await suite('credit', 'credit', [1440, 390], async (pg, t, w) => {
  const sec = txt => pg.locator('h2', { hasText: txt }).locator('xpath=..');
  await t('sections list', async () => (await pg.locator('h2').allInnerTexts()).map(x => x.replace(/\n/g, ' ')));
  await t('loan: open add + focus', async () => {
    await sec('הלוואות').first().getByRole('button', { name: /הוסף הלוואה/ }).click();
    return { focus: await focused(pg) };
  });
  await t('loan: add', async () => {
    const s = sec('הלוואות').first();
    await s.getByLabel('שם ההלוואה', { exact: true }).fill('הלוואת QA');
    await s.getByLabel('גורם מלווה').fill('בנק QA');
    await s.getByLabel('החזר חודשי להלוואה').fill('800');
    await s.getByLabel('יתרת ההלוואה').fill('20000');
    await s.getByLabel('סכום ההלוואה המקורי').fill('40000');
    await s.getByLabel('ריבית שנתית באחוזים').fill('6');
    await s.getByRole('button', { name: 'הוסף הלוואה', exact: true }).click(); await pg.waitForTimeout(700);
    return (await body(pg)).includes('הלוואת QA');
  });
  await t('loan: edit + save', async () => {
    const s = sec('הלוואות').first();
    await s.locator('[role=button]', { hasText: 'הלוואת QA' }).first().click(); await pg.waitForTimeout(200);
    await s.getByLabel('שם ההלוואה', { exact: true }).fill('הלוואת QA2');
    await s.getByRole('button', { name: 'שמור', exact: true }).click(); await pg.waitForTimeout(700);
    return (await body(pg)).includes('הלוואת QA2');
  });
  await t('loan: edit cancel (ביטול) exists & works', async () => {
    const s = sec('הלוואות').first();
    await s.locator('[role=button]', { hasText: 'הלוואת QA2' }).first().click(); await pg.waitForTimeout(200);
    await s.getByRole('button', { name: 'ביטול' }).click(); await pg.waitForTimeout(200);
    return true;
  });
  await t('loan: delete', async () => {
    const s = sec('הלוואות').first();
    const row = s.locator('[role=button]', { hasText: 'הלוואת QA2' }).first();
    await row.getByRole('button', { name: 'מחק' }).click(); await pg.waitForTimeout(600);
    return !(await body(pg)).includes('הלוואת QA2');
  });
  await t('payment plan: open + add', async () => {
    const s = sec('תשלומים בכרטיס');
    await s.getByRole('button', { name: /הוסף תשלומים/ }).click();
    const f = await focused(pg);
    await s.getByLabel('שם העסקה').fill('עסקת QA');
    await s.getByLabel('סך כל התשלומים').fill('12');
    await s.getByLabel('תשלומים שנותרו').fill('8');
    await s.getByLabel('סכום לתשלום').fill('250');
    await s.getByRole('button', { name: 'הוסף תשלום', exact: true }).click(); await pg.waitForTimeout(700);
    return { focus: f, added: (await body(pg)).includes('עסקת QA') };
  });
  await t('payment plan: edit + save', async () => {
    const s = sec('תשלומים בכרטיס');
    await s.locator('[role=button]', { hasText: 'עסקת QA' }).first().click(); await pg.waitForTimeout(200);
    await s.getByLabel('שם העסקה').fill('עסקת QA2');
    await s.getByRole('button', { name: 'שמור', exact: true }).click(); await pg.waitForTimeout(700);
    return (await body(pg)).includes('עסקת QA2');
  });
  await t('payment plan: delete', async () => {
    const s = sec('תשלומים בכרטיס');
    const row = s.locator('[role=button]', { hasText: 'עסקת QA2' }).first();
    await row.getByRole('button', { name: 'מחק' }).click(); await pg.waitForTimeout(600);
    return !(await body(pg)).includes('עסקת QA2');
  });
  await t('spitzer: calc', async () => {
    const s = sec('מחשבון שפיצר');
    await s.getByLabel('סכום הלוואה', { exact: true }).fill('100000');
    await s.getByLabel('ריבית שנתית', { exact: true }).fill('5');
    await s.getByLabel('תקופה בחודשים').fill('120');
    await s.getByRole('button', { name: 'חשב', exact: true }).click(); await pg.waitForTimeout(400);
    const txt = await s.innerText();
    return txt.match(/החזר חודשי:.*/)?.[0];
  });
  await t('spitzer: + הוסף כהלוואה', async () => {
    const s = sec('מחשבון שפיצר');
    const before = (await sec('הלוואות').first().innerText()).length;
    await s.getByRole('button', { name: /הוסף כהלוואה/ }).click(); await pg.waitForTimeout(700);
    const after = (await sec('הלוואות').first().innerText()).length;
    return { before, after, changed: before !== after };
  });
  await t('refinance: calc', async () => {
    const s = sec('סימולציית מחזור');
    await s.getByLabel('ריבית מוצעת').fill('4');
    await s.getByLabel('תקופה מוצעת').fill('60');
    await s.getByRole('button', { name: 'חשב חיסכון' }).click(); await pg.waitForTimeout(500);
    return (await s.innerText()).replace(/\s+/g, ' ').slice(0, 400);
  });
  await t('refinance: execute (בצע מחזור)', async () => {
    const s = sec('סימולציית מחזור');
    const btn = s.getByRole('button', { name: 'בצע מחזור' });
    if (!(await btn.count())) return 'no commit button (savings may be negative/absent)';
    await btn.click(); await pg.waitForTimeout(1200);
    return { hasHistory: (await body(pg)).includes('היסטוריית מחזורים') };
  });
  await t('overdraft: set', async () => {
    const s = sec('סימולציית מחזור');
    await s.getByRole('button', { name: /יתרת מינוס/ }).click();
    await s.getByLabel('יתרת מינוס בבנק').fill('5000');
    await s.getByLabel('ריבית שנתית על המינוס').fill('11');
    await s.getByRole('button', { name: 'שמור', exact: true }).click(); await pg.waitForTimeout(700);
    return (await s.innerText()).includes('5,000');
  });
  await t('keyboard Enter on dashed add loan', async () => {
    await pg.reload(); await pg.waitForTimeout(1000);
    const b = sec('הלוואות').first().getByRole('button', { name: /הוסף הלוואה/ }); await b.focus(); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200);
    return { open: await pg.getByLabel('שם ההלוואה', { exact: true }).isVisible(), focus: await focused(pg) };
  });
});
