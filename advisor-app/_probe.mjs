import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1400,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push('PE '+e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('CE '+m.text())});
for (const k of process.argv.slice(2)) {
 await p.goto(`http://localhost:5197/?client=11111111-1111-1111-1111-111111111111&nav=${k}`); await p.waitForTimeout(1200);
 console.log('=====',k);
 console.log(await p.evaluate(()=>[...document.querySelectorAll('button,input,select,textarea,a[href]')].map(e=>`${e.tagName}${e.type?'['+e.type+']':''} "${(e.getAttribute('aria-label')||e.innerText||e.placeholder||e.value||'').trim().slice(0,40).replace(/\n/g,' ')}"`).join('\n')));
}
console.log(errs.join('\n')); await b.close();
