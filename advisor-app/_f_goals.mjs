import { suite, body, focused } from './_f_lib.mjs';
await suite('goals', 'goals', [1440, 390], async (pg, t, w) => {
  await t('add form collapsed; click opens + focus', async () => {
    const closed = (await pg.getByLabel('שם היעד').count()) === 0;
    await pg.getByRole('button', { name: /הוסף יעד/ }).click();
    return { closedInitially: closed, focus: await focused(pg) };
  });
  await t('validation: empty name toast', async () => {
    await pg.getByRole('button', { name: 'הוסף יעד', exact: true }).click(); await pg.waitForTimeout(300);
    return (await body(pg)).includes('תן שם ליעד');
  });
  await t('add goal', async () => {
    await pg.getByLabel('שם היעד').fill('יעד בדיקה');
    await pg.getByLabel('סכום היעד').fill('1000');
    await pg.getByLabel('מספר חודשים ליעד').fill('10');
    await pg.getByRole('button', { name: 'הוסף יעד', exact: true }).click(); await pg.waitForTimeout(700);
    return (await body(pg)).includes('יעד בדיקה');
  });
  const card = () => pg.locator('div[class*=goalItem]', { hasText: 'יעד בדיקה' });
  await t('deposit 300', async () => {
    await card().getByRole('button', { name: 'הוסף לחיסכון' }).click();
    await pg.getByLabel('סכום להפקדה ליעד').fill('300');
    await pg.getByRole('button', { name: 'הוסף', exact: true }).click(); await pg.waitForTimeout(700);
    return (await card().innerText()).replace(/\n/g, ' ');
  });
  await t('withdraw 100', async () => {
    await card().getByRole('button', { name: /משוך/ }).click();
    await pg.getByLabel('סכום להפקדה ליעד').fill('100');
    await pg.getByRole('button', { name: 'משוך', exact: true }).click(); await pg.waitForTimeout(700);
    return (await card().innerText()).replace(/\n/g, ' ');
  });
  await t('deposit via Enter key', async () => {
    await card().getByRole('button', { name: 'הוסף לחיסכון' }).click();
    await pg.getByLabel('סכום להפקדה ליעד').fill('50'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(700);
    return (await card().innerText()).replace(/\n/g, ' ');
  });
  await t('deposit cancel', async () => {
    await card().getByRole('button', { name: 'הוסף לחיסכון' }).click();
    await pg.getByRole('button', { name: 'ביטול' }).click();
    return await card().getByRole('button', { name: 'הוסף לחיסכון' }).isVisible();
  });
  await t('delete goal + undo toast', async () => {
    await card().getByRole('button', { name: 'מחק יעד' }).click(); await pg.waitForTimeout(500);
    const gone = !(await body(pg)).includes('יעד בדיקה');
    const undo = await pg.getByRole('button', { name: 'בטל' }).count();
    if (undo) { await pg.getByRole('button', { name: 'בטל' }).click(); await pg.waitForTimeout(500); }
    return { gone, undoBtn: undo, restored: (await body(pg)).includes('יעד בדיקה') };
  });
  await t('delete goal final', async () => {
    await card().getByRole('button', { name: 'מחק יעד' }).click(); await pg.waitForTimeout(500);
    return !(await body(pg)).includes('יעד בדיקה');
  });
  await t('keyboard Enter/Space on dashed add', async () => {
    await pg.reload(); await pg.waitForTimeout(1000);
    const b = pg.getByRole('button', { name: /הוסף יעד/ }); await b.focus(); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200);
    return { open: await pg.getByLabel('שם היעד').isVisible(), focus: await focused(pg) };
  });
});
