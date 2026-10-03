import { chromium } from 'playwright';
const C='11111111-1111-1111-1111-111111111111';
const b=await chromium.launch();
const pages=['dashboard','crm','mapping','budget','analysis','goals','subs','credit','assets','mortgage'];
for (const w of [1440,390]) {
 for (const p of pages){
  const ctx=await b.newContext({viewport:{width:w,height:900}});
  const pg=await ctx.newPage();
  const errs=[];
  pg.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+': '+m.text().slice(0,200))});
  pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await pg.goto(`http://localhost:5212/?client=${C}&nav=${p}`);
  await pg.waitForTimeout(1200);
  const info=await pg.evaluate(()=>({
   btns:[...document.querySelectorAll('button')].map(b=>(b.innerText||b.getAttribute('aria-label')||'').trim().slice(0,25)).filter(Boolean),
   inputs:document.querySelectorAll('input,select,textarea').length,
   hscroll:document.documentElement.scrollWidth>innerWidth}));
  console.log(w,p,JSON.stringify(info),errs);
  await ctx.close();
 }
}
await b.close();
