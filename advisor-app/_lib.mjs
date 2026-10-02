import { chromium } from 'playwright';
export const SH='C:/Users/david/AppData/Local/Temp/claude/c--Users-david-projects-ai-budget/19e33a93-7d7d-4c0d-b5c4-94bbdb95a1a8/scratchpad/qa3/';
export const errs=[];
export async function start(w=1400,h=900){
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:w,height:h}});
 p.on('pageerror',e=>errs.push('PE '+e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('CE '+m.text())});
 return {b,p};
}
export const go=async(p,k)=>{await p.goto(`http://localhost:5197/?client=11111111-1111-1111-1111-111111111111&nav=${k}`);await p.waitForTimeout(900)};
export const res=[]; export const log=(n,ok,m='')=>{console.log((ok?'PASS':'FAIL')+' '+n+' '+m)};
export const body=p=>p.evaluate(()=>document.body.innerText);
