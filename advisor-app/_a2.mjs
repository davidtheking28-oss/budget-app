import { chromium } from 'playwright';
const OUT='C:/Users/david/AppData/Local/Temp/claude/c--Users-david-projects-ai-budget/19e33a93-7d7d-4c0d-b5c4-94bbdb95a1a8/scratchpad/agent2/';
const b = await chromium.launch();
for (const dark of [false,true]) for (const w of [1400,1000,862,860,390]) {
  const p = await b.newPage({viewport:{width:w,height:900}});
  for (const nav of (w===1000&&!dark?['dashboard','goals','subs','credit','assets','budget']:['subs'])) {
    await p.goto(`http://localhost:5199/?client=11111111-1111-1111-1111-111111111111&nav=${nav}`);
    await p.waitForTimeout(1200);
    if (dark) { const t=p.getByRole('button',{name:'מצב כהה'}); if(await t.count()) await t.first().click(); await p.waitForTimeout(300);}
    const ov = await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth, h1:document.querySelector('h1')?.textContent}));
    console.log(w,dark,nav,JSON.stringify(ov));
    await p.screenshot({path:`${OUT}${nav}-${w}-${dark?'d':'l'}.png`});
  }
  if (w===390 && !dark) {
    const sizes = await p.evaluate(()=>[...document.querySelectorAll('nav button')].map(b=>{const r=b.getBoundingClientRect();return [b.getAttribute('aria-label'),Math.round(r.width),Math.round(r.height)]}));
    console.log(JSON.stringify(sizes));
  }
  await p.close();
}
await b.close();
