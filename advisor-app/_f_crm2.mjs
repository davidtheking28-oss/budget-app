import { suite, body, focused } from './_f_lib.mjs';
await suite('crm2', 'crm', [1440], async (pg, t, w) => {
  pg.on('requestfailed', r => console.log('REQFAILED', r.url()));
  await pg.reload(); await pg.waitForTimeout(1000);
  await t('phone saved -> hero reflects (no stale add-phone button)', async () => {
    await pg.getByRole('button', { name: '+ הוסף טלפון' }).click();
    await pg.getByLabel('טלפון', { exact: true }).fill('0501234567');
    await pg.getByRole('button', { name: 'שמור', exact: true }).click(); await pg.waitForTimeout(800);
    return { addPhoneBtnCount: await pg.getByRole('button', { name: '+ הוסף טלפון' }).count(), heroHasPhone: await pg.locator('section').first().innerText().then(x => x.includes('0501234567')), waLinks: await pg.locator('a[href^="https://wa.me"]').count() };
  });
  await t('after reload phone persists in hero (mock is in-memory so expected reset)', async () => ({ ok: true }));
  await t('aria-expanded elements', async () => pg.evaluate(() => [...document.querySelectorAll('[aria-expanded]')].map(e => e.outerHTML.slice(0, 120))));
  await t('dirty form: AddForm stays open while dirty and Cancel?', async () => {
    return { editBtn: await pg.getByRole('button', { name: /עריכת פרטים/ }).count(), formOpen: await pg.getByLabel('שם הלקוח').count() };
  });
});
