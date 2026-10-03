import { suite, body, focused } from './_f_lib.mjs';
await suite('budget', 'budget', [1440, 390], async (pg, t, w) => {
  await t('category rows render', async () => ({ rows: await pg.locator('h2:has-text("קטגוריות")').count(), bars: await pg.locator('[aria-hidden=true][class*=bar]').count() }));
  await t('wizard hidden behind button', async () => ({ btn: await pg.getByRole('button', { name: 'בניית תקציב עם הלקוח' }).count(), stepper: await pg.locator('[aria-current=step]').count() }));
  await t('wizard opens', async () => {
    await pg.getByRole('button', { name: 'בניית תקציב עם הלקוח' }).click(); await pg.waitForTimeout(500);
    return { step: await pg.locator('[aria-current=step]').getAttribute('aria-label'), btnGone: (await pg.getByRole('button', { name: 'בניית תקציב עם הלקוח' }).count()) === 0 };
  });
  await t('step 0 income: edit amount, add row, add via suggestion chip, delete row', async () => {
    const amts = pg.getByLabel('סכום חודשי');
    const n0 = await amts.count();
    await amts.first().fill('15000');
    await pg.getByRole('button', { name: '+ הוסף שורה' }).click(); await pg.waitForTimeout(200);
    const n1 = await pg.getByLabel('סכום חודשי').count();
    await pg.getByLabel('שם').last().fill('הכנסה QA'); await pg.getByLabel('סכום חודשי').last().fill('500');
    const chips = await pg.locator('button[class*=chip]').count();
    if (chips) await pg.locator('button[class*=chip]').first().click();
    await pg.waitForTimeout(200);
    const n2 = await pg.getByLabel('סכום חודשי').count();
    await pg.getByRole('button', { name: 'מחק' }).last().click(); await pg.waitForTimeout(200);
    return { n0, n1, chips, n2, n3: await pg.getByLabel('סכום חודשי').count() };
  });
  await t('next through steps 1..3 then previous', async () => {
    const out = [];
    for (let i = 0; i < 3; i++) { await pg.getByRole('button', { name: 'הבא' }).click(); await pg.waitForTimeout(300); out.push(await pg.locator('[aria-current=step]').getAttribute('aria-label')); }
    await pg.getByRole('button', { name: 'הקודם' }).click(); await pg.waitForTimeout(300); out.push('back:' + await pg.locator('[aria-current=step]').getAttribute('aria-label'));
    return out;
  });
  await t('stepper dot jump', async () => {
    const dots = pg.locator('[class*=stepDot]');
    await dots.nth(3).click(); await pg.waitForTimeout(300);
    const s3 = await pg.locator('[aria-current=step]').getAttribute('aria-label');
    await dots.nth(0).click(); await pg.waitForTimeout(300);
    return { s3, s0: await pg.locator('[aria-current=step]').getAttribute('aria-label') };
  });
  await t('step1 fixed + step2 variable: edit rows', async () => {
    await pg.getByRole('button', { name: 'הבא' }).click(); await pg.waitForTimeout(200);
    await pg.getByLabel('סכום חודשי').first().fill('3333');
    await pg.getByRole('button', { name: 'הבא' }).click(); await pg.waitForTimeout(200);
    await pg.getByLabel('סכום חודשי').first().fill('1111');
    return true;
  });
  await t('step 3 summary: charts/plan-actual toggles', async () => {
    await pg.getByRole('button', { name: 'הבא' }).click(); await pg.waitForTimeout(800);
    const canv = await pg.locator('canvas').count();
    await pg.getByRole('button', { name: 'בפועל', exact: true }).click().catch(() => {});
    await pg.getByRole('button', { name: 'תכנון', exact: true }).click().catch(() => {});
    return { canvases: canv, finishBtn: await pg.getByRole('button', { name: 'שמור ושלח ללקוח' }).count(), nextBtn: await pg.getByRole('button', { name: 'הבא' }).count() };
  });
  await t('save (שמור ושלח ללקוח)', async () => {
    await pg.getByRole('button', { name: 'שמור ושלח ללקוח' }).click(); await pg.waitForTimeout(1500);
    const txt = await body(pg);
    return { stillWizard: await pg.locator('[aria-current=step]').count(), toast: txt.match(/התקציב[^\n]*/)?.[0] || null, firstCat: txt.includes('3,333') || txt.includes('1,111') };
  });
});
await suite('budget-empty', 'budget&data=empty', [1440], async (pg, t) => {
  await t('empty budget auto-opens wizard', async () => ({ stepper: await pg.locator('[aria-current=step]').count(), btn: await pg.getByRole('button', { name: 'בניית תקציב עם הלקוח' }).count() }));
  await t('empty: save w/o income -> error toast, jumps to step 0', async () => {
    for (let i = 0; i < 3; i++) await pg.getByRole('button', { name: 'הבא' }).click();
    await pg.getByRole('button', { name: 'שמור ושלח ללקוח' }).click(); await pg.waitForTimeout(500);
    return { toast: (await body(pg)).includes('צריך לפחות מקור הכנסה'), step: await pg.locator('[aria-current=step]').getAttribute('aria-label') };
  });
});
await suite('analysis', 'analysis', [1440, 390], async (pg, t, w) => {
  await t('renders cards & chart', async () => ({ h2: (await pg.locator('h2').allInnerTexts()), canvas: await pg.locator('canvas').count() }));
  await t('what-if slider change updates result', async () => {
    const res = () => pg.locator('[class*=whatIfResult]').innerText();
    const a = await res();
    await pg.getByLabel('אחוז צמצום').fill('50'); await pg.waitForTimeout(300);
    const b = await res();
    const pct = await pg.locator('[class*=whatIfPct]').innerText();
    return { a, b, pct, changed: a !== b };
  });
  await t('what-if select category changes result', async () => {
    const res = () => pg.locator('[class*=whatIfResult]').innerText();
    const a = await res();
    const sel = pg.getByLabel('קטגוריה לצמצום'); const n = await sel.locator('option').count();
    await sel.selectOption({ index: n - 1 }); await pg.waitForTimeout(300);
    return { options: n, changed: a !== await res(), sel: await sel.inputValue() };
  });
  await t('slider keyboard', async () => {
    const s = pg.getByLabel('אחוז צמצום'); await s.focus(); await pg.keyboard.press('ArrowLeft'); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowRight');
    return await pg.locator('[class*=whatIfPct]').innerText();
  });
});
await suite('mapping', 'mapping', [1440, 390], async (pg, t, w) => {
  await t('renders + upload input', async () => ({ file: await pg.locator('input[type=file]').count(), accept: await pg.locator('input[type=file]').first().getAttribute('accept'), h2: await pg.locator('h2').allInnerTexts() }));
  await t('"הצג תנועות גולמיות" toggle', async () => {
    const b = pg.getByRole('button', { name: /תנועות גולמיות/ });
    const before = await b.innerText(); await b.click(); await pg.waitForTimeout(400);
    return { before, after: await pg.getByRole('button', { name: /תנועות|הסתר/ }).first().innerText(), rows: await pg.locator('table tr').count() };
  });
  await t('"עבד וחשב מיפוי" button', async () => { await pg.getByRole('button', { name: /עבד וחשב/ }).click(); await pg.waitForTimeout(1500); return (await body(pg)).slice(0, 200).replace(/\n/g, ' '); });
  await t('"עדכן" button', async () => { await pg.getByRole('button', { name: 'עדכן' }).click(); await pg.waitForTimeout(1000); return true; });
});
await suite('dashboard', 'dashboard', [1440, 390], async (pg, t, w) => {
  await t('renders', async () => ({ h2: await pg.locator('h2').allInnerTexts(), canvas: await pg.locator('canvas').count() }));
});
