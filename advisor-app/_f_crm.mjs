import { suite, body, focused } from './_f_lib.mjs';
await suite('crm', 'crm', [1440, 390], async (pg, t, w) => {
  await t('sections always open, no aria-expanded', async () => {
    const n = await pg.locator('[aria-expanded]').count();
    const h = await pg.locator('h2').allInnerTexts();
    return { ariaExpanded: n, h2: h };
  });
  await t('task: dashed add collapsed, click opens + focus', async () => {
    if (await pg.getByLabel('משימות', { exact: true }).count()) return 'form already open';
    await pg.getByRole('button', { name: /הוסף משימות/ }).click();
    return (await focused(pg)) === 'משימות' || await focused(pg);
  });
  await t('task: add 2 lines + due date', async () => {
    await pg.getByLabel('משימות', { exact: true }).fill('בדיקה אחת\nבדיקה שתיים');
    await pg.getByLabel('תאריך יעד למשימות').fill('2026-12-01');
    await pg.getByRole('button', { name: 'הוסף משימה' }).click();
    await pg.waitForTimeout(500);
    const txt = await body(pg);
    return txt.includes('בדיקה אחת') && txt.includes('בדיקה שתיים');
  });
  await t('task: form closed/reset after add?', async () => ({ formStillOpen: await pg.getByLabel('משימות', { exact: true }).count(), value: await pg.getByLabel('משימות', { exact: true }).inputValue().catch(() => null) }));
  await t('task: toggle done', async () => {
    const cb = pg.getByLabel('סמן "בדיקה אחת" כהושלמה');
    await cb.check(); await pg.waitForTimeout(300);
    return await cb.isChecked();
  });
  await t('task: edit via click, save', async () => {
    await pg.locator('[role=button]', { hasText: 'בדיקה שתיים' }).click();
    await pg.locator('input[value="בדיקה שתיים"]').fill('שונה');
    await pg.getByRole('button', { name: 'שמור', exact: true }).first().click();
    await pg.waitForTimeout(400);
    return (await body(pg)).includes('שונה');
  });
  await t('task: edit open via keyboard Enter, cancel', async () => {
    const row = pg.locator('[role=button]', { hasText: 'שונה' });
    await row.focus(); await pg.keyboard.press('Enter');
    const ok = await pg.locator('input[value="שונה"]').isVisible();
    await pg.getByRole('button', { name: 'ביטול' }).first().click();
    return ok;
  });
  await t('task: delete', async () => {
    const row = pg.locator('div[class*=taskRow]', { hasText: 'שונה' });
    await row.getByRole('button', { name: 'מחק' }).click(); await pg.waitForTimeout(400);
    return !(await body(pg)).includes('שונה');
  });
  await t('meeting: add form opens + focus', async () => {
    await pg.getByRole('button', { name: /קבע פגישה/ }).first().click();
    return (await focused(pg)) === 'נושא הפגישה' || await focused(pg);
  });
  await t('meeting: add', async () => {
    await pg.getByLabel('נושא הפגישה').fill('פגישת בדיקה');
    await pg.getByLabel('תאריך ושעת הפגישה').fill('2026-12-10T10:00');
    await pg.getByRole('button', { name: 'קבע פגישה', exact: true }).click(); await pg.waitForTimeout(500);
    return (await body(pg)).includes('פגישת בדיקה');
  });
  await t('meeting: summary save', async () => {
    const row = pg.locator('div[class*=meetingRow]', { hasText: 'פגישת בדיקה' });
    await row.getByLabel('סיכום פגישה').fill('סיכום בדיקה');
    await row.getByRole('button', { name: 'שמור סיכום' }).click(); await pg.waitForTimeout(1500);
    return (await row.getByLabel('סיכום פגישה').inputValue()) === 'סיכום בדיקה';
  });
  await t('meeting: edit save', async () => {
    const row = pg.locator('div[class*=meetingRow]', { hasText: 'פגישת בדיקה' });
    await row.locator('[role=button]').first().click();
    await pg.locator('input[value="פגישת בדיקה"]').fill('פגישה ערוכה');
    await pg.getByRole('button', { name: 'שמור', exact: true }).first().click(); await pg.waitForTimeout(400);
    return (await body(pg)).includes('פגישה ערוכה');
  });
  await t('meeting: download ics', async () => {
    const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 3000 }), pg.getByRole('button', { name: 'הורד ליומן' }).first().click()]);
    return d.suggestedFilename();
  });
  await t('meeting: delete', async () => {
    const row = pg.locator('div[class*=meetingRow]', { hasText: 'פגישה ערוכה' });
    await row.getByRole('button', { name: 'מחק' }).click(); await pg.waitForTimeout(400);
    return !(await body(pg)).includes('פגישה ערוכה');
  });
  await t('tags: add via button+Enter', async () => {
    await pg.getByRole('button', { name: '+ הוסף תגית' }).click();
    await pg.getByLabel('שם התגית').fill('תגית1'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
    return (await body(pg)).includes('תגית1');
  });
  await t('tags: remove', async () => {
    await pg.getByRole('button', { name: 'הסר תגית תגית1' }).click(); await pg.waitForTimeout(400);
    return !(await body(pg)).includes('תגית1');
  });
  await t('tags: Escape cancels input', async () => {
    await pg.getByRole('button', { name: '+ הוסף תגית' }).click();
    await pg.getByLabel('שם התגית').fill('בטלתי'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
    return !(await body(pg)).includes('בטלתי');
  });
  await t('quick action: + הוסף טלפון opens edit details, focus first', async () => {
    await pg.getByRole('button', { name: '+ הוסף טלפון' }).click(); await pg.waitForTimeout(300);
    return (await focused(pg)) === 'שם הלקוח' || await focused(pg);
  });
  await t('details: edit & save phone+bg', async () => {
    await pg.getByLabel('טלפון', { exact: true }).fill('0501234567');
    await pg.getByLabel('רקע על הלקוח').fill('רקע בדיקה');
    await pg.getByRole('button', { name: 'שמור', exact: true }).click(); await pg.waitForTimeout(600);
    const txt = await body(pg);
    return { phoneShown: txt.includes('0501234567'), bg: txt.includes('רקע בדיקה'), wa: await pg.getByRole('link', { name: /WhatsApp/ }).count(), tel: await pg.getByRole('link', { name: /התקשר/ }).count() };
  });
  await t('quick action: משימה חדשה opens form', async () => {
    await pg.reload(); await pg.waitForTimeout(1000);
    await pg.getByRole('button', { name: 'משימה חדשה' }).click(); await pg.waitForTimeout(300);
    return (await focused(pg)) === 'משימות' || await focused(pg);
  });
  await t('quick action: פגישה חדשה opens form', async () => {
    await pg.reload(); await pg.waitForTimeout(1000);
    await pg.getByRole('button', { name: 'פגישה חדשה' }).click(); await pg.waitForTimeout(300);
    return (await focused(pg)) === 'נושא הפגישה' || await focused(pg);
  });
  await t('quick action: re-click when form already open refocuses', async () => {
    await pg.getByRole('button', { name: 'משימה חדשה' }).click(); await pg.waitForTimeout(300);
    const f1 = await focused(pg);
    await pg.getByRole('button', { name: 'פגישה חדשה' }).click(); await pg.waitForTimeout(300);
    const f2 = await focused(pg);
    await pg.getByRole('button', { name: 'פגישה חדשה' }).click(); await pg.waitForTimeout(300);
    const f3 = await focused(pg);
    return { f1, f2, f3 };
  });
  await t('personal/business toggle', async () => {
    await pg.getByRole('button', { name: 'עסקי' }).click(); await pg.waitForTimeout(300);
    const a = await pg.getByRole('button', { name: 'עסקי' }).getAttribute('aria-pressed');
    const url = pg.url().includes('mode=business');
    await pg.getByRole('button', { name: 'פרטי', exact: true }).click();
    return { pressed: a, url, back: await pg.getByRole('button', { name: 'פרטי', exact: true }).getAttribute('aria-pressed') };
  });
  await t('keyboard Space/Enter on dashed add buttons', async () => {
    await pg.reload(); await pg.waitForTimeout(1000);
    const b = pg.getByRole('button', { name: /הוסף משימות/ }); await b.focus(); await pg.keyboard.press('Space'); await pg.waitForTimeout(200);
    const o1 = await pg.getByLabel('משימות', { exact: true }).isVisible();
    const b2 = pg.getByRole('button', { name: /קבע פגישה/ }).first(); await b2.focus(); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200);
    return { space: o1, enter: await pg.getByLabel('נושא הפגישה').isVisible() };
  });
  await t('Tab order sample', async () => {
    await pg.reload(); await pg.waitForTimeout(1000);
    const seq = [];
    for (let i = 0; i < 40; i++) { await pg.keyboard.press('Tab'); seq.push(await pg.evaluate(() => (document.activeElement?.getAttribute('aria-label') || document.activeElement?.innerText || document.activeElement?.tagName).trim().slice(0, 18))); }
    return seq.join(' | ');
  });
});
