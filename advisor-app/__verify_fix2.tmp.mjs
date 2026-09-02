import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()); });
await page.goto('http://localhost:5199/?client=11111111-1111-1111-1111-111111111111&nav=expenses');
await page.waitForLoadState('networkidle');
await page.waitForSelector('text=תזרים', { timeout: 10000 });
await page.waitForTimeout(300);

const before = await page.evaluate(() => window.__fromCalls.length);
console.log('calls after initial load:', before);

// simulate TOKEN_REFRESHED with a new session object (same user, different token)
await page.evaluate(() => {
  window.__emitAuthEvent('TOKEN_REFRESHED', {
    user: { id: '99999999-9999-9999-9999-999999999999', email: 'advisor@budgetadvisor.co.il' },
    access_token: 'mock-refreshed-' + Date.now()
  });
});
await page.waitForTimeout(400);
const afterRefresh = await page.evaluate(() => window.__fromCalls.length);
console.log('calls after TOKEN_REFRESHED:', afterRefresh, '(expect same as before:', before, ')');

// simulate SIGNED_IN and confirm it DOES trigger reload calls
const beforeSignedIn = afterRefresh;
await page.evaluate(() => {
  window.__emitAuthEvent('SIGNED_IN', {
    user: { id: '99999999-9999-9999-9999-999999999999', email: 'advisor@budgetadvisor.co.il' },
    access_token: 'mock-signedin-' + Date.now()
  });
});
await page.waitForTimeout(400);
const afterSignedIn = await page.evaluate(() => window.__fromCalls.length);
console.log('calls after SIGNED_IN:', afterSignedIn, '(expect > ', beforeSignedIn, ')');

console.log('RESULT: token-refresh no-op =', afterRefresh === before, '| signed-in still reloads =', afterSignedIn > beforeSignedIn);

await browser.close();
