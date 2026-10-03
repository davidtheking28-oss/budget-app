import { chromium } from 'playwright';
const S='C:/Users/david/AppData/Local/Temp/claude/c--Users-david-projects-ai-budget/19e33a93-7d7d-4c0d-b5c4-94bbdb95a1a8/scratchpad/agentA/';
const pages=(process.argv[2]||'dashboard,crm,mapping,budget,analysis').split(',');
const sizes=(process.argv[3]||'1440,390').split(',').map(Number);
const schemes=(process.argv[4]||'light,dark').split(',');
const b=await chromium.launch();
for(const cs of schemes)for(const w of sizes){
 const c=await b.newContext({viewport:{width:w,height:900},colorScheme:cs});
 for(const p of pages){
  const pg=await c.newPage();
  await pg.goto(`http://localhost:5201/?client=11111111-1111-1111-1111-111111111111&nav=${p}`);
  await pg.waitForTimeout(1500);
  const ov=await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  console.log(p,w,cs,'hscroll',ov);
  await pg.screenshot({path:`${S}${p}-${w}-${cs}.png`,fullPage:true});
  await pg.close();
 }
}
const c=await b.newContext({viewport:{width:1440,height:900}});
const pg=await c.newPage();
await pg.goto('file:///C:/Users/david/AppData/Local/Temp/claude/c--Users-david-projects-ai-budget/19e33a93-7d7d-4c0d-b5c4-94bbdb95a1a8/scratchpad/direction-b.html');
for(const v of ['dash','crm','map','budget','analysis']){await pg.click(`button[data-v=${v}]`);await pg.waitForTimeout(300);await pg.screenshot({path:`${S}mock-${v}.png`,fullPage:true});}
await b.close();
