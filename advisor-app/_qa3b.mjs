import {start,go,log,body,SH,errs} from './_lib.mjs';
const {b,p}=await start();await go(p,'crm');
const g=n=>p.getByRole('button',{name:n,exact:true});
const st=async()=>[await g('פרטי').evaluate(e=>e.className+'|'+e.getAttribute('aria-pressed')),await g('עסקי').evaluate(e=>e.className+'|'+e.getAttribute('aria-pressed'))];
console.log(await st());await g('עסקי').click();await p.waitForTimeout(500);console.log(await st());
await p.screenshot({path:SH+'crm-biz.png'});
await g('פרטי').click();await p.waitForTimeout(500);console.log(await st());console.log(errs);await b.close();
