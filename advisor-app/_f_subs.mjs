import { suite, body, focused } from './_f_lib.mjs';
const sections = [
  { sec: 'מנויים', btn: 'הוסף מנוי', fields: [['שם המנוי', 'מנוי QA'], ['סכום המנוי', '55']], first: 'שם המנוי', submit: 'הוסף מנוי', name: 'מנוי QA', edited: 'מנוי QA2', nameLabel: 'שם המנוי', saveLabel: 'שמור' },
  { sec: 'ביטוחים', btn: 'הוסף ביטוח', fields: [['שם הביטוח', 'ביטוח QA'], ['סכום חודשי לביטוח', '77']], first: 'שם הביטוח', submit: 'הוסף ביטוח', name: 'ביטוח QA', edited: 'ביטוח QA2', nameLabel: 'שם הביטוח', saveLabel: 'שמור' },
  { sec: 'טיפוח וקוסמטיקה', btn: 'הוסף פריט', fields: [['שם הפריט', 'טיפוח QA'], ['סכום חודשי', '33']], first: 'שם הפריט', submit: 'הוסף', name: 'טיפוח QA', edited: 'טיפוח QA2', nameLabel: 'שם הפריט', saveLabel: 'שמור' },
  { sec: 'אירועים ומתנות', btn: 'הוסף אירוע', fields: [['שם האירוע', 'אירוע QA'], ['עלות שנתית', '1200']], first: 'שם האירוע', submit: 'הוסף', name: 'אירוע QA', edited: 'אירוע QA2', nameLabel: 'שם האירוע', saveLabel: 'שמור' },
  { sec: 'חינוך וחוגים', btn: 'הוסף פריט', fields: [['שם הפריט', 'חינוך QA'], ['סכום חודשי', '44']], first: 'שם הפריט', submit: 'הוסף', name: 'חינוך QA', edited: 'חינוך QA2', nameLabel: 'שם הפריט', saveLabel: 'שמור' },
  { sec: 'הוצאות שנתיות', btn: 'הוסף הוצאה', fields: [['שם ההוצאה', 'שנתית QA'], ['עלות שנתית', '2400']], first: 'שם ההוצאה', submit: 'הוסף', name: 'שנתית QA', edited: 'שנתית QA2', nameLabel: 'שם ההוצאה', saveLabel: 'שמור' }
];
await suite('subs', 'subs', [1440, 390], async (pg, t, w) => {
  await t('6 sections visible, always open, no chevrons', async () => (await pg.locator('h2').allInnerTexts()).map(x => x.replace(/\n/g, ' ')));
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    // locate the section by h2 text: the container is the h2's parent
    const scope = () => pg.locator('h2', { hasText: s.sec }).locator('xpath=..');
    await t(`${s.sec}: open add form + focus`, async () => {
      const sc = scope();
      await sc.getByRole('button', { name: new RegExp(s.btn) }).first().click();
      return { focus: await focused(pg), expected: s.first };
    });
    await t(`${s.sec}: add`, async () => {
      const sc = scope();
      for (const [l, v] of s.fields) await sc.getByLabel(l, { exact: true }).fill(v);
      await sc.getByRole('button', { name: s.submit, exact: true }).click(); await pg.waitForTimeout(600);
      return (await sc.innerText()).includes(s.name);
    });
    await t(`${s.sec}: edit (click row) + save`, async () => {
      const sc = scope();
      await sc.locator('[role=button]', { hasText: s.name }).click(); await pg.waitForTimeout(200);
      const inp = sc.getByLabel(s.nameLabel, { exact: true });
      await inp.fill(s.edited);
      await sc.getByRole('button', { name: 'שמור', exact: true }).click(); await pg.waitForTimeout(600);
      return (await sc.innerText()).includes(s.edited);
    });
    await t(`${s.sec}: delete`, async () => {
      const sc = scope();
      const row = sc.locator('[role=button]', { hasText: s.edited }).locator('xpath=..');
      await row.getByRole('button', { name: 'מחק' }).click(); await pg.waitForTimeout(600);
      return !(await sc.innerText()).includes(s.edited);
    });
  }
  await t('subs: cycle select / date inputs present', async () => {
    const sc = pg.locator('h2', { hasText: 'מנויים' }).locator('xpath=..');
    await sc.getByRole('button', { name: /הוסף מנוי/ }).first().click().catch(() => {});
    return { cycle: await pg.getByLabel('תדירות החיוב').count(), date: await pg.getByLabel('תאריך החידוש הבא').count(), cat: await pg.getByLabel('קטגוריית המנוי').count() };
  });
});
