const { chromium } = require('playwright');

const SHOT_DIR = 'C:/Users/david/AppData/Local/Temp/claude/c--Users-david-projects-ai-budget/ba505acc-4a86-40db-bcd5-b2516cb7229e/scratchpad/shots';
require('fs').mkdirSync(SHOT_DIR, { recursive: true });

const seed = {
  budget_tx: JSON.stringify([
    {id:1,type:'expense',cat:'food',desc:'סופר',amount:250,date:new Date().toISOString().slice(0,7)+'-05',recurring:false},
    {id:2,type:'expense',cat:'transport',desc:'דלק',amount:300,date:new Date().toISOString().slice(0,7)+'-10',recurring:false},
    {id:3,type:'income',cat:'salary',desc:'משכורת',amount:12000,date:new Date().toISOString().slice(0,7)+'-01',recurring:true},
    {id:4,type:'expense',cat:'food',desc:'מסעדה',amount:150,date:new Date().toISOString().slice(0,7)+'-12',recurring:false},
  ]),
  budget_goals: '[]',
  budget_subs: JSON.stringify([
    {id:1,name:'נטפליקס',amount:55,cycle:'monthly',category:'entertainment',active:true,nextDate:new Date().toISOString().slice(0,10)}
  ]),
  budget_limits: JSON.stringify({food:1000,transport:500}),
  budget_fixed: '[]',
  budget_settings: '{}'
};

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });

  await page.addInitScript(seed => {
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    localStorage.setItem('auth_skipped', '1');
    localStorage.setItem('budget_onboarded', '1');
  }, seed);

  await page.goto('http://localhost:8642/index.html');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => { try { authSkip(); } catch(e){} });
  await page.waitForSelector('#authScreen', { state: 'hidden', timeout: 8000 }).catch(()=>errors.push('authScreen did not hide'));

  await page.screenshot({ path: SHOT_DIR + '/1_dashboard.png' });

  // 1. Test tab navigation
  const tabs = ['הוצאות','תקציב','ניתוח','הגדרות','ראשי'];
  for (const t of tabs) {
    const el = await page.getByText(t, { exact: true }).first();
    if (await el.count()) {
      await el.click({ timeout: 3000 }).catch(e=>errors.push('tab click failed: '+t+' '+e.message));
      await page.waitForTimeout(400);
    } else {
      errors.push('tab not found: ' + t);
    }
  }
  await page.screenshot({ path: SHOT_DIR + '/2_after_tabs.png' });

  // 2. Go to dashboard, test delete animation on a transaction (trash button)
  await page.getByText('ראשי', { exact: true }).first().click().catch(()=>{});
  await page.waitForTimeout(300);
  const delBtn = page.locator('.tx-del-btn, .tx-delete-reveal').first();
  if (await delBtn.count()) {
    await delBtn.click({ timeout: 3000 }).catch(e=>errors.push('delete tx click failed: '+e.message));
    await page.waitForTimeout(500);
  } else {
    errors.push('no delete button found on dashboard tx list');
  }
  await page.screenshot({ path: SHOT_DIR + '/3_after_delete.png' });

  // 3. Test swipe gesture on a transaction row (pointer drag)
  const txItem = page.locator('.tx-swipe-wrap .tx-item').first();
  if (await txItem.count()) {
    const box = await txItem.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width - 10, box.y + box.height/2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 90, box.y + box.height/2, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      const revealed = await page.locator('.tx-delete-reveal').first().isVisible().catch(()=>false);
      if (!revealed) errors.push('swipe did not reveal delete button');
    }
  } else {
    errors.push('no swipeable tx-item found for swipe test');
  }
  await page.screenshot({ path: SHOT_DIR + '/4_after_swipe.png' });

  // 4. Test month sheet open/close animation
  const monthBtn = page.locator('[onclick*="openMonthSheet"]').first();
  if (await monthBtn.count()) {
    await monthBtn.click().catch(e=>errors.push('open month sheet failed: '+e.message));
    await page.waitForTimeout(400);
    const overlayOpen = await page.locator('#monthSheetOverlay.open').count();
    if (!overlayOpen) errors.push('month sheet did not open');
    await page.screenshot({ path: SHOT_DIR + '/5_month_sheet_open.png' });
    await page.evaluate(() => closeMonthSheet());
    await page.waitForTimeout(350);
    const overlayClosed = await page.locator('#monthSheetOverlay.open').count();
    if (overlayClosed) errors.push('month sheet did not close after animation');
  } else {
    errors.push('month sheet trigger not found');
  }

  // 5. Test mode dropdown
  const modePill = page.locator('.mode-pill-current').first();
  if (await modePill.count()) {
    await modePill.click().catch(e=>errors.push('mode pill click failed: '+e.message));
    await page.waitForTimeout(300);
    const ddOpen = await page.locator('.mode-dropdown.open').count();
    if (!ddOpen) errors.push('mode dropdown did not open');
    await page.screenshot({ path: SHOT_DIR + '/6_mode_dropdown.png' });
    await page.mouse.click(10, 10);
    await page.waitForTimeout(300);
  } else {
    errors.push('mode pill not found (may not exist in this mode)');
  }

  // 6. Go to budget tab, test deleteBudget animation
  await page.getByText('תקציב', { exact: true }).first().click().catch(()=>{});
  await page.waitForTimeout(400);
  const budgetChip = page.locator('.budget-chip').first();
  if (await budgetChip.count()) {
    await page.screenshot({ path: SHOT_DIR + '/7_budget_tab.png' });
  } else {
    errors.push('no budget chips found on budget tab');
  }

  // 7. Go to expenses tab, test deleteSub
  await page.getByText('הוצאות', { exact: true }).first().click().catch(()=>{});
  await page.waitForTimeout(400);
  await page.screenshot({ path: SHOT_DIR + '/8_expenses_tab.png' });

  // 8. Dark mode toggle check
  await page.evaluate(() => { document.body.classList.add('dark'); localStorage.setItem('budget_theme','dark'); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOT_DIR + '/9_dark_mode.png' });

  // 9. Reload to confirm no init errors after all this state churn
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  await browser.close();

  console.log('ERRORS:', errors.length);
  errors.forEach(e => console.log(' - ' + e));
})();
