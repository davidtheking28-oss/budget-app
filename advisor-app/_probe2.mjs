import {start,go,body} from './_lib.mjs';
const {b,p}=await start();
const dump=async(t)=>console.log('--',t,'\n',await p.evaluate(()=>[...document.querySelectorAll('main button,main input,main select,main textarea,[class*=content] button,[class*=content] input,[class*=content] select')].filter(e=>e.offsetParent&&!e.closest('nav')).map(e=>`${e.tagName}${e.type?'['+e.type+']':''} "${(e.getAttribute('aria-label')||e.innerText||e.placeholder||e.value||'').trim().slice(0,30).replace(/\n/g,' ')}"`).join(' ; ')));
for(const k of process.argv.slice(2)){await go(p,k);await dump(k);
 for(let i=0;i<8;i++){const t=p.locator('button[class*=trigger]').first();if(!await t.count())break;await t.click({timeout:1500}).catch(()=>{});}
 await p.waitForTimeout(400);await dump(k+' all forms open');}
await b.close();
