import { suite, body, focused } from './_f_lib.mjs';
await suite('assets', 'assets', [1440, 390], async (pg, t, w) => {
  const card = txt => pg.locator('h2', { hasText: new RegExp('^' + txt + '$') }).locator('xpath=..');
  await t('asset: open+focus', async () => { await card('נכסים').getByRole('button', { name: /הוסף נכס/ }).click(); return await focused(pg); });
  await t('asset: add', async () => {
    const c = card('נכסים');
    await c.getByLabel('שם הנכס').fill('נכס QA'); await c.getByLabel('סכום הנכס').fill('12345');
    await c.getByRole('button', { name: 'הוסף', exact: true }).click(); await pg.waitForTimeout(600);
    return (await c.innerText()).includes('נכס QA');
  });
  await t('asset: add via Enter in amount field', async () => {
    const c = card('נכסים');
    await c.getByLabel('שם הנכס').fill('נכס QA2'); await c.getByLabel('סכום הנכס').fill('100'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(600);
    return (await c.innerText()).includes('נכס QA2');
  });
  await t('asset: delete both', async () => {
    const c = card('נכסים');
    for (const n of ['נכס QA2', 'נכס QA']) { await c.locator('tr', { hasText: n }).getByRole('button', { name: 'מחק' }).click(); await pg.waitForTimeout(500); }
    return !(await c.innerText()).includes('נכס QA');
  });
  await t('liability: open+focus', async () => { await card('התחייבויות').getByRole('button', { name: /הוסף התחייבות/ }).click(); return await focused(pg); });
  await t('liability: add', async () => {
    const c = card('התחייבויות');
    await c.getByLabel('שם ההתחייבות').fill('התחייבות QA'); await c.getByLabel('יתרת ההתחייבות').fill('5000'); await c.getByLabel('החזר חודשי להתחייבות').fill('200');
    await c.getByRole('button', { name: 'הוסף', exact: true }).click(); await pg.waitForTimeout(600);
    return (await c.innerText()).includes('התחייבות QA');
  });
  await t('liability: delete', async () => {
    const c = card('התחייבויות');
    await c.locator('tr', { hasText: 'התחייבות QA' }).getByRole('button', { name: 'מחק' }).click(); await pg.waitForTimeout(500);
    return !(await c.innerText()).includes('התחייבות QA');
  });
  await t('hero net worth present', async () => (await body(pg)).includes('שווי נקי'));
  await t('keyboard Space on dashed add', async () => {
    await pg.reload(); await pg.waitForTimeout(1000);
    const b = card('נכסים').getByRole('button', { name: /הוסף נכס/ }); await b.focus(); await pg.keyboard.press('Space'); await pg.waitForTimeout(200);
    return { open: await pg.getByLabel('שם הנכס').isVisible(), focus: await focused(pg) };
  });
});
await suite('mortgage', 'mortgage', [1440, 390], async (pg, t, w) => {
  const edits = () => pg.getByRole('button', { name: /^(עריכה|סגור)$/ });
  await t('tables/sections render', async () => ({ h2: (await pg.locator('h2').allInnerTexts()).map(x => x.replace(/\n/g, ' ')), tables: await pg.locator('table').count() }));
  await t('month nav: next/prev/reset', async () => {
    const lab = () => pg.locator('[class*=MonthNav], [class*=monthNav]').first().innerText().catch(() => '');
    const cur = pg.getByRole('button', { name: /^(אוקטובר|נובמבר|דצמבר|ינואר|ספטמבר) 20\d\d$/ });
    const before = await cur.first().innerText();
    await pg.getByRole('button', { name: 'חודש הבא' }).first().click(); await pg.waitForTimeout(400);
    const next = (await pg.getByRole('button', { name: /^\S+ 20\d\d$/ }).allInnerTexts()).filter(x => /20\d\d/.test(x))[0];
    await pg.getByRole('button', { name: 'חודש קודם' }).first().click(); await pg.waitForTimeout(200);
    await pg.getByRole('button', { name: 'חודש קודם' }).first().click(); await pg.waitForTimeout(300);
    const prev = (await pg.getByRole('button', { name: /^\S+ 20\d\d$/ }).allInnerTexts())[0];
    await pg.getByRole('button', { name: new RegExp('^' + prev + '$') }).click().catch(() => {});
    await pg.waitForTimeout(300);
    const reset = (await pg.getByRole('button', { name: /^\S+ 20\d\d$/ }).allInnerTexts())[0];
    return { before, next, prev, reset, url: pg.url().replace(/.*\?/, '') };
  });
  await t('track: open editor (עריכה)', async () => {
    await edits().first().click(); await pg.waitForTimeout(200);
    return { fields: await pg.getByLabel('סכום המסלול').count(), btnText: await edits().first().innerText(), expanded: await edits().first().getAttribute('aria-expanded') };
  });
  await t('track: edit amount + years + rate recalcs summary', async () => {
    const before = (await pg.locator('table').first().innerText()).replace(/\s+/g, ' ');
    await pg.getByLabel('סכום המסלול').first().fill('999999');
    await pg.getByLabel('תקופה בשנים').first().fill('20');
    await pg.waitForTimeout(300);
    const after = (await pg.locator('table').first().innerText()).replace(/\s+/g, ' ');
    return { changed: before !== after, after: after.slice(0, 200) };
  });
  await t('track: select type / amort / purpose / anchor', async () => {
    const out = {};
    for (const l of ['לוח סילוקין', 'סוג מסלול', 'מטרת המסלול', 'עוגן']) {
      const sel = pg.getByLabel(l, { exact: true }).first();
      const opts = await sel.locator('option').allInnerTexts();
      out[l] = opts.length;
      if (opts.length > 1) await sel.selectOption({ index: 1 });
    }
    await pg.waitForTimeout(300);
    return out;
  });
  await t('track: close editor (סגור)', async () => {
    await edits().first().click(); await pg.waitForTimeout(200);
    return (await pg.getByLabel('סכום המסלול').count()) === 0;
  });
  await t('track: add (+ הוסף מסלול) opens editor', async () => {
    const n0 = await pg.getByRole('button', { name: 'מחק מסלול' }).count();
    await pg.getByRole('button', { name: '+ הוסף מסלול' }).click(); await pg.waitForTimeout(300);
    return { tracksBefore: n0, tracksAfter: await pg.getByRole('button', { name: 'מחק מסלול' }).count(), editorOpen: await pg.getByLabel('סכום המסלול').count() };
  });
  await t('track: fill new', async () => {
    await pg.getByLabel('סכום המסלול').first().fill('100000'); await pg.getByLabel('תקופה בשנים').first().fill('15');
    await pg.getByLabel('ריבית שנתית').first().fill('4.5'); return true;
  });
  await t('track: remove one', async () => {
    const n0 = await pg.getByRole('button', { name: 'מחק מסלול' }).count();
    await pg.getByRole('button', { name: 'מחק מסלול' }).last().click(); await pg.waitForTimeout(300);
    return { n0, n1: await pg.getByRole('button', { name: 'מחק מסלול' }).count() };
  });
  await t('scenario fields: financier/property/purchase type', async () => {
    await pg.getByLabel('גוף מממן').fill('בנק QA'); await pg.getByLabel('שווי נכס').fill('2000000');
    await pg.getByLabel('סוג רכישה').selectOption({ index: 1 }); await pg.waitForTimeout(300);
    return { propVal: await pg.getByLabel('שווי נכס').inputValue(), tablesNow: await pg.locator('table').count() };
  });
  await t('save scenario', async () => {
    await pg.getByRole('button', { name: 'שמור תרחיש' }).click(); await pg.waitForTimeout(800);
    return { toast: (await body(pg)).includes('התרחיש נשמר'), financier: await pg.getByLabel('גוף מממן').inputValue() };
  });
  await t('placeholder buttons (קיצור/פירעון) toast', async () => {
    await edits().first().click();
    const b = pg.locator('button[aria-disabled=true]').first();
    if (!(await b.count())) return 'none';
    await b.click(); await pg.waitForTimeout(300);
    return (await body(pg)).includes('יתווסף בהמשך');
  });
});
